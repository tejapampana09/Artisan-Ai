import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Keyboard, MessageSquare, AlertCircle } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';

export default function VoiceInput({ language, onSendAnswer, disabled }) {
  const { isListening, transcript, setTranscript, startListening, stopListening, hasSupport, error } = useVoiceInput(language);
  const [showTextInput, setShowTextInput] = useState(!hasSupport);
  const [manualText, setManualText] = useState('');

  useEffect(() => {
    if (transcript) {
      setManualText(transcript);
    }
  }, [transcript]);

  const handleToggleRecord = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const finalAnswer = manualText.trim();
    if (!finalAnswer || disabled) return;
    if (isListening) stopListening();
    onSendAnswer(finalAnswer);
    setManualText('');
    setTranscript('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
      {/* Live Voice Recording Control */}
      <div className="flex flex-col items-center justify-center gap-4 mb-4">
        {hasSupport && !showTextInput ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={disabled}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse ring-8 ring-red-500/30' 
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:scale-105'
              }`}
            >
              {isListening ? (
                <MicOff className="w-9 h-9" />
              ) : (
                <Mic className="w-9 h-9" />
              )}
            </button>
            <span className="text-xs font-medium text-slate-300">
              {isListening ? '🎙️ Listening... Speak naturally in your language' : 'Tap Microphone to Speak'}
            </span>
          </div>
        ) : null}

        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Voice input unavailable. Use text fallback below.</span>
          </div>
        )}
      </div>

      {/* Text Fallback & Answer Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Type your answer here or speak using microphone..."
            rows={2}
            disabled={disabled}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-none"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {hasSupport && (
            <button
              type="button"
              onClick={() => setShowTextInput(!showTextInput)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              {showTextInput ? 'Switch to Microphone Voice' : 'Switch to Keyboard Text'}
            </button>
          )}

          <button
            type="submit"
            disabled={!manualText.trim() || disabled}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
          >
            <Send className="w-4 h-4" />
            Submit Answer
          </button>
        </div>
      </form>
    </div>
  );
}
