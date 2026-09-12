import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuthToken } from '../services/interviewApi';

export function useGeminiLiveSession({ sessionId, active, onFactsUpdated, onStatusComplete, onUserTranscript }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const playAudioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const activeSourcesRef = useRef([]);

  // Clear all playing audio buffers (barge-in queue flush)
  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // ignore if already stopped
      }
    });
    activeSourcesRef.current = [];
    setIsSpeaking(false);
  }, []);

  // Helper: Convert Float32Array to 16-bit Int16 PCM Base64 string
  const float32ToPCMBase64 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Helper: Play 24kHz Int16 PCM Base64 chunk
  const play24kHzPCMChunk = useCallback((base64PCM) => {
    try {
      if (!playAudioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        playAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      const ctx = playAudioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const binaryStr = window.atob(base64PCM);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      activeSourcesRef.current.push(source);
      setIsSpeaking(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };

      source.start();
    } catch (err) {
      console.error('[useGeminiLiveSession] Error playing PCM chunk:', err);
    }
  }, []);

  // Connect WebSocket and start microphone stream
  useEffect(() => {
    if (!active || !sessionId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopAllPlayback();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host.includes('localhost') ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/interview/${sessionId}/live-ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Send first message authentication packet
      const token = getAuthToken();
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected') {
          setIsConnected(true);
          setIsSimulated(Boolean(msg.simulated || !msg.live_mode));
        } else if (msg.type === 'audio' && msg.pcm) {
          play24kHzPCMChunk(msg.pcm);
        } else if (msg.type === 'transcript') {
          setLiveTranscript(msg.text);
        } else if (msg.type === 'user_transcript') {
          setUserTranscript(msg.text);
          if (onUserTranscript) {
            onUserTranscript(msg.text, Boolean(msg.is_final));
          }
        } else if (msg.type === 'interrupted') {
          stopAllPlayback();
        } else if (msg.type === 'question') {
          if (onFactsUpdated) onFactsUpdated(null, msg.question_count, msg.text);
        } else if (msg.type === 'facts_updated') {
          if (onFactsUpdated) onFactsUpdated(msg.extracted_facts, msg.question_count, msg.next_question);
        } else if (msg.type === 'status_change' && msg.status === 'FACTS_COMPLETE') {
          if (onStatusComplete) onStatusComplete(msg.extracted_facts);
        } else if (msg.type === 'error') {
          setError(msg.message);
        }
      } catch (err) {
        console.error('[useGeminiLiveSession] Error parsing WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[useGeminiLiveSession] WebSocket error:', err);
      setError('Live connection error');
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsListening(false);
    };

    // Start browser microphone stream
    async function startMicStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBase64 = float32ToPCMBase64(inputData);
            wsRef.current.send(JSON.stringify({ type: 'audio', pcm: pcmBase64 }));
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        setIsListening(true);
      } catch (err) {
        console.warn('[useGeminiLiveSession] Microphone access not granted or not supported:', err);
      }
    }

    startMicStream();

    return () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopAllPlayback();
    };
  }, [sessionId, active, play24kHzPCMChunk, stopAllPlayback]);

  const sendTextMessage = useCallback((text) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'answer_text', text }));
    }
  }, []);

  const triggerInterrupt = useCallback(() => {
    stopAllPlayback();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, [stopAllPlayback]);

  return {
    isConnected,
    isSimulated,
    isSpeaking,
    isListening,
    liveTranscript,
    userTranscript,
    error,
    sendTextMessage,
    triggerInterrupt,
    stopAllPlayback,
  };
}
