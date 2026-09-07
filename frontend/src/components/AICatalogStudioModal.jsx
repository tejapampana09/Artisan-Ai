import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Sparkles, Image as ImageIcon, CheckCircle2, 
  Layers, Volume2, Globe, ShieldCheck, ArrowRight, RefreshCw, Wand2,
  Camera, Upload, Trash2
} from 'lucide-react';
import { processAICatalog, approveAndPublishAICatalog } from '../api';
import { useOffline } from '../context/OfflineContext';
import { useNotification } from '../context/NotificationContext';

const SAMPLE_PHOTOS = [
  {
    name: 'Kalamkari Dupatta',
    category: 'Kalamkari',
    url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
    te: 'ఇది మచిలీపట్నం కలంకారి చేతితో వేసిన సిల్క్ దుపట్టా. సహజ కూరగాయల రంగులతో 10 రోజులు శ్రమించి వేశాం.',
    hi: 'यह मछलीपट्टनम कलमकारी रेशम दुपट्टा है। प्राकृतिक रंगों से हाथ से बनाया गया है।',
    en: 'This is a hand-painted Machilipatnam Kalamkari silk dupatta made using 100% natural organic dyes.'
  },
  {
    name: 'Channapatna Wooden Toy',
    category: 'Wooden Toys',
    url: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80',
    te: 'ఇది చెక్కతో చేసిన సాంప్రదాయ చెన్నపట్న బొమ్మ. పిల్లలకు సురక్షితమైన సహజ రంగులు వాడాము.',
    hi: 'यह पारंपरिक चन्नापटना लकड़ी का खिलौना है, बच्चों के लिए प्राकृतिक लाख रंगों से सुरक्षित बना है।',
    en: 'This is a traditional Channapatna wooden rolling toy made from ivory wood and non-toxic vegetable lacquer.'
  },
  {
    name: 'Jaipur Blue Pottery Bowl',
    category: 'Blue Pottery',
    url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80',
    te: 'ఇది జైపూర్ బ్లూ పాట్టరీ డెకరేటివ్ బౌల్. క్వార్ట్జ్ రాయితో తయారుచేసి సహజ కోబాల్ట్ నీలి రంగు వేశాం.',
    hi: 'यह जयपुर ब्लू पॉटरी की हस्तनिर्मित सजावटी कटोरी है, जिसमें कोबाल्ट रंग का उपयोग किया गया है।',
    en: 'This is an authentic Jaipur blue pottery decorative ceramic bowl glazed with natural cobalt and quartz.'
  },
  {
    name: 'Bidriware Silver Plate',
    category: 'Bidriware',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    te: 'ఇది బిద్రి వెండి చెక్కడపు ప్లేట్. బిదర్ కోట మట్టితో నలుపు రంగు తెచ్చి స్వచ్ఛమైన వెండి వైర్ అద్దాము.',
    hi: 'यह बीदरीवेयर का शुद्ध चांदी के तारों से जड़ा हुआ सजावटी बर्तन है, बीदर के किले की मिट्टी से काला किया गया है।',
    en: 'This is an imperial Bidriware ornamental vessel with 99.9% pure silver wire inlay on oxidized zinc alloy.'
  }
];

const LANGUAGES = [
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
];

