import React, { useState, useEffect } from 'react';
import { 
  Volume2, Sparkles, Mic, MicOff, Radio, Square, 
  Send, PhoneOff, MessageSquare, Loader2
} from 'lucide-react';

export default function VirtualAssistant({
  question,
  language,
  isSpeaking,
  isListening,
  isMuted,
  isConnected,
  isSimulated,
  liveTranscript,
  speechTranscript,
  questionCount,
  onToggleMute,
  onSpeak,
  onStopSpeak,
  onStartListen,
  onStopListen,
  onSendAnswer,
  onEndCall,
  loading
}) {
  const [inputText, setInputText] = useState('');

  // Sync speech recognition transcript into the input box as the user speaks
  useEffect(() => {
    if (speechTranscript) {
      setInputText(speechTranscript);
    }
  }, [speechTranscript]);

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

  const handleMicToggle = () => {
    if (isListening) {
      if (onStopListen) onStopListen();
    } else {
      if (onStartListen) onStartListen();
    }
  };

  return (
    <div className="bg-slate-950 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl relative mb-6 backdrop-blur-xl flex flex-col min-h-[500px]">
      {/* Background Gemini Ambient Glowing Orbs */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      {/* Top Header Status Bar */}
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

        {/* Live Status Badges */}
        <div className="flex items-center gap-2">
          {isConnected && !isSimulated && (
            <span className="text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> 🟢 LIVE VOICE
            </span>
          )}
          {isConnected && isSimulated && (
            <span className="text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> 🟡 TEXT MODE
            </span>
          )}
          {questionCount && (
            <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40">
              ప్రశ్న {questionCount} / 4
            </span>
          )}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
        {/* Visualizer Glow Rings around Avatar */}
        <div className="relative mb-5">
          {(isSpeaking || isListening) && (
            <div className={`absolute -inset-4 rounded-full blur-xl opacity-70 animate-ping ${
              isSpeaking 
                ? 'bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-400' 
                : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
            }`}></div>
          )}

          <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full p-1.5 transition-all duration-500 shadow-2xl mx-auto ${
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
                className="w-full h-full object-cover"
              />

              {/* Speaking Voice EQ Animation */}
              {isSpeaking && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center gap-1.5">
                  <span className="w-2 h-8 bg-amber-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-12 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-14 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="w-2 h-10 bg-amber-300 rounded-full animate-bounce [animation-delay:450ms]"></span>
                  <span className="w-2 h-6 bg-amber-400 rounded-full animate-bounce [animation-delay:600ms]"></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Question Closed Caption Box */}
        <div className="w-full max-w-2xl mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-5 shadow-2xl text-left transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              అనన్య ప్రశ్న / Official Question ({questionCount || 1}/4)
            </span>
            {isSpeaking && (
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> మాట్లాడుతోంది...
              </span>
            )}
            {isListening && (
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <Mic className="w-3 h-3" /> వింటోంది (Listening)...
              </span>
            )}
            {loading && (
              <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/20 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> విశ్లేషిస్తోంది...
              </span>
            )}
          </div>

          <div className="text-base md:text-lg font-semibold text-slate-100 leading-relaxed">
            "{question || "నమస్కారమండి! నేను అనన్యను. మీ అద్భుతమైన కళారాధన గురించి మాట్లాడటం నాకెంతో సంతోషం."}"
          </div>

          {/* Spoken subtitle stream */}
          {isSpeaking && liveTranscript && liveTranscript !== question && (
            <div className="text-xs text-amber-300/90 italic mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              <span>వాయిస్: "{liveTranscript}"</span>
            </div>
          )}
        </div>

        {/* ALWAYS-VISIBLE Interactive Response Box */}
        <form onSubmit={handleTextSubmit} className="w-full max-w-2xl mx-auto mt-4 transition-all">
          <div className="relative bg-slate-900/90 border-2 border-amber-500/40 hover:border-amber-400/80 rounded-2xl p-2 shadow-xl focus-within:border-amber-400 transition-all flex items-center gap-2">
            {/* Mic Speech Button */}
            <button
              type="button"
              onClick={handleMicToggle}
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isListening
                  ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'
              }`}
              title={isListening ? "Stop Voice Recording" : "Tap to Speak your answer"}
            >
              {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-slate-400" />}
            </button>

            {/* Answer Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={isListening ? "మీరు మాట్లాడుతున్నారు... (Listening to your voice...)" : "మీ సమాధానాన్ని ఇక్కడ చెప్పండి లేదా టైప్ చేయండి..."}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>పంపుతోంది...</span>
                </>
              ) : (
                <>
                  <span>సమాధానం పంపండి</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Screen 5 Circular Bottom Control Bar */}
      <div className="relative z-20 px-6 py-4 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md flex items-center justify-center gap-4">
        {/* Replay Question Audio Button */}
        {onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            className="w-12 h-12 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center transition-all shadow-md cursor-pointer"
            title="ప్రశ్నను మళ్లీ వినండి (Replay Audio)"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        )}

        {/* Barge-in / Interrupt Button */}
        {isSpeaking && onStopSpeak && (
          <button
            type="button"
            onClick={onStopSpeak}
            className="w-12 h-12 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-lg ring-4 ring-rose-500/30 animate-pulse cursor-pointer"
            title="అనన్య మాట్లాడటం ఆపండి (Stop Speaking)"
          >
            <Square className="w-5 h-5 fill-white text-white" />
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("ఇంటర్వ్యూ పూర్తి చేసి మార్కెట్ పరిశోధనకు వెళ్లాలా? (Finish and proceed to Market Research?)")) {
              if (onEndCall) onEndCall();
            }
          }}
          className="w-12 h-12 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          title="ఇంటర్వ్యూ ముగించండి (End Call)"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

