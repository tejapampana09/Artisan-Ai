import { useState, useEffect, useRef, useCallback } from 'react';

const LANG_MAP = {
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
  en: 'en-IN'
};

const extractLangStr = (val) => {
  if (!val) return 'te';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.language && typeof val.language === 'string') return val.language;
  return 'te';
};

export function useVoiceInput(language = 'te') {
  const activeLang = extractLangStr(language);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('artisan_tts_muted') === 'true';
    } catch {
      return false;
    }
  });
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const autoListenRef = useRef(autoListen);

  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);

  const hasSupport = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Load and cache voices when window.speechSynthesis is ready
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('artisan_tts_muted', String(next));
      } catch (e) {}
      if (next) {
        stopSpeaking();
      }
      return next;
    });
  }, [stopSpeaking]);

  const toggleAutoListen = useCallback(() => {
    setAutoListen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!hasSupport) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = LANG_MAP[activeLang] || 'en-IN';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [activeLang, hasSupport]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript('');
    try {
      stopSpeaking();
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('SpeechRecognition start error:', e);
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.warn('SpeechRecognition stop error:', e);
    }
    setIsListening(false);
  }, []);

  const getBestVoice = useCallback((langKey) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetLang = LANG_MAP[langKey] || 'en-IN';
    const prefix = targetLang.split('-')[0];

    // 1. Natural/Google/Neural voices for exact language
    let best = voices.find(v => (v.lang === targetLang || v.lang.replace('_', '-') === targetLang) && 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online') || v.name.includes('Neural')));

    // 2. Any natural voice matching language prefix
    if (!best) {
      best = voices.find(v => v.lang.startsWith(prefix) && 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online') || v.name.includes('Neural')));
    }

    // 3. Exact language match
    if (!best) {
      best = voices.find(v => v.lang === targetLang || v.lang.replace('_', '-') === targetLang);
    }

    // 4. Any voice starting with language prefix
    if (!best) {
      best = voices.find(v => v.lang.startsWith(prefix));
    }

    return best;
  }, [availableVoices]);

  const playAudioStream = useCallback((text, langKey, onFinish) => {
    const ttsUrl = `/api/tts/speak?text=${encodeURIComponent(text)}&lang=${langKey}`;
    try {
      const audio = new Audio(ttsUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = onFinish;
      audio.onerror = () => {
        // Fallback to SpeechSynthesis if backend audio stream fails
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const matchedVoice = getBestVoice(langKey);
            const utterance = new SpeechSynthesisUtterance(text);
            if (matchedVoice) utterance.voice = matchedVoice;
            utterance.lang = LANG_MAP[langKey] || 'en-IN';
            utterance.rate = 0.93;
            utterance.pitch = 1.04;
            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = onFinish;
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            return;
          } catch (e) {}
        }
        setIsSpeaking(false);
        audioRef.current = null;
      };

      audio.play().catch((e) => {
        console.warn('Backend Neural Audio stream play catch:', e);
        setIsSpeaking(false);
      });
    } catch (e) {
      console.warn('Backend Neural Audio stream error:', e);
      setIsSpeaking(false);
    }
  }, [getBestVoice]);

  const speakText = useCallback((text, langCode) => {
    if (isMuted || !text || typeof window === 'undefined') return;

    stopSpeaking();

    const rawLang = extractLangStr(langCode || activeLang);
    const langKey = rawLang.toLowerCase();

    const onFinish = () => {
      setIsSpeaking(false);
      audioRef.current = null;
      if (autoListenRef.current && hasSupport) {
        setTimeout(() => {
          startListening();
        }, 500);
      }
    };

    // Play High-Definition Backend Neural Audio Stream (/api/tts/speak)
    playAudioStream(text, langKey, onFinish);
  }, [activeLang, isMuted, stopSpeaking, hasSupport, startListening, playAudioStream]);

  return {
    isListening,
    isSpeaking,
    isMuted,
    autoListen,
    toggleMute,
    toggleAutoListen,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    hasSupport,
    error
  };
}

export default useVoiceInput;