export default function AICatalogStudioModal({ isOpen, onClose, onPublished }) {
  const { isOffline, queueProductDraft } = useOffline();
  const notify = useNotification();
  
  const [step, setStep] = useState('INPUT'); // 'INPUT' | 'PROCESSING' | 'REVIEW'
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedLang, setSelectedLang] = useState('te');
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [costs, setCosts] = useState({ material: '', labour: '', packaging: '' });
  const [aiDraft, setAiDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imgErrorOriginal, setImgErrorOriginal] = useState(false);
  const [imgErrorEnhanced, setImgErrorEnhanced] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const compressImage = (file, maxWidth = 1000, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(event.target.result);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    if (!dataUrl) return;
    setCustomImageUrl(dataUrl);
    setSelectedPhoto(null);
    setImgErrorOriginal(false);
    setImgErrorEnhanced(false);
    if (aiDraft) {
      setAiDraft((prev) => ({
        ...prev,
        image_url: dataUrl,
        enhanced_image_url: dataUrl
      }));
    }
    if (e.target) e.target.value = '';
  };

  // Sync sample prompt when photo or language changes
  const handlePhotoSelect = (p) => {
    if (selectedPhoto?.name === p.name) {
      setSelectedPhoto(null);
      setCustomImageUrl('');
    } else {
      setSelectedPhoto(p);
      setCustomImageUrl(p.url);
      const sample = p[selectedLang] || p.en;
      if (!voiceText.trim()) {
        setVoiceText(sample);
      }
    }
  };

  const handleLangSelect = (code) => {
    setSelectedLang(code);
    if (selectedPhoto && (!voiceText.trim() || Object.values(selectedPhoto).includes(voiceText))) {
      const sample = selectedPhoto[code] || selectedPhoto.en;
      if (sample) setVoiceText(sample);
    }
  };

  // Simulated & Web Speech recognition
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsRecording(!isRecording);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLang === 'te' ? 'te-IN' : selectedLang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;

      if (!isRecording) {
        setIsRecording(true);
        recognition.start();
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setVoiceText(transcript);
          setIsRecording(false);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
      } else {
        recognition.stop();
        setIsRecording(false);
      }
    } catch (e) {
      setIsRecording(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!voiceText.trim() && !selectedPhoto && !customImageUrl.trim()) {
      notify.warning('Please speak or type a craft description, or select an inspiration craft.');
      return;
    }
    setStep('PROCESSING');
    setLoading(true);
    setImgErrorOriginal(false);
    setImgErrorEnhanced(false);

    const mat = Number(costs.material) || 0;
    const lab = Number(costs.labour) || 0;
    const pkg = Number(costs.packaging) || 0;
    const effectiveImg = customImageUrl.trim() || selectedPhoto?.url || '';
    const effectiveCat = selectedPhoto?.category || null;

    if (isOffline) {
      // Zero network dependency local processing in rural offline mode
      setTimeout(() => {
        const costBasis = mat + lab + pkg;
        const minFair = costBasis > 0 ? Math.round(costBasis * 1.20) : null;
        const rawTitle = voiceText.trim().split('\n')[0].slice(0, 50) || (selectedPhoto ? selectedPhoto.name : 'Craft Draft (Pending Title)');
        const offlineDraft = {
          title: rawTitle,
          category: effectiveCat || 'Handcrafted',
          materials: '',
          description: voiceText.trim() || '',
          craft_story: '',
          suggested_price: costBasis > 0 ? Math.round(costBasis * 1.40) : null,
          min_fair_price: minFair,
          pricing_available: costBasis > 0,
          pricing_source: costBasis > 0 ? 'COST_PLUS_MARGIN' : 'AWAITING_ARTISAN_INPUT',
          notice: costBasis > 0 ? 'Saved locally in rural offline mode.' : 'Saved locally in rural offline mode. Cost inputs omitted; please set selling price manually.',
          material_cost: mat || null,
          labour_cost: lab || null,
          packaging_cost: pkg || null,
          min_margin_pct: 0.20,
          image_url: effectiveImg,
          enhanced_image_url: effectiveImg,
          source: 'MANUAL_DRAFT',
          is_live_ai: false,
          language_detected: selectedLang
        };
        setAiDraft(offlineDraft);
        setStep('REVIEW');
        setLoading(false);
      }, 600);
      return;
    }

    try {
      const res = await processAICatalog({
        voice_description: voiceText.trim(),
        language: selectedLang,
        image_url: effectiveImg,
        category_hint: effectiveCat,
        material_cost: mat || null,
        labour_cost: lab || null,
        packaging_cost: pkg || null
      });
      setAiDraft(res);
      setStep('REVIEW');
    } catch (err) {
      notify.error('AI processing failed: ' + err.message);
      setStep('INPUT');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftChange = (field, val) => {
    setAiDraft((prev) => ({ ...prev, [field]: val }));
  };

  const handleApproveAndPublish = async () => {
    const finalPrice = Number(aiDraft.suggested_price);
    if (!finalPrice || finalPrice <= 0) {
      notify.warning('Please enter a valid selling price before publishing.');
      return;
    }

    setPublishing(true);
    if (isOffline) {
      queueProductDraft({
        title: aiDraft.title,
        category: aiDraft.category,
        materials: aiDraft.materials,
        description: aiDraft.description,
        craft_story: aiDraft.craft_story,
        price: finalPrice,
        stock: 5,
        material_cost: aiDraft.material_cost,
        labour_cost: aiDraft.labour_cost,
        packaging_cost: aiDraft.packaging_cost,
        min_margin_pct: 0.20,
        image_url: aiDraft.image_url,
        enhanced_image_url: aiDraft.enhanced_image_url,
        status: 'DRAFT'
      });
      onPublished(`Saved "${aiDraft.title}" to local device queue (Pending Cloud Sync)!`);
      setPublishing(false);
      onClose();
      return;
    }

    try {
      await approveAndPublishAICatalog({
        title: aiDraft.title,
        category: aiDraft.category,
        materials: aiDraft.materials,
        description: aiDraft.description,
        craft_story: aiDraft.craft_story,
        price: finalPrice,
        stock: 5,
        material_cost: aiDraft.material_cost,
        labour_cost: aiDraft.labour_cost,
        packaging_cost: aiDraft.packaging_cost,
        min_margin_pct: 0.20,
        image_url: aiDraft.image_url,
        enhanced_image_url: aiDraft.enhanced_image_url,
        status: 'PUBLISHED'
      });
      onPublished(`Successfully published "${aiDraft.title}" to catalog!`);
      onClose();
    } catch (err) {
      notify.error('Approval failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Voice-First AI Smart Cataloging Studio</h3>
              <p className="text-xs text-slate-500">Capture photo + Speak in native language → AI Catalog Draft</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Stage Product Lifecycle State Machine */}
        <div className="pt-3 pb-1 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className={`px-2 py-0.5 rounded-full ${step === 'INPUT' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600'}`}>
              1. DRAFT
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${step === 'PROCESSING' ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              2. AI_PROCESSING
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${step === 'REVIEW' && !publishing ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-slate-100 text-slate-600'}`}>
              3. AI_GENERATED
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${publishing ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              4. APPROVED
            </span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              5. PUBLISHED
            </span>
          </div>
        </div>

        {/* STEP 1: Input Flow */}
        {step === 'INPUT' && (
          <div className="mt-4 space-y-5">
            {/* 1. Craft Photo Upload / Camera & Optional Inspiration */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <span>1. Craft Photo (Camera Capture or File Upload)</span>
                </label>
                {customImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomImageUrl('');
                      setSelectedPhoto(null);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              {/* Hidden File & Camera Inputs */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageFile}
              />

              {/* Action Buttons & Preview Box */}
              {customImageUrl ? (
                <div className="mb-3 p-3 rounded-xl border border-amber-300 bg-amber-50/60 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <img
                      src={customImageUrl}
                      alt="Selected Craft"
                      className="w-16 h-16 rounded-lg object-cover border border-amber-200 shrink-0 shadow-xs"
                      onError={() => setImgErrorOriginal(true)}
                    />
                    <div className="truncate">
                      <div className="flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800">
                          {selectedPhoto ? selectedPhoto.name : 'Craft Photo Attached'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        Ready for AI multimodal cataloging and studio enhancement
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                      title="Retake photo using phone camera"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                      title="Upload different image file"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span className="hidden sm:inline">Upload</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/70 transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 group-hover:scale-110 flex items-center justify-center mb-1.5 transition-transform shadow-2xs">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Take Photo (Camera)</span>
                    <span className="text-[10px] text-slate-500">Capture with phone camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-amber-200 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 transition-all cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 group-hover:scale-110 flex items-center justify-center mb-1.5 transition-transform shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Upload Image File</span>
                    <span className="text-[10px] text-slate-500">Choose from gallery or files</span>
                  </button>
                </div>
              )}

              {/* Optional URL input & Inspiration Cards */}
              <div className="mt-2">
                <input
                  type="text"
                  value={customImageUrl.startsWith('data:') ? '' : customImageUrl}
                  onChange={(e) => {
                    setCustomImageUrl(e.target.value);
                    if (selectedPhoto && selectedPhoto.url !== e.target.value) {
                      setSelectedPhoto(null);
                    }
                  }}
                  placeholder={customImageUrl.startsWith('data:') ? "Photo attached from camera / file upload" : "Or paste image web link (URL)..."}
                  disabled={customImageUrl.startsWith('data:')}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 mb-2 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Or click an inspiration craft below:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SAMPLE_PHOTOS.map((p) => (
                    <div
                      key={p.name}
                      onClick={() => handlePhotoSelect(p)}
                      className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                        selectedPhoto?.name === p.name ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <img src={p.url} alt={p.name} className="w-full h-18 object-cover" />
                      <div className="p-1 bg-white text-center">
                        <span className="text-[11px] font-semibold text-slate-800 truncate block">{p.name}</span>
                        <span className="text-[9px] text-amber-600 font-medium">Sample</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Voice Input & Language */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Volume2 className="w-4 h-4 text-indigo-600" />
                  <span>2. Speak Product Details in Your Native Language</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedLang}
                    onChange={(e) => handleLangSelect(e.target.value)}
                    className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-500"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Voice recording button & text container */}
              <div className="relative">
                <textarea
                  rows="3"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="Click mic and describe your craft: materials, days taken, heritage technique..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 pr-14 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white leading-relaxed"
                />
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`absolute right-3 top-3 p-2 rounded-xl transition-all shadow-xs ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                  title="Speak via Microphone"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Tip: Artisans can speak in Telugu, Hindi, Tamil, Bengali, or English without typing hurdles.
              </p>
            </div>

            {/* 3. Cost Inputs */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
              <span className="text-xs font-bold text-amber-900 block mb-2">
                3. Cost Inputs (To Protect Your Fair Minimum Price)
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600">Material Cost (₹)</label>
                  <input
                    type="number"
                    value={costs.material}
                    placeholder="e.g. 450"
                    onChange={(e) => setCosts({ ...costs, material: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">Labour Cost (₹)</label>
                  <input
                    type="number"
                    value={costs.labour}
                    placeholder="e.g. 400"
                    onChange={(e) => setCosts({ ...costs, labour: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">Packaging (₹)</label>
                  <input
                    type="number"
                    value={costs.packaging}
                    placeholder="e.g. 60"
                    onChange={(e) => setCosts({ ...costs, packaging: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    className="w-full text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateAI}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run AI Catalog Pipeline</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Loading State */}
        {step === 'PROCESSING' && (
          <div className="py-16 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-amber-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Orchestrating Multimodal AI Pipeline...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Transcribing voice note, analyzing craft attributes, generating heritage story & studio image enhancement...
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Human-in-the-Loop Review & Approval */}
        {step === 'REVIEW' && aiDraft && (
          <div className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* AI Source Indicator Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Pipeline Source:</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  aiDraft.source === 'LIVE AI' || aiDraft.source === 'LIVE_AI'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {aiDraft.source === 'LIVE_AI' || aiDraft.source === 'LIVE AI'
                    ? 'Live AI Assisted Draft'
                    : 'Manual Draft (AI Unavailable)'}
                </span>
                <span className="text-[11px] text-slate-400">
                  (Language: {aiDraft.language_detected?.toUpperCase() || 'EN'})
                </span>
              </div>
              <span className="text-[11px] text-amber-700 font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Artisan Review & Approval Required</span>
              </span>
            </div>

            {/* Notice Banner */}
            {aiDraft.notice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Notice: </span>
                  {aiDraft.notice}
                </div>
              </div>
            )}

            {/* Image Presentation */}
            {aiDraft.image_url ? (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Craft Image Presentation (Original vs AI Enhanced)
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Retake photo using camera"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Retake</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Upload different image"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Replace Photo</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden relative bg-slate-50">
                    <span className="absolute top-2 left-2 z-10 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                      Original Capture
                    </span>
                    {!imgErrorOriginal ? (
                      <img
                        src={aiDraft.image_url}
                        alt="Original"
                        className="w-full h-36 object-cover"
                        onError={() => setImgErrorOriginal(true)}
                      />
                    ) : (
                      <div className="w-full h-36 bg-slate-100 flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center">
                        <ImageIcon className="w-8 h-8 text-slate-300 mb-1" />
                        <span className="text-[11px] font-medium text-slate-500">Image preview unavailable</span>
                        <span className="text-[10px] text-slate-400">Click replace photo above to upload</span>
                      </div>
                    )}
                  </div>
                  <div className="border-2 border-amber-500/50 rounded-xl overflow-hidden relative shadow-xs bg-slate-50">
                    <span className="absolute top-2 left-2 z-10 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center space-x-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>AI Studio Enhanced</span>
                    </span>
                    {!imgErrorEnhanced ? (
                      <img
                        src={aiDraft.enhanced_image_url || aiDraft.image_url}
                        alt="Enhanced"
                        className="w-full h-36 object-cover"
                        onError={() => setImgErrorEnhanced(true)}
                      />
                    ) : (
                      <div className="w-full h-36 bg-amber-50/50 flex flex-col items-center justify-center text-amber-600/70 text-xs p-3 text-center">
                        <ImageIcon className="w-8 h-8 text-amber-300 mb-1" />
                        <span className="text-[11px] font-medium text-slate-600">AI Studio preview pending</span>
                        <span className="text-[10px] text-slate-400">Enhanced version will generate on publish</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">No Image Attached</p>
                    <p className="text-[11px] text-slate-500">Take a photo with camera or choose an image file.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>
            )}

            {/* Editable Draft Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Generated Title (Editable)</label>
                <input
                  type="text"
                  value={aiDraft.title}
                  onChange={(e) => handleDraftChange('title', e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={aiDraft.category}
                    onChange={(e) => handleDraftChange('category', e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Materials</label>
                  <input
                    type="text"
                    value={aiDraft.materials || ''}
                    placeholder="e.g. Mulberry Silk, Natural Indigo"
                    onChange={(e) => handleDraftChange('materials', e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marketplace Description</label>
                <textarea
                  rows="2"
                  value={aiDraft.description}
                  onChange={(e) => handleDraftChange('description', e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Heritage & Cultural Craft Story</label>
                <textarea
                  rows="2"
                  value={aiDraft.craft_story || ''}
                  placeholder="Craft story will appear here if generated or can be added manually..."
                  onChange={(e) => handleDraftChange('craft_story', e.target.value)}
                  className="w-full text-xs border border-amber-200 rounded-lg p-2.5 bg-amber-50/40 text-slate-800 italic focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Generated SEO / Discovery Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {aiDraft.tags?.map((t) => (
                    <span key={t} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing Breakdown & Approval */}
              {aiDraft.pricing_available && aiDraft.suggested_price != null ? (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-900 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Deterministic Minimum Fair Price: ₹{aiDraft.min_fair_price}</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Cost Basis: ₹{((Number(aiDraft.material_cost) || 0) + (Number(aiDraft.labour_cost) || 0) + (Number(aiDraft.packaging_cost) || 0))} + 20% protected artisan margin
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-700">Selling Price:</span>
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-slate-800 mr-1">₹</span>
                      <input
                        type="number"
                        value={aiDraft.suggested_price ?? ''}
                        onChange={(e) => handleDraftChange('suggested_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-24 text-xs font-bold border border-emerald-300 rounded-lg px-2 py-1 text-slate-900 bg-white text-right"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center space-x-1.5 text-xs text-amber-900 font-bold">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Pricing Not Calculated (Cost Inputs Omitted)</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Please enter your selling price manually to complete this listing.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-semibold text-slate-700">Set Selling Price:</label>
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-slate-800 mr-1">₹</span>
                      <input
                        type="number"
                        placeholder="e.g. 1200"
                        value={aiDraft.suggested_price ?? ''}
                        onChange={(e) => handleDraftChange('suggested_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-28 text-xs font-bold border border-amber-300 rounded-lg px-2 py-1 text-slate-900 bg-white text-right focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Approval Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                onClick={() => setStep('INPUT')}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                ← Back to Input
              </button>
              <button
                onClick={handleApproveAndPublish}
                disabled={publishing}
                className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{publishing ? 'Publishing...' : 'Approve & Publish Craft'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
