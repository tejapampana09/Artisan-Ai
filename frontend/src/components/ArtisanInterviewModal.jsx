import React, { useState, useEffect } from 'react';
import { X, Sparkles, Languages, Camera, ArrowRight, IndianRupee, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useInterview, INTERVIEW_STEPS } from '../hooks/useInterview';
import VirtualAssistant from './VirtualAssistant';
import VoiceInput from './VoiceInput';
import InterviewProgress from './InterviewProgress';
import MarketInsights from './MarketInsights';
import PriceRecommendation from './PriceRecommendation';
import ProductReview from './ProductReview';
import useVoiceInput from '../hooks/useVoiceInput';

export default function ArtisanInterviewModal({ isOpen, onClose, onProductCreated }) {
  if (!isOpen) return null;

  const {
    step,
    setStep,
    sessionId,
    sessionData,
    loading,
    error,
    startSession,
    sendAnswer,
    sendExpectedPrice,
    recalculatePrice,
    publishProduct,
  } = useInterview();

  const [selectedLang, setSelectedLang] = useState('te');
  const [photoUrl, setPhotoUrl] = useState('');
  const [categoryHint, setCategoryHint] = useState('');
  const [inputText, setInputText] = useState('');
  const [expectedPriceVal, setExpectedPriceVal] = useState('');
  const [publishedProduct, setPublishedProduct] = useState(null);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    isSpeaking,
    isMuted,
    autoListen,
    toggleMute,
    toggleAutoListen
  } = useVoiceInput({
    language: selectedLang,
  });

  // Keep inputText updated if voice transcript changes
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Speak AI question automatically when step is INTERVIEW
  useEffect(() => {
    if (step === INTERVIEW_STEPS.INTERVIEW && sessionData?.current_question) {
      speakText(sessionData.current_question);
    }
  }, [step, sessionData?.current_question]);

  const handleStart = async (e) => {
    e.preventDefault();
    try {
      await startSession({
        language: selectedLang,
        photo_url: photoUrl || null,
        category_hint: categoryHint || null,
      });
    } catch (err) {
      console.error('Failed to start interview:', err);
    }
  };

  const handleAnswerSubmit = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim()) return;

    try {
      setInputText('');
      await sendAnswer(text.trim());
    } catch (err) {
      console.error('Failed to send answer:', err);
    }
  };

  const handleExpectedPriceSubmit = async (e) => {
    e.preventDefault();
    if (!expectedPriceVal || parseFloat(expectedPriceVal) <= 0) return;

    try {
      await sendExpectedPrice(expectedPriceVal);
    } catch (err) {
      console.error('Failed to send expected price:', err);
    }
  };

  const handlePublish = async (payload) => {
    try {
      const prod = await publishProduct(payload);
      setPublishedProduct(prod);
      setStep('SUCCESS');
      if (onProductCreated) {
        onProductCreated(prod);
      }
    } catch (err) {
      console.error('Failed to publish:', err);
    }
  };

  const languages = [
    { code: 'te', label: 'తెలుగు (Telugu)', hint: 'తెలుగులో సంభాషించండి' },
    { code: 'hi', label: 'हिंदी (Hindi)', hint: 'हिंदी में बात करें' },
    { code: 'ta', label: 'தமிழ் (Tamil)', hint: 'தமிழில் பேசுங்கள்' },
    { code: 'bn', label: 'বাংলা (Bengali)', hint: 'বাংলায় কথা বলুন' },
    { code: 'en', label: 'English', hint: 'Speak in English' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md z-10 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Artisan AI Studio V2
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Gemini Live Voice Mode
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Interactive Multilingual Audio Counselor & Dynamic Pricing Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 flex-1">
          {/* STEP 1: PHOTO & LANGUAGE SELECTION */}
          {step === INTERVIEW_STEPS.PHOTO_LANG && (
            <form onSubmit={handleStart} className="space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-amber-300">
                  Select Your Language & Product Photo
                </h3>
                <p className="text-xs text-slate-400">
                  Choose your native language to converse naturally using voice or text.
                </p>
              </div>

              {/* Language Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-amber-400" /> Preferred Language
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setSelectedLang(l.code)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex justify-between items-center ${
                        selectedLang === l.code
                          ? 'bg-amber-500/10 border-amber-400 text-amber-300 ring-2 ring-amber-500/30'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm">{l.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{l.hint}</div>
                      </div>
                      {selectedLang === l.code && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo & Hint Input */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-400" /> Product Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Initial Product Name or Hint (Optional)
                  </label>
                  <input
                    type="text"
                    value={categoryHint}
                    onChange={(e) => setCategoryHint(e.target.value)}
                    placeholder="e.g. Kalamkari Silk Saree, Kondapalli Toy..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:ring-1 focus:ring-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
                >
                  {loading ? 'Starting Assistant...' : 'Start AI Voice Interview'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ADAPTIVE INTERVIEW */}
          {step === INTERVIEW_STEPS.INTERVIEW && sessionData && (
            <div className="space-y-6">
              <InterviewProgress sessionData={sessionData} />

              <VirtualAssistant
                question={sessionData.current_question}
                language={sessionData.language || selectedLang}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isMuted={isMuted}
                autoListen={autoListen}
                onToggleMute={toggleMute}
                onToggleAutoListen={toggleAutoListen}
                onSpeak={() => speakText(sessionData.current_question)}
                onStopSpeak={stopSpeaking}
                questionCount={sessionData.question_count || 1}
              />

              <VoiceInput
                isListening={isListening}
                onStartListening={startListening}
                onStopListening={stopListening}
                inputText={inputText}
                setInputText={setInputText}
                onSubmitAnswer={() => handleAnswerSubmit()}
                loading={loading}
              />

              {/* Extracted Facts Sidebar / Card */}
              {sessionData.extracted_facts && Object.keys(sessionData.extracted_facts).length > 0 && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Confirmed Facts Gathered So Far
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sessionData.extracted_facts).map(([k, v]) => (
                      <span
                        key={k}
                        className="bg-slate-800/80 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                      >
                        <span className="font-mono text-amber-400 capitalize">{k}:</span>
                        <span>{typeof v === 'object' ? v.value || JSON.stringify(v) : String(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: MARKET RESEARCH INSIGHTS */}
          {step === INTERVIEW_STEPS.MARKET_RESEARCH && sessionData && (
            <div className="space-y-6">
              <InterviewProgress sessionData={sessionData} />

              <MarketInsights sessionData={sessionData} />

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(INTERVIEW_STEPS.EXPECTED_PRICE)}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all"
                >
                  Proceed to Desired Valuation <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: EXPECTED PRICE INPUT */}
          {step === INTERVIEW_STEPS.EXPECTED_PRICE && (
            <form onSubmit={handleExpectedPriceSubmit} className="space-y-6 max-w-xl mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-100">
                  What is your desired expected price?
                </h3>
                <p className="text-xs text-slate-400">
                  Based on your craftsmanship and market research, how much do you want to charge for this piece?
                </p>
              </div>

              <div className="relative max-w-xs mx-auto">
                <IndianRupee className="w-5 h-5 text-amber-400 absolute left-4 top-3.5" />
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={expectedPriceVal}
                  onChange={(e) => setExpectedPriceVal(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-lg font-bold text-amber-300 focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={loading || !expectedPriceVal}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  {loading ? 'Calculating Fair Valuation...' : 'Calculate AI Fair Price'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: FINAL PRICING RECOMMENDATION */}
          {step === INTERVIEW_STEPS.FINAL_PRICING && sessionData?.pricing_recommendation && (
            <div className="space-y-6">
              <InterviewProgress sessionData={sessionData} />

              <PriceRecommendation
                priceData={sessionData.pricing_recommendation}
                onRecalculate={recalculatePrice}
                loading={loading}
              />

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(INTERVIEW_STEPS.REVIEW)}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all"
                >
                  Review Listing & Craft Story <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: PRODUCT REVIEW & EDIT */}
          {step === INTERVIEW_STEPS.REVIEW && (
            <ProductReview
              sessionData={sessionData}
              priceData={sessionData?.pricing_recommendation}
              onPublish={handlePublish}
              onBack={() => setStep(INTERVIEW_STEPS.FINAL_PRICING)}
              loading={loading}
            />
          )}

          {/* STEP 7: SUCCESS CONFIRMATION */}
          {step === 'SUCCESS' && publishedProduct && (
            <div className="text-center py-8 space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-100">
                  Product Published Successfully!
                </h3>
                <p className="text-xs text-slate-400">
                  Your handcrafted masterpiece is now live on the marketplace with AI-verified pricing and craft story.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-4 text-left">
                <img
                  src={publishedProduct.image_url}
                  alt={publishedProduct.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">{publishedProduct.name}</div>
                  <div className="text-xs text-amber-400 font-bold mt-0.5">
                    ₹{Number(publishedProduct.price).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded mt-1 inline-block">
                    {publishedProduct.category}
                  </span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" /> Close & View Products
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
