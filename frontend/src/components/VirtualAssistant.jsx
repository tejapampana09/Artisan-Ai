import React from 'react';
import { Volume2, VolumeX, Sparkles, Mic, MicOff, Radio, Square } from 'lucide-react';

export default function VirtualAssistant({
  question,
  language,
  isSpeaking,
  isListening,
  isMuted,
  autoListen,
  onToggleMute,
  onToggleAutoListen,
  onSpeak,
  onStopSpeak,
  questionCount
}) {
  const langLabels = {
    te: 'తెలుగు (Telugu)',
    hi: 'हिंदी (Hindi)',
    ta: 'தமிழ் (Tamil)',
    bn: 'বাংলা (Bengali)',
    en: 'English'
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-purple-950/40 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden mb-6 backdrop-blur-md">
      {/* Background Gemini Ambient Glowing Orbs */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
        
        {/* Gemini Live Dynamic Audio Orb / Avatar Container */}
        <div className="relative flex-shrink-0 mx-auto md:mx-0">
          {/* Animated Pulsing Outer Aura when Speaking or Listening */}
          {(isSpeaking || isListening) && (
            <div className={`absolute -inset-3 rounded-full blur-md opacity-75 animate-ping ${
              isSpeaking ? 'bg-gradient-to-r from-amber-400 to-purple-500' : 'bg-gradient-to-r from-emerald-400 to-cyan-500'
            }`}></div>
          )}

          <div className={`w-20 h-20 rounded-full p-1 transition-all duration-300 shadow-xl flex items-center justify-center ${
            isSpeaking 
              ? 'bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-400 ring-4 ring-amber-400/40 scale-105'
              : isListening
              ? 'bg-gradient-to-tr from-emerald-400 via-teal-400 to-cyan-500 ring-4 ring-emerald-400/40 scale-105'
              : 'bg-gradient-to-tr from-amber-500/40 via-purple-600/40 to-slate-800'
          }`}>
            <div className="w-full h-full bg-slate-950 rounded-full flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
              
              {/* Voice Sound Wave EQ Animation when Speaking */}
              {isSpeaking ? (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-6 bg-amber-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-9 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-1.5 h-11 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  <span className="w-1.5 h-8 bg-amber-300 rounded-full animate-bounce [animation-delay:450ms]"></span>
                  <span className="w-1.5 h-5 bg-amber-400 rounded-full animate-bounce [animation-delay:600ms]"></span>
                </div>
              ) : isListening ? (
                /* Glowing Mic Pulse when Listening */
                <div className="flex flex-col items-center justify-center">
                  <Mic className="w-7 h-7 text-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-bold text-emerald-300 tracking-wider uppercase mt-0.5">Listening</span>
                </div>
              ) : (
                /* Gemini Live Orb Default */
                <div className="flex flex-col items-center justify-center">
                  <Sparkles className="w-7 h-7 text-amber-400 animate-pulse" />
                </div>
              )}
            </div>
          </div>

          {/* Status Indicator Badge */}
          <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-slate-950 shadow-md ${
            isSpeaking ? 'bg-amber-400' : isListening ? 'bg-emerald-400 animate-ping' : 'bg-purple-500'
          }`}>
            <Radio className="w-3.5 h-3.5 text-slate-950" />
          </div>
        </div>

        {/* Speech & Persona Content */}
        <div className="flex-1 text-left w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Ananya (Gemini Live Craft Friend)
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                {langLabels[language] || 'Telugu'}
              </span>
            </div>

            {/* Live Status Pill */}
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <span className="text-xs font-semibold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Volume2 className="w-3.5 h-3.5" /> Speaking Live...
                </span>
              )}
              {isListening && (
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Mic className="w-3.5 h-3.5" /> Listening to You...
                </span>
              )}
              {questionCount && (
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                  Step {questionCount}/5
                </span>
              )}
            </div>
          </div>

          {/* Speech Text Bubble */}
          <div className="text-base md:text-lg font-medium text-slate-100 leading-relaxed mb-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 shadow-inner">
            "{question || "నమస్కారమండి! నేను అనన్యను. మీ అద్భుతమైన కళారాధన గురించి మాట్లాడటం నాకెంతో సంతోషం."}"
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {onSpeak && question && (
              <button
                type="button"
                onClick={isSpeaking ? onStopSpeak : onSpeak}
                className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl border font-semibold transition-all shadow-sm ${
                  isSpeaking
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" /> Stop Speaking Voice
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-amber-400" /> Replay Voice Response
                  </>
                )}
              </button>
            )}

            {onToggleAutoListen && (
              <button
                type="button"
                onClick={onToggleAutoListen}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  autoListen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}
                title="Hands-free mode automatically turns on mic after Ananya speaks"
              >
                {autoListen ? (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-400" /> Hands-Free Call Mode: ON
                  </>
                ) : (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-slate-400" /> Hands-Free Call Mode: OFF
                  </>
                )}
              </button>
            )}

            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  isMuted
                    ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    : 'bg-slate-800/80 text-amber-300 border-amber-500/30'
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-400" /> Voice Muted (Text Only)
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-amber-400" /> Audio Active
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

