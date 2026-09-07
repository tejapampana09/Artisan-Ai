import React from 'react';
import { Globe, Check, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const LANGUAGES = [
  { code: 'te', name: 'తెలుగు', label: 'Telugu', region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi', region: 'भारत / North & Central India' },
  { code: 'en', name: 'English', label: 'English', region: 'Global / All Regions' },
  { code: 'ta', name: 'தமிழ்', label: 'Tamil', region: 'தமிழ்நாடு / Tamil Nadu' },
  { code: 'bn', name: 'বাংলা', label: 'Bengali', region: 'পশ্চিমবঙ্গ / West Bengal' },
];

export default function LanguageSelectorModal({ isOpen, onClose }) {
  const { language, setLanguage, isSelectingLanguage, setIsSelectingLanguage } = useLanguage();

  const showModal = isOpen || isSelectingLanguage;
  if (!showModal) return null;

  const handleSelect = (code) => {
    setLanguage(code);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 pb-20 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-indigo-100 flex flex-col overflow-hidden max-h-[85vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-5 flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Native Language Onboarding</span>
            </div>
            <h3 className="text-lg font-extrabold tracking-tight text-white mt-1">
              మీ భాషను ఎంచుకోండి / Select Language
            </h3>
            <p className="text-xs text-indigo-200 leading-relaxed">
              Artisan AI provides step-by-step guidance in your preferred native language.
            </p>
          </div>

          {!isSelectingLanguage && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer relative z-10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Language Options Grid */}
        <div className="p-4 overflow-y-auto space-y-2.5 max-h-[60vh] bg-slate-50">
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100'
                    }`}
                  >
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm flex items-center space-x-2">
                      <span>{lang.name}</span>
                      <span
                        className={`text-[11px] font-medium px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-indigo-500/50 text-indigo-100' : 'text-slate-500 bg-slate-100'
                        }`}
                      >
                        {lang.label}
                      </span>
                    </h4>
                    <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {lang.region}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-7 h-7 rounded-full bg-white text-indigo-700 flex items-center justify-center shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0 text-center">
          <button
            onClick={() => {
              setIsSelectingLanguage(false);
              if (onClose) onClose();
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Continue in {LANGUAGES.find((l) => l.code === language)?.name}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
