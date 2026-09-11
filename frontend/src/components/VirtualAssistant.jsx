import React, { useState } from 'react';
import { 
  Volume2, VolumeX, Sparkles, Mic, MicOff, Radio, Square, 
  Keyboard, Send, PhoneOff, RefreshCw, MessageSquare 
} from 'lucide-react';

export default function VirtualAssistant({
  question,
  language,
  isSpeaking,
  isListening,
  isMuted,
  autoListen,
  isConnected,
  liveTranscript,
  questionCount,
  onToggleMute,
  onToggleAutoListen,
  onSpeak,
  onStopSpeak,
  onSendAnswer,
  onEndCall,
  loading
}) {
  const [showTextInput, setShowTextInput] = useState(false);
  const [inputText, setInputText] = useState('');

  const langLabels = {
    te: 'తెలుగు (Telugu)',
    hi: 'हिंदी (Hindi)',
    ta: 'தமிழ் (Tamil)',
    bn: 'বাংলা (Bengali)',
    en: 'English'
  };

  const handleTextSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;
    if (onSendAnswer) {
      onSendAnswer(inputText.trim());
    }
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  return (
    <div className="bg-slate-950 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl relative mb-6 backdrop-blur-xl flex flex-col min-h-[460px]">
      {/* Background Gemini Ambient Glowing Orbs */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      {/* Screen 5 Top Navigation Bar */}
      <div className="relative z-20 px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-400 p-0.5 shadow-md">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" 
                alt="Ananya"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                Ananya
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {langLabels[language] || 'Telugu'}
              </span>
            </div>
            <p className="text-xs text-slate-400">AI Craft Counselor • Live Interview</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> 🟢 LIVE
            </span>
          )}
          {questionCount && (
            <span className="text-xs font-mono text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              Question {questionCount}/4
            </span>
          )}
        </div>
      </div>

      {/* Main Video Call Viewport */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center z-10 min-h-[300px]">
        {/* Animated Visualizer Glow Rings around Avatar */}
        <div className="relative mb-6">
          {(isSpeaking || isListening) && (
            <div className={`absolute -inset-4 rounded-full blur-xl opacity-70 animate-ping ${
              isSpeaking 
                ? 'bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400' 
                : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
            }`}></div>
          )}

          <div className={`w-32 h-32 md:w-36 md:h-36 rounded-full p-1.5 transition-all duration-500 shadow-2xl mx-auto ${
            isSpeaking
              ? 'bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-400 ring-8 ring-amber-400/30 scale-105'
              : isListening
              ? 'bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 ring-8 ring-emerald-400/30 scale-105'
              : 'bg-gradient-to-tr from-amber-500/40 via-purple-600/40 to-slate-800 ring-4 ring-slate-800'
          }`}>
            <div className="w-full h-full bg-slate-950 rounded-full overflow-hidden relative flex items-center justify-center border-2 border-slate-900">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop" 
                alt="Ananya AI Video Guide" 
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />

              {/* Speaking Voice EQ Overlay */}
              {isSpeaking && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center gap-1.5">
                  <span className="w-2 h-10 bg-amber-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-14 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-16 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="w-2 h-12 bg-amber-300 rounded-full animate-bounce [animation-delay:450ms]"></span>
                  <span className="w-2 h-8 bg-amber-400 rounded-full animate-bounce [animation-delay:600ms]"></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Overlay Caption Box (Screen 5 Closed Captions) */}
        <div className="w-full max-w-2xl mx-auto bg-slate-900/85 backdrop-blur-xl border border-slate-700/70 rounded-2xl p-5 shadow-2xl text-left transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              Ananya Live Question / Closed Caption
            </span>
            {isSpeaking && (
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
                Speaking audio...
              </span>
            )}
            {isListening && (
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full animate-pulse">
                Mic active...
              </span>
            )}
          </div>

          <div className="text-base md:text-lg font-semibold text-slate-100 leading-relaxed">
            "{liveTranscript || question || "నమస్కారమండి! నేను అనన్యను. మీ అద్భుతమైన కళారాధన గురించి మాట్లాడటం నాకెంతో సంతోషం."}"
          </div>
        </div>

        {/* Inline Text Response Form (Toggled via Keyboard Button) */}
        {showTextInput && (
          <form onSubmit={handleTextSubmit} className="w-full max-w-2xl mx-auto mt-4 transition-all">
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response to Ananya here and press Enter..."
                rows={2}
                disabled={loading}
                className="w-full bg-slate-950 border border-amber-500/50 rounded-2xl p-4 pr-14 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="absolute right-3 bottom-3 p-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Screen 5 Circular Bottom Control Bar */}
      <div className="relative z-20 px-6 py-4 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md flex items-center justify-center gap-4">
        {/* Mic Toggle Button */}
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isMuted
                ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}

        {/* Barge-in / Interrupt Button */}
        {isSpeaking && onStopSpeak && (
          <button
            type="button"
            onClick={onStopSpeak}
            className="w-12 h-12 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-lg ring-4 ring-rose-500/30 animate-pulse"
            title="Interrupt Ananya Speaking"
          >
            <Square className="w-5 h-5 fill-white text-white" />
          </button>
        )}

        {/* Replay Audio Button */}
        {!isSpeaking && onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            className="w-12 h-12 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-all shadow-md"
            title="Replay Question Audio"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        )}

        {/* Keyboard Input Toggle Button */}
        <button
          type="button"
          onClick={() => setShowTextInput(!showTextInput)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
            showTextInput 
              ? 'bg-amber-500 text-slate-950 font-bold' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
          title="Toggle Text Keyboard Response"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* End Call / Finish Interview Button */}
        <button
          type="button"
          onClick={onEndCall || (() => {})}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/40 transition-all hover:scale-105 active:scale-95"
          title="End Live Interview Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
