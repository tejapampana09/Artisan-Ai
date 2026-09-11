import React from 'react';
import { CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

export default function InterviewProgress({ questionCount, maxQuestions = 5, facts = {} }) {
  const factKeys = Object.keys(facts);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-amber-400" />
          Captured Product Facts ({factKeys.length})
        </span>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((num) => (
            <div
              key={num}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                num <= questionCount 
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50 scale-110' 
                  : 'bg-slate-800'
              }`}
              title={`Question ${num} of 5`}
            />
          ))}
        </div>
      </div>

      {factKeys.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {factKeys.map((key) => {
            const item = facts[key];
            const val = typeof item === 'object' ? item.value : item;
            const src = typeof item === 'object' ? item.source : 'ARTISAN_CONFIRMED';
            if (!val) return null;

            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 text-amber-200 px-2.5 py-1 rounded-lg"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <strong className="font-medium capitalize text-slate-400">{key.replace('_', ' ')}:</strong>
                <span className="text-slate-100">{val}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          No confirmed facts captured yet. Answer the assistant to build listing facts.
        </p>
      )}
    </div>
  );
}
