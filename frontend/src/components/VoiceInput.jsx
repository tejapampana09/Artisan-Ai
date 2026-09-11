import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Keyboard, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';

export default function VoiceInput({ 
  language, 
  onSendAnswer, 
  onSubmitAnswer,
  disabled, 
  loading,
  inputText,
  setInputText
}) {
  const { isListening, transcript, setTranscript, startListening, stopListening, hasSupport, error } = useVoiceInput(language);
  const [showTextInput, setShowTextInput] = useState(!hasSupport);
  const [manualText, setManualText] = useState(inputText || '');

  // Keep manualText synced with external transcript or inputText
  useEffect(() => {
    if (transcript) {
      setManualText(transcript);
      if (setInputText) setInputText(transcript);
    }
  }, [transcript, setInputText]);

  useEffect(() => {
    if (inputText !== undefined) {
      setManualText(inputText);
    }
  }, [inputText]);

  const handleToggleRecord = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setManualText(val);
    if (setInputText) setInputText(val);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const finalAnswer = manualText.trim();
    if (!finalAnswer || disabled || loading) return;

    if (isListening) stopListening();

    const handler = onSendAnswer || onSubmitAnswer;
    if (handler) {
      handler(finalAnswer);
    }

    setManualText('');
    setTranscript('');
    if (setInputText) setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isSubmitting = loading || disabled;

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Subtle Glowing Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

      {/* Live Voice Recording Control */}
      <div className="flex flex-col items-center justify-center gap-4 mb-4">
        {hasSupport && !showTextInput && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={isSubmitting}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse ring-8 ring-red-500/30 scale-105' 
                  : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 hover:scale-105 shadow-amber-500/20'
              }`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
            <div className="text-center">
              <span className={`text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full border ${
                isListening 
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' 
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                {isListening ? '🎙️ Listening... Speak Now' : 'Tap Microphone to Speak'}
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Speak clearly in your preferred language. AI will transcribe automatically.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>Voice recognition fallback: Type your response below.</span>
          </div>
        )}
      </div>

      {/* Text Input Form & Controls */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative group">
          <textarea
            value={manualText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here (e.g., 'Made with pure teak wood and natural colors') or press Enter to submit..."
            rows={3}
            disabled={isSubmitting}
            className="w-full bg-slate-950/80 border border-slate-700/80 group-hover:border-amber-500/40 focus:border-amber-400 rounded-2xl p-4 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none transition-all shadow-inner"
          />
          <div className="absolute right-3 bottom-3 text-[10px] text-slate-500 font-mono">
            Press <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">Enter ↵</kbd> to submit
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {hasSupport && (
            <button
              type="button"
              onClick={() => setShowTextInput(!showTextInput)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 transition-all"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              {showTextInput ? 'Switch to Microphone Voice' : 'Switch to Keyboard Text'}
            </button>
          )}

          <button
            type="submit"
            disabled={!manualText.trim() || isSubmitting}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold px-6 py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed ml-auto active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>AI Analyzing Answer...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Answer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
