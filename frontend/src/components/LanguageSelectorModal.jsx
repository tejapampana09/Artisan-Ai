import React from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';

const LANGUAGES = [
  { code: 'te', name: 'తెలుగు', label: 'Telugu', flag: '🇮🇳', region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi', flag: '🇮🇳', region: 'उत्तर एवं मध्य भारत' },
  { code: 'en', name: 'English', label: 'English', flag: '🇬🇧', region: 'Global / All Regions' },
  { code: 'ta', name: 'தமிழ்', label: 'Tamil', flag: '🇮🇳', region: 'தமிழ்நாடு' },
  { code: 'bn', name: 'বাংলা', label: 'Bengali', flag: '🇮🇳', region: 'पश्चिमबंग / West Bengal' },
];

export default function LanguageSelectorModal({ isOpen, onClose }) {
  const { language, setLanguage, isSelectingLanguage, setIsSelectingLanguage, t } = useLanguage();

  const showModal = isOpen || isSelectingLanguage;
  if (!showModal) return null;

  const handleSelect = (code) => {
    setLanguage(code);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 notranslate" translate="no">
      <div className="bg-[#FAF7F2] rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 flex flex-col overflow-hidden max-h-[90vh] my-auto animate-in zoom-in-95 duration-200 notranslate" translate="no">
        {/* Header */}
        <div className="p-6 pb-3 text-center relative shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Step 1 of 3</span>
            {onClose && (
              <button onClick={() => { setIsSelectingLanguage(false); if (onClose) onClose(); }} className="text-xs font-bold text-stone-400 hover:text-stone-700">
                Skip
              </button>
            )}
          </div>
          <h3 className="text-2xl font-extrabold text-[#2C1A0E]">
            Choose Your Language
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Let's get started in your preferred language
          </p>
        </div>

        {/* Language Options List */}
        <div className="p-5 pt-2 overflow-y-auto space-y-3 max-h-[60vh]">
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <div
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`p-3.5 px-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] ${
                  isSelected
                    ? 'bg-white border-[#4A2E1B] shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-amber-700/40'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-lg shadow-inner">
                    {lang.flag}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-[#2C1A0E] flex items-center space-x-2 notranslate" translate="no">
                      <span className="notranslate" translate="no">{lang.name}</span>
                      <span className="text-xs font-medium text-stone-400 notranslate" translate="no">
                        {lang.label}
                      </span>
                    </h4>
                  </div>
                </div>

                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#4A2E1B] bg-[#4A2E1B]' : 'border-stone-300'}`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Button */}
        <div className="p-5 pt-2 bg-[#FAF7F2] border-t border-stone-200/50 shrink-0 text-center">
          <button
            onClick={() => {
              setLanguage(language || 'te');
              setIsSelectingLanguage(false);
              if (onClose) onClose();
            }}
            className="w-full py-3.5 bg-[#4A2E1B] hover:bg-[#3D2314] active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Continue →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
