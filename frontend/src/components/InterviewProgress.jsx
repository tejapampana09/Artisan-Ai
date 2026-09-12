import React from 'react';
import { CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

export default function InterviewProgress({ questionCount, maxQuestions = 4, facts = {}, sessionData }) {
  const currentCount = questionCount ?? sessionData?.question_count ?? 1;
  const currentMax = maxQuestions ?? 4;
  
  let currentFacts = facts;
  if (sessionData?.product_facts) {
    currentFacts = typeof sessionData.product_facts === 'string' 
      ? (() => { try { return JSON.parse(sessionData.product_facts); } catch { return {}; } })() 
      : sessionData.product_facts;
  }
  const factKeys = Object.keys(currentFacts || {});

  const steps = [
    { num: 1, label: 'కళ & ముడిసరుకు (Craft & Materials)' },
    { num: 2, label: 'పద్ధతి & సమయం (Technique & Time)' },
    { num: 3, label: 'కొలతలు & రంగులు (Dimensions & Colors)' },
    { num: 4, label: 'సాంస్కృతిక కథ (Cultural Story)' }
  ];

  return (
    <div className="bg-slate-900/80 border border-amber-500/20 rounded-2xl p-4 shadow-lg backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            ఇంటర్వ్యూ పురోగతి / Interview Progress (ప్రశ్న {Math.min(currentCount, currentMax)}/{currentMax})
          </span>
        </div>

        {/* 4 Step Progress Indicators */}
        <div className="flex items-center gap-2">
          {steps.map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                s.num === currentCount
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40 font-bold scale-105 shadow-sm'
                  : s.num < currentCount
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800/80 text-slate-500 border border-slate-700/60'
              }`}
              title={s.label}
            >
              {s.num < currentCount ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <span>#{s.num}</span>
              )}
              <span className="hidden md:inline">{s.label.split('(')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Captured Verified Facts */}
      {factKeys.length > 0 ? (
        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>ధృవీకరించబడిన ముఖ్యాంశాలు / Verified Captured Facts ({factKeys.length}):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {factKeys.map((key) => {
              const item = currentFacts[key];
              const val = typeof item === 'object' ? item.value : item;
              if (!val) return null;

              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 text-xs bg-slate-950 border border-amber-500/30 text-slate-100 px-3 py-1.5 rounded-xl shadow-sm hover:border-amber-400/60 transition-colors"
                >
                  <strong className="font-semibold capitalize text-amber-400">{key.replace('_', ' ')}:</strong>
                  <span>{String(val)}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/60">
          అనన్య అడిగే ప్రశ్నలకు సమాధానమివ్వండి; మీ కళా వివరాలు ఇక్కడ ప్రత్యక్షంగా నమోదు చేయబడతాయి. (Answer Ananya's questions to capture verified facts).
        </p>
      )}
    </div>
  );
}
