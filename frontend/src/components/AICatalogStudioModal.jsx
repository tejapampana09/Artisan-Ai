import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Sparkles, Image as ImageIcon, CheckCircle2, 
  Layers, Volume2, Globe, ShieldCheck, ArrowRight, RefreshCw, Wand2,
  Camera, Upload, Trash2, AlertTriangle, Zap, TrendingUp
} from 'lucide-react';
import { processAICatalog, approveAndPublishAICatalog, enhanceProductImage, getApiBase } from '../api/index.js';
import { useOffline } from '../context/OfflineContext';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

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

const STUDIO_BACKDROPS = [
  { id: 'marble_pedestal', name: 'Studio Slate White', style: 'radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%)', label: '🏛️ Slate White' },
  { id: 'neutral_warm', name: 'Artisan Warm Cream', style: 'radial-gradient(circle at center, #fffbeb 0%, #fef3c7 100%)', label: '✨ Warm Cream' },
  { id: 'royal_silk', name: 'Royal Silk', style: 'radial-gradient(circle at center, #701a75 0%, #2e1065 100%)', label: '👑 Royal Silk' },
  { id: 'teak_wood', name: 'Teak Wood Table', style: 'linear-gradient(to bottom, #78350f, #451a03)', label: '🪵 Teak Wood' },
  { id: 'courtyard', name: 'Heritage Courtyard', style: 'linear-gradient(to right, #9a3412, #c2410c)', label: '🌺 Courtyard' }
];

const getAdaptiveQnaQuestions = (qnaAnswers, selectedPhoto, selectedLang) => {
  return [
    {
      id: 'q1_title',
      num: 1,
      te: 'మీరు తయారు చేసిన ఈ వస్తువు పేరు ఏంటి? ఇది ఏ రకమైన చేతివృత్తికి సంబంధించినది?',
      hi: 'आपने जो यह वस्तु बनाई है, उसका नाम क्या है? यह किस प्रकार की हस्तकला से जुड़ी है?',
      en: 'What is the name of this product, and what type of craft does it belong to?',
      ta: 'நீங்கள் தயாரித்த இந்த பொருளின் பெயர் என்ன? இது எந்த வகையான கைவினையைச் சேர்ந்தது?',
      bn: 'আপনি তৈরি করা এই পণ্যটির নাম কী? এটি কোন ধরনের হস্তশিল্পের সঙ্গে যুক্ত?',
      speech: {
        te: 'మీరు తయారు చేసిన ఈ వస్తువు పేరు ఏంటి? ఇది ఏ రకమైన చేతివృత్తికి సంబంధించినది?',
        hi: 'आपने जो यह चीज़ बनाई है, उसका नाम क्या है? यह किस तरह की हस्तकला से जुड़ी है?',
        en: 'What do you call this product? And what kind of traditional craft is it?',
        ta: 'நீங்கள் தயாரித்த இந்த பொருளின் பெயர் என்ன? இது எந்த வகையான பாரம்பரிய கைவினையைச் சேர்ந்தது?',
        bn: 'আপনি যে পণ্যটি তৈরি করেছেন, সেটার নাম কী? এটি কোন ধরনের ঐতিহ্যবাহী হস্তশিল্প?'
      },
      placeholder: {
        te: 'ఉదాహరణ: చేతితో నేసిన కలంకారి దుపట్టా...',
        hi: 'उदाहरण: हाथ से बना कलमकारी दुपट्टा...',
        en: 'e.g. Handpainted Kalamkari Silk Dupatta...',
        ta: 'எடுத்துக்காட்டு: கைத்தறி கலம்காரி துப்பட்டா...',
        bn: 'উদাহরণ: হাতে তৈরি কলমকারি শাড়ি...'
      }
    },
    {
      id: 'q2_materials',
      num: 2,
      te: 'దీన్ని తయారు చేయడానికి ఏ పదార్థాలు వాడారు? ఇది పూర్తిగా చేతితో తయారు చేశారా?',
      hi: 'इसे बनाने के लिए आपने किन सामग्रियों का इस्तेमाल किया? क्या यह पूरी तरह हाथ से बनाया गया है?',
      en: 'What materials did you use to make it? Is it completely handmade?',
      ta: 'இதை தயாரிக்க என்ன பொருட்களை பயன்படுத்தினீர்கள்? இது முழுவதும் கையால் செய்யப்பட்டதா?',
      bn: 'এটি তৈরি করতে আপনি কী কী উপকরণ ব্যবহার করেছেন? এটি কি পুরোপুরি হাতে তৈরি?',
      speech: {
        te: 'దీన్ని తయారు చేయడానికి ఏ పదార్థాలు వాడారు? ఇది పూర్తిగా చేతితో తయారు చేశారా?',
        hi: 'इसे बनाने में आपने कौन-कौन सी चीज़ें इस्तेमाल कीं? क्या यह पूरी तरह हाथ से बनाया गया है?',
        en: 'What materials did you use to make it? And is it completely handmade?',
        ta: 'இதை செய்ய என்னென்ன பொருட்களை பயன்படுத்தினீர்கள்? இது முழுவதும் கையால் செய்யப்பட்டதா?',
        bn: 'এটি তৈরি করতে কী কী উপকরণ ব্যবহার করেছেন? এটি কি পুরোপুরি হাতে তৈরি?'
      },
      placeholder: {
        te: 'ఉదాహరణ: పట్టు నూలు, సహజ రంగులు, చెక్క...',
        hi: 'उदाहरण: रेशम, प्राकृतिक रंग, लकड़ी...',
        en: 'e.g. Pure silk, natural dyes, wood...',
        ta: 'எடுத்துக்காட்டு: பட்டு, இயற்கை சாயங்கள், மரம்...',
        bn: 'উদাহরণ: খাঁটি রেশম, প্রাকৃতিক রং, কাঠ...'
      }
    },
    {
      id: 'q3_story',
      num: 3,
      te: 'ఒక్క వస్తువును తయారు చేయడానికి సాధారణంగా ఎంత సమయం పడుతుంది? ఈ కళకు సంబంధించిన ప్రత్యేకత లేదా మీ కుటుంబ కథ ఏదైనా ఉందా?',
      hi: 'एक वस्तु बनाने में आमतौर पर कितना समय लगता है? इस कला की कोई खासियत या आपके परिवार से जुड़ी कोई कहानी है?',
      en: 'How much time does it usually take to make one piece? Is there anything special about this craft or a story from your family?',
      ta: 'ஒரு பொருளை தயாரிக்க பொதுவாக எவ்வளவு நேரம் ஆகும்? இந்த கைவினையின் சிறப்பு அல்லது உங்கள் குடும்பத்துடன் தொடர்புடைய கதை ஏதேனும் உள்ளதா?',
      bn: 'একটি পণ্য তৈরি করতে সাধারণত কত সময় লাগে? এর বিশেষত্ব বা আপনার পরিবারের সঙ্গে জড়িত কোনো গল্প আছে কি?',
      speech: {
        te: 'ఒక్క వస్తువును తయారు చేయడానికి సాధారణంగా ఎంత సమయం పడుతుంది? ఈ కళకు సంబంధించిన ప్రత్యేకత లేదా మీ కుటుంబ కథ ఏదైనా ఉందా?',
        hi: 'एक चीज़ बनाने में आमतौर पर कितना समय लगता है? इस कला की कोई खास बात या आपके परिवार से जुड़ी कहानी है?',
        en: 'How long does it usually take to make one piece? And is there anything special about this craft, or a story passed down in your family?',
        ta: 'ஒரு பொருளை செய்ய பொதுவாக எவ்வளவு நேரம் ஆகும்? இந்த கைவினையின் சிறப்பு அல்லது உங்கள் குடும்பத்தில் சொல்லப்பட்டு வரும் கதை ஏதேனும் உள்ளதா?',
        bn: 'একটি পণ্য তৈরি করতে সাধারণত কত সময় লাগে? এই শিল্পের বিশেষত্ব বা আপনার পরিবারে চলে আসা কোনো গল্প আছে কি?'
      },
      placeholder: {
        te: 'ఉదాహరణ: 10 రోజులు పడుతుంది, మా కుటుంబంలో మూడు తరాలుగా ఈ కళను చేస్తున్నాం...',
        hi: 'उदाहरण: इसे बनाने में 10 दिन लगते हैं और हमारे परिवार में यह कला तीन पीढ़ियों से चली आ रही है...',
        en: 'e.g. It takes 10 days, and our family has practiced this craft for three generations...',
        ta: 'எடுத்துக்காட்டு: 10 நாட்கள் ஆகும், எங்கள் குடும்பத்தில் மூன்று தலைமுறைகளாக இந்தக் கலையை செய்து வருகிறோம்...',
        bn: 'উদাহরণ: ১০ দিন সময় লাগে, আমাদের পরিবার তিন প্রজন্ম ধরে এই শিল্প করে আসছে...'
      }
    }
  ];
};

export default function AICatalogStudioModal({ isOpen, onClose, onPublished }) {
  const { isOffline, queueProductDraft } = useOffline();
  const notify = useNotification();
  
  const [step, setStep] = useState('INPUT'); // 'INPUT' | 'PROCESSING' | 'REVIEW'
  const [qnaAnswers, setQnaAnswers] = useState({
    q1_title: '',
    q2_materials: '',
    q3_story: ''
  });
  const [activeQnaIndex, setActiveQnaIndex] = useState(0);
  const [inputSubStep, setInputSubStep] = useState('PHOTO'); // 'PHOTO' | 'QNA' | 'COSTS'
  const [micError, setMicError] = useState(null);
  const [reviewLang, setReviewLang] = useState('en'); // 'en' | 'native'

  const { language: activeLanguage } = useLanguage();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedLang, setSelectedLang] = useState(activeLanguage || 'te');
  const [speakingQId, setSpeakingQId] = useState(null);
  const [voiceText, setVoiceText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedBackdrop, setSelectedBackdrop] = useState('marble_pedestal');
  const [costs, setCosts] = useState({ material: '', labour: '', packaging: '', other: '', selling_price: '' });
  const [aiDraft, setAiDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imgErrorOriginal, setImgErrorOriginal] = useState(false);
  const [imgErrorEnhanced, setImgErrorEnhanced] = useState(false);
  const [isEnhancingImage, setIsEnhancingImage] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState('');
  const [chosenImageOption, setChosenImageOption] = useState('enhanced');

  // Sync combined text into voiceText
  useEffect(() => {
    const parts = [
      qnaAnswers.q1_title ? `Product Name: ${qnaAnswers.q1_title}` : '',
      qnaAnswers.q2_materials ? `Handmade & Materials: ${qnaAnswers.q2_materials}` : '',
      qnaAnswers.q3_story ? `Craft Process & Story: ${qnaAnswers.q3_story}` : '',
    ].filter(Boolean);
    
    if (parts.length > 0) {
      setVoiceText(parts.join('\n'));
    }
  }, [qnaAnswers]);

  // Handle per-question voice record transcription
  const handleQnaVoiceResult = (qId, transcript) => {
    setQnaAnswers((prev) => ({
      ...prev,
      [qId]: prev[qId] ? `${prev[qId]} ${transcript}` : transcript
    }));
  };

  useEffect(() => {
    if (activeLanguage) {
      setSelectedLang(activeLanguage);
    }
  }, [activeLanguage, isOpen]);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const activeAudioRef = useRef(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const baseTranscriptRef = useRef('');
  const currentQnaAnswersRef = useRef(qnaAnswers);
  const currentVoiceTextRef = useRef(voiceText);
  const activeTargetKeyRef = useRef(null);

  useEffect(() => {
    currentQnaAnswersRef.current = qnaAnswers;
  }, [qnaAnswers]);

  useEffect(() => {
    currentVoiceTextRef.current = voiceText;
  }, [voiceText]);

  const stopCurrentAudio = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch (e) {}
      activeAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingQId(null);
  };

  // Speak question out loud in natural human flow in selected language
  const speakQuestion = (qId, rawText, overrideLang = null) => {
    const langToUse = overrideLang || selectedLang;

    // Toggle stop if already speaking this question
    if (speakingQId === qId && (activeAudioRef.current || ('speechSynthesis' in window && window.speechSynthesis.speaking))) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();

    // Clean text to sound like a natural human spoken question
    // (strip leading digits like "1. ", "(చేనేత/టెక్స్‌టైల్)" parentheticals, etc.)
    const cleanText = rawText
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    setSpeakingQId(qId);

    const langMap = {
      te: 'te-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      bn: 'bn-IN',
      en: 'en-IN'
    };
    const targetLang = langMap[langToUse] || 'en-IN';

    const onStart = () => setSpeakingQId(qId);
    const onEnd = () => {
      activeAudioRef.current = null;
      setSpeakingQId((curr) => (curr === qId ? null : curr));
    };

    // Check if browser has native voice for requested language
    const voices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
    const matchingVoice = voices.find(
      (v) => v.lang.toLowerCase().replace('_', '-').startsWith(langToUse) ||
             v.lang.toLowerCase().replace('_', '-').startsWith(targetLang.toLowerCase())
    );

    if ('speechSynthesis' in window && matchingVoice) {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = targetLang;
        utterance.voice = matchingVoice;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onstart = onStart;
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
        window.speechSynthesis.speak(utterance);
      }, 50);
    } else {
      // High quality Backend TTS Audio Endpoint for Telugu, Hindi, Tamil, Bengali, English
      try {
        const apiBase = getApiBase();
        const ttsUrl = `${apiBase}/tts?text=${encodeURIComponent(cleanText)}&lang=${langToUse}`;
        const audio = new Audio(ttsUrl);
        activeAudioRef.current = audio;
        audio.onplay = onStart;
        audio.onended = onEnd;
        audio.onerror = () => {
          activeAudioRef.current = null;
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = targetLang;
            utterance.rate = 0.9;
            utterance.onstart = onStart;
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
            window.speechSynthesis.speak(utterance);
          } else {
            onEnd();
          }
        };
        audio.play().catch(() => {
          activeAudioRef.current = null;
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = targetLang;
            utterance.rate = 0.9;
            utterance.onstart = onStart;
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
            window.speechSynthesis.speak(utterance);
          } else {
            onEnd();
          }
        });
      } catch (err) {
        onEnd();
      }
    }
  };

  const handleNavQnaIndex = (newIdx) => {
    stopRecording();
    stopCurrentAudio();
    setActiveQnaIndex(newIdx);
    const questions = getAdaptiveQnaQuestions(qnaAnswers, selectedPhoto, selectedLang);
    const targetQ = questions[newIdx];
    if (targetQ) {
      const rawText =
        targetQ.speech?.[selectedLang] ||
        targetQ[selectedLang] ||
        targetQ.en;
      speakQuestion(targetQ.id, rawText, selectedLang);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopCurrentAudio();
    };
  }, []);

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

  const triggerImageEnhancement = async (imgData, backdropId = selectedBackdrop) => {
    if (!imgData) return;
    setIsEnhancingImage(true);
    setImgErrorEnhanced(false);
    try {
      const res = await enhanceProductImage(imgData, backdropId);
      if (res?.enhanced_image_url) {
        setEnhancedImageUrl(res.enhanced_image_url);
        setAiDraft((prev) => prev ? { ...prev, enhanced_image_url: res.enhanced_image_url } : null);
      }
    } catch (err) {
      console.warn('Immediate studio enhancement error:', err);
      setEnhancedImageUrl(imgData);
    } finally {
      setIsEnhancingImage(false);
    }
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
    setChosenImageOption('enhanced');
    if (aiDraft) {
      setAiDraft((prev) => ({
        ...prev,
        image_url: dataUrl,
        enhanced_image_url: dataUrl
      }));
    }
    if (e.target) e.target.value = '';
    // Trigger immediate AI Studio Enhancement
    triggerImageEnhancement(dataUrl);
  };

  // Sync sample prompt when photo or language changes
  const handlePhotoSelect = (p) => {
    if (selectedPhoto?.name === p.name) {
      setSelectedPhoto(null);
      setCustomImageUrl('');
      setEnhancedImageUrl('');
    } else {
      setSelectedPhoto(p);
      setCustomImageUrl(p.url);
      setChosenImageOption('enhanced');
      const sample = p[selectedLang] || p.en;
      if (!voiceText.trim()) {
        setVoiceText(sample);
      }
      // Trigger immediate AI Studio Enhancement
      triggerImageEnhancement(p.url);
    }
  };

  const handleLangSelect = (code) => {
    setSelectedLang(code);
    stopCurrentAudio();
    if (selectedPhoto && (!voiceText.trim() || Object.values(selectedPhoto).includes(voiceText))) {
      const sample = selectedPhoto[code] || selectedPhoto.en;
      if (sample) setVoiceText(sample);
    }

    // Auto read active question in the newly selected language
    const questions = getAdaptiveQnaQuestions(qnaAnswers, selectedPhoto, code);
    const activeQ = questions[activeQnaIndex] || questions[0];
    if (activeQ) {
      const rawText =
        activeQ.speech?.[code] ||
        activeQ[code] ||
        activeQ.en;
      speakQuestion(activeQ.id, rawText, code);
    }
  };

  // Native WebRTC Audio Recording with Timer & Honest Fallback
  const startRecording = async (targetQnaKey = null) => {
    try {
      // 1. Cleanly tear down any ongoing audio or previous mic session
      stopCurrentAudio();
      stopRecording();
      activeTargetKeyRef.current = targetQnaKey;
      setMicError(null);
      setRecordingSeconds(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;

      // Capture whatever text was already in the input before starting speech
      const initialText = (targetQnaKey ? currentQnaAnswersRef.current[targetQnaKey] : currentVoiceTextRef.current) || '';
      baseTranscriptRef.current = initialText.trim();

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Dedicated session starter for SpeechRecognition to prevent Chrome InvalidStateError
      const startSpeechSession = () => {
        if (!isRecordingRef.current) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        try {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.onend = null;
              recognitionRef.current.abort();
            } catch (e) {}
            recognitionRef.current = null;
          }

          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          const langMap = { te: 'te-IN', hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', bn: 'bn-IN' };
          recognition.lang = langMap[selectedLang] || 'en-IN';
          recognition.interimResults = true;
          recognition.continuous = true;

          recognition.onresult = (event) => {
            let sessionTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
              sessionTranscript += event.results[i][0].transcript;
            }
            if (sessionTranscript && sessionTranscript.trim()) {
              const base = baseTranscriptRef.current;
              const combined = base ? `${base} ${sessionTranscript.trim()}` : sessionTranscript.trim();
              const currentKey = activeTargetKeyRef.current;
              if (currentKey) {
                setQnaAnswers((prev) => ({ ...prev, [currentKey]: combined }));
              } else {
                setVoiceText(combined);
              }
            }
          };

          recognition.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
              console.warn('SpeechRecognition error:', e.error);
            }
          };

          recognition.onend = () => {
            // When browser pauses on silence, update base and spin up a fresh session seamlessly
            if (isRecordingRef.current) {
              const currentKey = activeTargetKeyRef.current;
              const latestText = (currentKey ? currentQnaAnswersRef.current[currentKey] : currentVoiceTextRef.current) || '';
              baseTranscriptRef.current = latestText.trim();
              setTimeout(() => {
                if (isRecordingRef.current) {
                  startSpeechSession();
                }
              }, 120);
            }
          };

          recognition.start();
        } catch (err) {
          console.warn('Speech recognition start failed:', err);
        }
      };

      startSpeechSession();
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      setIsRecording(false);
      isRecordingRef.current = false;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setMicError('Microphone input unavailable. You can type your description directly below.');
      notify.warning('Microphone access unavailable. Please type your craft description.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleSpeechRecognition = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleGenerateAI = async () => {
    if (!voiceText.trim() && !selectedPhoto && !customImageUrl.trim()) {
      notify.warning('Please speak or type a craft description, or upload/select a photo.');
      return;
    }
    setStep('PROCESSING');
    setLoading(true);
    setImgErrorOriginal(false);
    setImgErrorEnhanced(false);

    const mat = Number(costs.material) || 0;
    const lab = Number(costs.labour) || 0;
    const pkg = Number(costs.packaging) || 0;
    const oth = Number(costs.other) || 0;
    const targetSellingPrice = Number(costs.selling_price) || null;
    const effectiveImg = customImageUrl.trim() || selectedPhoto?.url || '';
    const effectiveCat = selectedPhoto?.category || null;

    if (isOffline) {
      // Zero network dependency local processing in rural offline mode
      setTimeout(() => {
        const costBasis = mat + lab + pkg + oth;
        const minFair = costBasis > 0 ? Math.round(costBasis * 1.20) : null;
        const rawTitle = voiceText.trim().split('\n')[0].slice(0, 50) || (selectedPhoto ? selectedPhoto.name : 'Craft Draft (Pending Title)');
        const offlineDraft = {
          title: rawTitle,
          category: effectiveCat || 'Handcrafted',
          materials: '',
          description: voiceText.trim() || '',
          craft_story: '',
          suggested_price: targetSellingPrice || (costBasis > 0 ? Math.round(costBasis * 1.40) : null),
          min_fair_price: minFair,
          pricing_available: costBasis > 0 || !!targetSellingPrice,
          pricing_source: targetSellingPrice ? 'ARTISAN_INPUT' : (costBasis > 0 ? 'COST_PLUS_MARGIN' : 'AWAITING_ARTISAN_INPUT'),
          notice: costBasis > 0 ? 'Saved locally in rural offline mode.' : 'Saved locally in rural offline mode.',
          material_cost: mat || null,
          labour_cost: lab || null,
          packaging_cost: pkg || null,
          other_cost: oth || null,
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

    const parsedMaterials = qnaAnswers.q2_materials
      ? qnaAnswers.q2_materials.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    const hasExplicitUserInput = Boolean(
      qnaAnswers.q1_title?.trim() ||
      qnaAnswers.q2_materials?.trim() ||
      qnaAnswers.q3_story?.trim() ||
      voiceText.trim()
    );

    const artisanFacts = hasExplicitUserInput ? {
      product_name: qnaAnswers.q1_title?.trim() || (voiceText.trim() ? voiceText.trim().split('\n')[0].slice(0, 60) : ''),
      craft_type: effectiveCat || '',
      materials: parsedMaterials,
      handmade: null,
      making_time: '',
      artisan_story: qnaAnswers.q3_story?.trim() || '',
      special_characteristics: voiceText.trim()
    } : null;

    try {
      const res = await processAICatalog({
        artisan_facts: artisanFacts,
        qna_answers: qnaAnswers,
        voice_description: voiceText.trim(),
        language: selectedLang,
        image_url: effectiveImg,
        category_hint: effectiveCat,
        material_cost: mat || null,
        labour_cost: lab || null,
        packaging_cost: pkg || null,
        other_cost: oth || null,
        selling_price: targetSellingPrice
      });
      // A server-generated recommendation is the initial selling price, while
      // still leaving the artisan free to edit it before publishing.
      const rawPrice = (
        res?.suggested_price ??
        res?.price_recommendation?.recommended_price ??
        res?.market_summary?.median_price ??
        costs.selling_price
      );
      const recommendedPrice = Number(rawPrice);
      const validPrice = (Number.isFinite(recommendedPrice) && recommendedPrice > 0) ? recommendedPrice : null;
      const hydratedDraft = {
        ...res,
        suggested_price: validPrice ?? res?.suggested_price ?? null
      };
      if (validPrice) {
        setCosts((prev) => ({ ...prev, selling_price: String(validPrice) }));
      }
      setAiDraft(hydratedDraft);
      setStep('REVIEW');
    } catch (err) {
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('authenticated')) {
        notify.error('Please sign in to your artisan account to generate AI catalogs.');
      } else {
        notify.error('AI processing failed: ' + (err.message || 'Server error'));
      }
      setStep('INPUT');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftChange = (field, val) => {
    setAiDraft((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      if (reviewLang === 'en') {
        if (field === 'title') {
          updated.title = val;
          updated.title_en = val;
        } else if (field === 'description') {
          updated.description = val;
          updated.description_en = val;
        } else if (field === 'craft_story') {
          updated.craft_story = val;
          updated.craft_story_en = val;
        } else {
          updated[field] = val;
        }
      } else {
        if (field === 'title') {
          updated.title_native = val;
        } else if (field === 'description') {
          updated.description_native = val;
        } else if (field === 'craft_story') {
          updated.craft_story_native = val;
        } else {
          updated[field] = val;
        }
        try {
          const transObj = JSON.parse(updated.translations || '{}');
          transObj[selectedLang] = {
            ...(transObj[selectedLang] || {}),
            [field]: val
          };
          updated.translations = JSON.stringify(transObj);
        } catch (e) {}
      }
      if (field === 'suggested_price') {
        setCosts((c) => ({ ...c, selling_price: String(val ?? '') }));
      }
      return updated;
    });
  };

  const resetForm = () => {
    setStep('INPUT');
    setInputSubStep('PHOTO');
    setActiveQnaIndex(0);
    setQnaAnswers({ q1_title: '', q2_materials: '', q3_story: '' });
    setSelectedPhoto(null);
    setCustomImageUrl('');
    setVoiceText('');
    setAudioUrl(null);
    setCosts({ material: '', labour: '', packaging: '', other: '', selling_price: '' });
    setAiDraft(null);
    setPublishing(false);
    setLoading(false);
    setMicError(null);
    setReviewLang('en');
    setImgErrorOriginal(false);
    setImgErrorEnhanced(false);
  };

  const handleCloseModal = () => {
    resetForm();
    onClose();
  };

  const handleApproveAndPublish = async () => {
    const candidatePrice = (
      aiDraft.suggested_price ??
      aiDraft.market_summary?.median_price ??
      aiDraft.price_recommendation?.recommended_price ??
      costs.selling_price
    );
    const finalPrice = Number(candidatePrice);
    const minFair = Number(aiDraft.min_fair_price || 0);

    if (!finalPrice || finalPrice <= 0 || Number.isNaN(finalPrice)) {
      notify.warning('Please enter a valid selling price before publishing.');
      return;
    }

    if (!aiDraft.suggested_price) {
      setAiDraft((prev) => prev ? { ...prev, suggested_price: finalPrice } : null);
    }

    if (minFair > 0 && finalPrice < minFair) {
      notify.error(`Selling price (₹${finalPrice}) cannot be lower than your protected minimum fair price floor of ₹${minFair}.`);
      return;
    }

    // Always publish with fallback title, description, and craft story
    const pubTitle = (aiDraft.title_en || aiDraft.title || 'Handcrafted Craft Item').trim();
    const pubDesc = (aiDraft.description_en || aiDraft.description || pubTitle).trim();
    const pubStory = (aiDraft.craft_story_en || aiDraft.craft_story || pubDesc || pubTitle).trim();
    const pubCategory = (aiDraft.category || 'Handcrafted').trim();
    const pubMaterials = (aiDraft.materials || '').trim();

    setPublishing(true);
    if (isOffline) {
      queueProductDraft({
        draft_token: aiDraft.draft_token,
        title: pubTitle,
        category: pubCategory,
        materials: pubMaterials,
        description: pubDesc,
        craft_story: pubStory,
        title_en: pubTitle,
        description_en: pubDesc,
        craft_story_en: pubStory,
        translations: aiDraft.translations,
        price: finalPrice,
        stock: 5,
        material_cost: aiDraft.material_cost,
        labour_cost: aiDraft.labour_cost,
        packaging_cost: aiDraft.packaging_cost,
        other_cost: aiDraft.other_cost || 0.0,
        min_margin_pct: 0.20,
        auto_smart_pricing_enabled: Boolean(aiDraft.auto_smart_pricing_enabled),
        image_url: chosenImageOption === 'original' ? aiDraft.image_url : (aiDraft.enhanced_image_url || aiDraft.image_url),
        enhanced_image_url: chosenImageOption === 'original' ? aiDraft.image_url : (aiDraft.enhanced_image_url || aiDraft.image_url),
        status: 'DRAFT'
      });
      onPublished(`Saved "${pubTitle}" to local device queue (Pending Cloud Sync)!`);
      setPublishing(false);
      resetForm();
      onClose();
      return;
    }

    try {
      const selectedImgToPublish = chosenImageOption === 'original'
        ? aiDraft.image_url
        : (aiDraft.enhanced_image_url || aiDraft.image_url);

      await approveAndPublishAICatalog({
        draft_token: aiDraft.draft_token,
        title: pubTitle,
        category: pubCategory,
        materials: pubMaterials,
        description: pubDesc,
        craft_story: pubStory,
        title_en: pubTitle,
        description_en: pubDesc,
        craft_story_en: pubStory,
        translations: aiDraft.translations,
        price: finalPrice,
        stock: 5,
        material_cost: aiDraft.material_cost,
        labour_cost: aiDraft.labour_cost,
        packaging_cost: aiDraft.packaging_cost,
        other_cost: aiDraft.other_cost || 0.0,
        min_margin_pct: 0.20,
        auto_smart_pricing_enabled: Boolean(aiDraft.auto_smart_pricing_enabled),
        image_url: selectedImgToPublish,
        enhanced_image_url: selectedImgToPublish,
        status: 'PENDING_APPROVAL'
      });
      onPublished(`Successfully submitted "${pubTitle}" for Admin Approval!`);
      resetForm();
      onClose();
    } catch (err) {
      notify.error(err.message || 'Submission failed. Please review your edits.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2A1E17]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FBF8F3] text-stone-900 rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-[#EADFCF] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-[#EADFCF]/60 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#933D1E] to-[#A84320] flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2A1E17]">Voice-First AI Smart Cataloging Studio</h3>
              <p className="text-xs text-[#6B5B51]">Capture photo + Speak in native language → AI Catalog Draft</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#9E8E83] hover:text-[#6B5B51] rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Stage Product Lifecycle State Machine */}
        <div className="pt-2 pb-2 border-b border-[#EADFCF]/60 flex items-center justify-between text-[10px] font-bold text-[#9E8E83] shrink-0 overflow-x-auto">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <span className={`px-2 py-0.5 rounded-full ${step === 'INPUT' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#F4EBE1] text-[#6B5B51]'}`}>
              1. DRAFT
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${step === 'PROCESSING' ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-[#F4EBE1] text-[#6B5B51]'}`}>
              2. AI_PROCESSING
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${step === 'REVIEW' && !publishing ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' : 'bg-[#F4EBE1] text-[#6B5B51]'}`}>
              3. AI_GENERATED
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-full ${publishing ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-[#F4EBE1] text-[#6B5B51]'}`}>
              4. APPROVED
            </span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              5. PUBLISHED
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-4">
        {/* STEP 1: Input Flow */}
        {step === 'INPUT' && (
          <div className="mt-4 space-y-4">
            {/* Sub-step Progress Navigation Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#F4EBE1] rounded-2xl border border-[#EADFCF] text-xs font-bold text-[#6B5B51]">
              <button
                type="button"
                onClick={() => setInputSubStep('PHOTO')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'PHOTO'
                    ? 'bg-white text-[#933D1E] shadow-xs border border-[#933D1E]/30 font-extrabold'
                    : 'hover:text-[#2A1E17]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#933D1E]" />
                <span>1. Craft Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSubStep('QNA')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'QNA'
                    ? 'bg-white text-[#933D1E] shadow-xs border border-[#933D1E]/30 font-extrabold'
                    : 'hover:text-[#2A1E17]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-[#933D1E]" />
                <span>2. AI Guided Q&A</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSubStep('COSTS')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'COSTS'
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200 font-extrabold'
                    : 'hover:text-[#2A1E17]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Cost & Margin</span>
              </button>
            </div>

            {/* SUB-STEP 1: Photo Upload & Camera */}
            {inputSubStep === 'PHOTO' && (
              <div className="space-y-4 pt-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-[#2A1E17] flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-[#933D1E]" />
                    <span>Upload or Take a Photo of Your Craft Creation</span>
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

                {/* Photo Preview / Capture Options */}
                {customImageUrl ? (
                  <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/60 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3.5 overflow-hidden">
                        <div className="relative shrink-0">
                          <img
                            src={chosenImageOption === 'enhanced' && enhancedImageUrl ? enhancedImageUrl : customImageUrl}
                            alt="Selected Craft"
                            className="w-20 h-20 rounded-xl object-cover border border-[#933D1E]/30 shadow-sm"
                            onError={() => setImgErrorOriginal(true)}
                          />
                          {isEnhancingImage && (
                            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center backdrop-blur-2xs">
                              <div className="w-5 h-5 border-2 border-white border-t-amber-400 rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-xs font-extrabold text-[#2A1E17]">
                              {selectedPhoto ? selectedPhoto.name : 'Photo Attached Successfully'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B5B51] mt-1">
                            {isEnhancingImage 
                              ? 'AI Studio is enhancing photo lighting & clarity...'
                              : (enhancedImageUrl 
                                  ? 'AI Studio enhancement ready. You can switch preview mode below.'
                                  : 'Ready for AI Multimodal Vision Analysis.')
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#EADFCF] text-[#2A1E17] hover:bg-[#FAF7F2] shadow-2xs cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-[#933D1E]" />
                          <span>Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#EADFCF] text-[#2A1E17] hover:bg-[#FAF7F2] shadow-2xs cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#933D1E]" />
                          <span>Upload</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive Enhancement Toggle & Status */}
                    {isEnhancingImage ? (
                      <div className="flex items-center space-x-2 text-[11px] text-amber-900 bg-amber-100/80 px-3 py-2 rounded-xl border border-amber-300 animate-pulse">
                        <Sparkles className="w-4 h-4 text-[#933D1E] animate-spin shrink-0" />
                        <span>Applying studio lighting, contrast normalization & crisp craft textures...</span>
                      </div>
                    ) : enhancedImageUrl ? (
                      <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                        <span className="text-[11px] font-bold text-[#6B5B51] flex items-center space-x-1">
                          <Wand2 className="w-3.5 h-3.5 text-[#933D1E]" />
                          <span>Preview Mode:</span>
                        </span>
                        <div className="inline-flex rounded-lg p-0.5 bg-white border border-[#EADFCF] shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setChosenImageOption('enhanced')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center space-x-1 ${
                              chosenImageOption === 'enhanced'
                                ? 'bg-[#933D1E] text-white shadow-2xs'
                                : 'text-[#6B5B51] hover:text-[#2A1E17]'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>AI Studio Enhanced</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setChosenImageOption('original')}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center space-x-1 ${
                              chosenImageOption === 'original'
                                ? 'bg-[#933D1E] text-white shadow-2xs'
                                : 'text-[#6B5B51] hover:text-[#2A1E17]'
                            }`}
                          >
                            <Camera className="w-3 h-3" />
                            <span>Original Photo</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-[#933D1E] bg-indigo-50/40 hover:bg-indigo-50/80 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-[#933D1E] group-hover:scale-110 flex items-center justify-center mb-2 transition-transform shadow-xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold text-[#2A1E17]">Take Photo (Camera)</span>
                      <span className="text-[10px] text-[#6B5B51] mt-0.5">Capture live with phone camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-amber-300 hover:border-[#933D1E] bg-amber-50/40 hover:bg-amber-50/80 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-[#933D1E] group-hover:scale-110 flex items-center justify-center mb-2 transition-transform shadow-xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold text-[#2A1E17]">Upload Image File</span>
                      <span className="text-[10px] text-[#6B5B51]">Choose from device photo gallery</span>
                    </button>
                  </div>
                )}

                {/* Sample Inspiration Crafts (Explicitly Separated Demo Examples) */}
                <div className="mt-4 pt-3 border-t border-[#EADFCF]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-extrabold text-[#2A1E17] flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#933D1E]" />
                      <span>Or Try a Demo Inspiration Craft Example</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#933D1E] bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      🧪 Demo Examples Only
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B5B51] mb-2.5">
                    Clicking a sample below loads a pre-configured craft image and story for quick testing without uploading your own photo.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {SAMPLE_PHOTOS.map((p) => (
                      <div
                        key={p.name}
                        onClick={() => handlePhotoSelect(p)}
                        className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedPhoto?.name === p.name ? 'border-[#933D1E] ring-2 ring-amber-500/20 shadow-xs' : 'border-[#EADFCF] hover:border-[#EADFCF]'
                        }`}
                      >
                        <div className="absolute top-1 right-1 z-10">
                          <span className="text-[9px] font-extrabold bg-[#933D1E] text-white px-1.5 py-0.5 rounded shadow-xs">
                            DEMO
                          </span>
                        </div>
                        <img src={p.url} alt={p.name} className="w-full h-18 object-cover" />
                        <div className="p-1.5 bg-white text-center">
                          <span className="text-[11px] font-bold text-[#2A1E17] truncate block">{p.name}</span>
                          <span className="text-[9px] text-[#933D1E] font-semibold">{p.category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  {(customImageUrl || selectedPhoto) ? (
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-[#933D1E] to-[#A84320] hover:from-amber-700 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300 animate-pulse" />
                      <span>⚡ Instant Photo Catalog (Skip Q&A)</span>
                    </button>
                  ) : <div />}
                  <button
                    type="button"
                    onClick={() => {
                      setInputSubStep('QNA');
                      handleNavQnaIndex(0);
                    }}
                    className="inline-flex items-center space-x-1.5 bg-[#933D1E] hover:bg-[#7E3216] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <span>Next: AI Guided Questions</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* SUB-STEP 2: Adaptive Guided AI Q&A */}
            {inputSubStep === 'QNA' && (
              <div className="space-y-4 pt-1">
                {/* Language Picker Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-indigo-50 border border-[#933D1E]/30 rounded-2xl gap-2">
                  <div>
                    <span className="text-xs font-extrabold text-indigo-900 block">AI Adaptive Voice & Text Guided Interview</span>
                    <span className="text-[11px] text-[#933D1E] block">Listen to each question out loud, then speak or type your answer:</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-xl border border-[#933D1E]/30 shrink-0">
                    <Globe className="w-3.5 h-3.5 text-[#933D1E]" />
                    <select
                      value={selectedLang}
                      onChange={(e) => handleLangSelect(e.target.value)}
                      className="text-xs font-bold text-indigo-900 bg-transparent focus:outline-none cursor-pointer"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Honest Microphone Access Error State Alert */}
                {micError && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-[#933D1E] shrink-0" />
                      <div>
                        <span className="font-bold">Microphone Access Notice: </span>
                        <span>{micError}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMicError(null); startRecording(); }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white border border-amber-300 rounded-lg text-[#933D1E] hover:bg-amber-100 cursor-pointer shrink-0 ml-2"
                    >
                      Retry Mic
                    </button>
                  </div>
                )}

                {/* Question Wizard Step Indicators Bar */}
                <div className="flex items-center justify-between bg-[#FAF7F2] border border-[#EADFCF] p-2.5 rounded-2xl gap-2">
                  <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
                    {getAdaptiveQnaQuestions(qnaAnswers, selectedPhoto, selectedLang).map((q, idx) => {
                      const isDone = Boolean(qnaAnswers[q.id]?.trim());
                      const isActive = activeQnaIndex === idx;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleNavQnaIndex(idx)}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-[#933D1E] text-white shadow-xs'
                              : isDone
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-white text-[#6B5B51] border border-[#EADFCF] hover:bg-[#F4EBE1]'
                          }`}
                        >
                          <span>Q{q.num}</span>
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] font-extrabold text-[#933D1E] bg-indigo-100 px-2.5 py-1 rounded-xl border border-[#933D1E]/30 shrink-0">
                    Question {activeQnaIndex + 1} of 3
                  </span>
                </div>

                {/* Active Focused Question Card (Wizard Style) */}
                {(() => {
                  const questions = getAdaptiveQnaQuestions(qnaAnswers, selectedPhoto, selectedLang);
                  const q = questions[activeQnaIndex] || questions[0];
                  const questionText = q[selectedLang] || q.en;
                  const phText = q.placeholder?.[selectedLang] || q.placeholder?.en || 'Type or click microphone to speak answer...';
                  const answerVal = qnaAnswers[q.id] || '';

                  return (
                    <div className="p-4 rounded-2xl border-2 border-indigo-300 bg-white shadow-xs space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start space-x-2">
                          <span className="w-6 h-6 rounded-full bg-[#933D1E] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            {q.num}
                          </span>
                          <h4 className="text-sm font-extrabold text-[#2A1E17] leading-snug">
                            {questionText}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const spokenText =
                              q.speech?.[selectedLang] ||
                              q[selectedLang] ||
                              q.en;

                            speakQuestion(q.id, spokenText);
                          }}
                          title="Listen to question spoken out loud in selected language"
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
                            speakingQId === q.id
                              ? 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse shadow-xs'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-[#933D1E] border border-[#933D1E]/30'
                          }`}
                        >
                          <Volume2 className={`w-4 h-4 ${speakingQId === q.id ? 'animate-bounce' : ''}`} />
                          <span>{speakingQId === q.id ? 'Stop' : 'Listen Question'}</span>
                        </button>
                      </div>

                      <div className="relative mt-2">
                        <textarea
                          rows="3"
                          value={answerVal}
                          onChange={(e) => setQnaAnswers({ ...qnaAnswers, [q.id]: e.target.value })}
                          placeholder={phText}
                          className="w-full text-xs border border-[#EADFCF] rounded-xl p-3 pr-28 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (isRecording) {
                              stopRecording();
                            } else {
                              startRecording(q.id);
                            }
                          }}
                          className={`absolute right-2 top-2 px-3 py-2 rounded-xl transition-all text-xs font-extrabold flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                            isRecording
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-[#933D1E] hover:bg-[#7E3216] text-white'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <MicOff className="w-4 h-4" />
                              <span>Stop Mic</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" />
                              <span>Speak Answer</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Combined Voice Text Preview / Additional Details */}
                <div className="p-3 bg-[#FAF7F2] border border-[#EADFCF] rounded-xl">
                  <span className="text-[11px] font-bold text-[#6B5B51] block mb-1">
                    Combined Craft Description for Gemini AI:
                  </span>
                  <p className="text-xs text-[#2A1E17] italic bg-white p-2 rounded-lg border border-[#EADFCF] leading-snug">
                    {voiceText || 'Answer the questions above or speak via microphone to build your catalog description.'}
                  </p>
                </div>

                {/* Wizard Navigation Controls (Previous / Next Question / Next: Cost) */}
                <div className="flex justify-between items-center pt-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeQnaIndex > 0) {
                        handleNavQnaIndex(activeQnaIndex - 1);
                      } else {
                        stopCurrentAudio();
                        setInputSubStep('PHOTO');
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-extrabold text-[#2A1E17] hover:bg-[#F4EBE1] rounded-xl border border-[#EADFCF] transition-all cursor-pointer shrink-0"
                  >
                    {activeQnaIndex > 0 ? `← Prev Question (${activeQnaIndex} of 3)` : '← Back to Photo'}
                  </button>

                  {activeQnaIndex < 2 ? (
                    <button
                      type="button"
                      onClick={() => handleNavQnaIndex(activeQnaIndex + 1)}
                      className="inline-flex items-center space-x-1.5 bg-[#933D1E] hover:bg-[#7E3216] text-white px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <span>Next Question ({activeQnaIndex + 2} of 3)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        stopCurrentAudio();
                        setInputSubStep('COSTS');
                      }}
                      className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer"
                    >
                      <span>Next: Cost & Margin</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SUB-STEP 3: Cost Breakdown & Profit Protection */}
            {inputSubStep === 'COSTS' && (
              <div className="space-y-4 pt-1">
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center space-x-2 text-emerald-900 font-extrabold text-xs mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Cost Breakdown & 20% Protected Minimum Profit Floor</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Enter your itemized costs below. The platform enforces a strict 20% minimum profit floor:
                    <br />
                    <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 mt-1 inline-block text-[11px]">
                      minimum_fair_price = (material + labour + packaging + other) × 1.20
                    </code>
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3.5 border border-[#EADFCF] rounded-2xl">
                  <div>
                    <label className="block text-[11px] font-bold text-[#2A1E17] mb-1">Material Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.material}
                      placeholder="e.g. 450"
                      onChange={(e) => setCosts({ ...costs, material: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-[#EADFCF] rounded-xl px-3 py-2 bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#2A1E17] mb-1">Labour Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.labour}
                      placeholder="e.g. 400"
                      onChange={(e) => setCosts({ ...costs, labour: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-[#EADFCF] rounded-xl px-3 py-2 bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#2A1E17] mb-1">Packaging Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.packaging}
                      placeholder="e.g. 60"
                      onChange={(e) => setCosts({ ...costs, packaging: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-[#EADFCF] rounded-xl px-3 py-2 bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#2A1E17] mb-1">Other Costs (₹)</label>
                    <input
                      type="number"
                      value={costs.other || ''}
                      placeholder="e.g. 40"
                      onChange={(e) => setCosts({ ...costs, other: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-[#EADFCF] rounded-xl px-3 py-2 bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#2A1E17] mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      value={costs.selling_price || ''}
                      placeholder="e.g. 1200"
                      onChange={(e) => setCosts({ ...costs, selling_price: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-[#EADFCF] rounded-xl px-3 py-2 bg-[#FAF7F2] focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Live Cost Basis & Minimum Fair Price Calculation Display */}
                {((Number(costs.material) || 0) + (Number(costs.labour) || 0) + (Number(costs.packaging) || 0) + (Number(costs.other) || 0)) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 block">Calculated Total Cost Basis:</span>
                      <span className="text-xs font-bold text-[#933D1E]">
                        ₹{(Number(costs.material) || 0)} + ₹{(Number(costs.labour) || 0)} + ₹{(Number(costs.packaging) || 0)} + ₹{(Number(costs.other) || 0)} = ₹{((Number(costs.material) || 0) + (Number(costs.labour) || 0) + (Number(costs.packaging) || 0) + (Number(costs.other) || 0))}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-emerald-900 block">Protected Minimum Price (20% Floor):</span>
                      <span className="text-sm font-extrabold text-emerald-700">
                        ₹{Math.round(((Number(costs.material) || 0) + (Number(costs.labour) || 0) + (Number(costs.packaging) || 0) + (Number(costs.other) || 0)) * 1.20)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Final Run AI Action Footer */}
                <div className="flex justify-between items-center pt-3 border-t border-[#EADFCF]/60">
                  <button
                    type="button"
                    onClick={() => setInputSubStep('QNA')}
                    className="px-3 py-2 text-xs font-semibold text-[#6B5B51] hover:text-[#2A1E17]"
                  >
                    ← Back to Questions
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-3 rounded-2xl font-extrabold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Run AI Catalog Studio Pipeline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Progressive Multimodal AI Loading State */}
        {step === 'PROCESSING' && (
          <div className="py-16 text-center space-y-5">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-[#933D1E]/30 border-t-[#933D1E] rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-[#933D1E] absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-[#2A1E17] text-base">Running Multimodal AI Catalog Pipeline...</h4>
              <p className="text-xs text-[#6B5B51] mt-1 max-w-md mx-auto">
                Analyzing craft photo, heritage materials, transcribing voice description, and computing fair pricing.
              </p>
            </div>
            <div className="max-w-xs mx-auto space-y-2 text-left bg-white p-3.5 rounded-xl border border-[#EADFCF] shadow-2xs">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Photo lighting & studio enhancement ready</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-800 animate-pulse">
                <Sparkles className="w-4 h-4 text-[#933D1E] shrink-0" />
                <span>Multimodal Gemini vision analyzing craft details...</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#9E8E83]">
                <div className="w-4 h-4 rounded-full border border-[#D5C7B5] shrink-0" />
                <span>Generating bilingual story & fair pricing floor...</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Human-in-the-Loop Review & Approval */}
        {step === 'REVIEW' && aiDraft && (
          <div className="mt-4 space-y-4 pr-1">
            {/* AI Source Indicator Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EADFCF] gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#6B5B51] font-medium">Pipeline Source:</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  aiDraft.source === 'LIVE AI' || aiDraft.source === 'LIVE_AI'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-[#933D1E] border-amber-300'
                }`}>
                  {aiDraft.source === 'LIVE_AI' || aiDraft.source === 'LIVE AI'
                    ? 'Live AI Assisted Draft'
                    : 'Manual Draft (AI Unavailable)'}
                </span>
                <span className="text-[11px] text-[#9E8E83]">
                  (Language: {aiDraft.language_detected?.toUpperCase() || 'EN'})
                </span>
              </div>
              <span className="text-[11px] text-[#933D1E] font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Artisan Review & Approval Required</span>
              </span>
            </div>

            {/* Notice Banner */}
            {aiDraft.notice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-[#933D1E]/30 text-xs text-[#933D1E] flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#933D1E] mt-0.5 shrink-0" />
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
                  <label className="block text-xs font-bold text-[#2A1E17]">
                    Craft Image Presentation (Original vs AI Enhanced)
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[11px] text-[#933D1E] hover:text-[#933D1E] font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Retake photo using camera"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Retake</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-[#933D1E] hover:text-[#933D1E] font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Upload different image"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Replace Photo</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setChosenImageOption('original')}
                    className={`border-2 rounded-xl overflow-hidden relative bg-[#FAF7F2] cursor-pointer transition-all ${
                      chosenImageOption === 'original'
                        ? 'border-[#933D1E] shadow-md ring-2 ring-[#933D1E]/30'
                        : 'border-[#EADFCF] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="absolute top-2 left-2 z-10 flex items-center space-x-1">
                      <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                        Original Capture
                      </span>
                      {chosenImageOption === 'original' && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 shadow-xs">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                    {!imgErrorOriginal ? (
                      <img
                        src={aiDraft.image_url}
                        alt="Original"
                        className="w-full h-36 object-cover"
                        onError={() => setImgErrorOriginal(true)}
                      />
                    ) : (
                      <div className="w-full h-36 bg-[#F4EBE1] flex flex-col items-center justify-center text-[#9E8E83] text-xs p-3 text-center">
                        <ImageIcon className="w-8 h-8 text-slate-300 mb-1" />
                        <span className="text-[11px] font-medium text-[#6B5B51]">Image preview unavailable</span>
                        <span className="text-[10px] text-[#9E8E83]">Click replace photo above to upload</span>
                      </div>
                    )}
                  </div>
                  <div
                    onClick={() => setChosenImageOption('enhanced')}
                    className={`border-2 rounded-xl overflow-hidden relative shadow-xs p-1 transition-all cursor-pointer ${
                      chosenImageOption === 'enhanced'
                        ? 'border-[#933D1E] shadow-md ring-2 ring-[#933D1E]/30'
                        : 'border-amber-500/40 opacity-80 hover:opacity-100'
                    }`}
                    style={{ background: STUDIO_BACKDROPS.find(b => b.id === selectedBackdrop)?.style || STUDIO_BACKDROPS[0].style }}
                  >
                    <div className="absolute top-2 left-2 z-10 flex items-center space-x-1">
                      <span className="bg-gradient-to-r from-[#933D1E] to-[#A84320] text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Studio ({STUDIO_BACKDROPS.find(b => b.id === selectedBackdrop)?.name})</span>
                      </span>
                      {chosenImageOption === 'enhanced' && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 shadow-xs">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Selected</span>
                        </span>
                      )}
                    </div>
                    {!imgErrorEnhanced ? (
                      <img
                        src={aiDraft.enhanced_image_url || aiDraft.image_url}
                        alt="Enhanced Studio"
                        className="w-full h-34 object-contain rounded-lg drop-shadow-2xl filter contrast-105 brightness-105"
                        onError={() => setImgErrorEnhanced(true)}
                      />
                    ) : (
                      <div className="w-full h-34 bg-amber-50/50 flex flex-col items-center justify-center text-[#933D1E]/70 text-xs p-3 text-center">
                        <ImageIcon className="w-8 h-8 text-amber-300 mb-1" />
                        <span className="text-[11px] font-medium text-[#6B5B51]">AI Studio preview pending</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Studio Backdrop Filter Controls */}
                <div className="mt-2.5 p-2 bg-amber-50/60 border border-[#933D1E]/30 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-900 shrink-0 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-[#933D1E]" />
                    <span>Select Backdrop Studio Lighting:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {STUDIO_BACKDROPS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBackdrop(b.id);
                          if (aiDraft?.image_url) {
                            triggerImageEnhancement(aiDraft.image_url, b.id);
                          }
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          selectedBackdrop === b.id
                            ? 'bg-[#933D1E] text-white border-amber-700 shadow-2xs scale-105'
                            : 'bg-white text-[#2A1E17] border-[#EADFCF] hover:bg-amber-50'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[#EADFCF] bg-[#FAF7F2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <ImageIcon className="w-5 h-5 text-[#9E8E83] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-[#2A1E17]">No Image Attached</p>
                    <p className="text-[11px] text-[#6B5B51]">Take a photo with camera or choose an image file.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#EADFCF] text-[#2A1E17] hover:bg-[#FAF7F2] shadow-2xs cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#933D1E]" />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#EADFCF] text-[#2A1E17] hover:bg-[#FAF7F2] shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#933D1E]" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>
            )}

            {/* Language Review & Global Publishing Indicator Header */}
            <div className="p-3 rounded-2xl bg-indigo-50/80 border border-[#933D1E]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-extrabold text-indigo-900 flex items-center space-x-1.5">
                  <Globe className="w-4 h-4 text-[#933D1E] shrink-0" />
                  <span>Marketplace Listing Language: 🇬🇧 English (Global Standard)</span>
                </span>
                <span className="text-[11px] text-[#933D1E] block mt-0.5">
                  Voice input ({selectedLang.toUpperCase()}) was auto-translated into English for global buyers while preserving native translations.
                </span>
              </div>
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#933D1E]/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewLang('en')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    reviewLang === 'en'
                      ? 'bg-[#933D1E] text-white shadow-2xs'
                      : 'text-[#6B5B51] hover:text-[#2A1E17]'
                  }`}
                >
                  🇬🇧 English (Publish Default)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewLang('native')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    reviewLang === 'native'
                      ? 'bg-[#933D1E] text-white shadow-2xs'
                      : 'text-[#6B5B51] hover:text-[#2A1E17]'
                  }`}
                >
                  🇮🇳 Native ({selectedLang.toUpperCase()})
                </button>
              </div>
            </div>

            {/* Editable Draft Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1">
                  Generated Title (Editable - {reviewLang === 'en' ? 'English Standard' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <input
                  type="text"
                  value={reviewLang === 'en' ? (aiDraft.title_en || aiDraft.title || '') : (aiDraft.title_native || aiDraft.title || '')}
                  onChange={(e) => handleDraftChange('title', e.target.value)}
                  className="w-full text-xs font-semibold border border-[#EADFCF] rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2A1E17] mb-1">Category</label>
                  <input
                    type="text"
                    value={aiDraft.category || ''}
                    onChange={(e) => handleDraftChange('category', e.target.value)}
                    className="w-full text-xs border border-[#EADFCF] rounded-lg px-3 py-2 bg-[#FAF7F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2A1E17] mb-1">Materials</label>
                  <input
                    type="text"
                    value={aiDraft.materials || ''}
                    placeholder="e.g. Mulberry Silk, Natural Indigo"
                    onChange={(e) => handleDraftChange('materials', e.target.value)}
                    className="w-full text-xs border border-[#EADFCF] rounded-lg px-3 py-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1">
                  Marketplace Description ({reviewLang === 'en' ? 'English' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <textarea
                  rows="2"
                  value={reviewLang === 'en' ? (aiDraft.description_en || aiDraft.description || '') : (aiDraft.description_native || aiDraft.description || '')}
                  onChange={(e) => handleDraftChange('description', e.target.value)}
                  className="w-full text-xs border border-[#EADFCF] rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1">
                  Heritage & Cultural Craft Story ({reviewLang === 'en' ? 'English' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <textarea
                  rows="2"
                  value={reviewLang === 'en' ? (aiDraft.craft_story_en || aiDraft.craft_story || '') : (aiDraft.craft_story_native || aiDraft.craft_story || '')}
                  placeholder="Craft story will appear here if generated or can be added manually..."
                  onChange={(e) => handleDraftChange('craft_story', e.target.value)}
                  className="w-full text-xs border border-[#933D1E]/30 rounded-lg p-2.5 bg-amber-50/40 text-[#2A1E17] italic focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-[#2A1E17] mb-1">Generated SEO / Discovery Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {aiDraft.tags?.map((t) => (
                    <span key={t} className="text-[11px] bg-[#F4EBE1] text-[#2A1E17] px-2 py-0.5 rounded-full border border-[#EADFCF]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing Breakdown & Approval */}
              {(aiDraft.pricing_available && aiDraft.suggested_price != null) || (aiDraft.market_summary?.median_price != null) || (Array.isArray(aiDraft.market_research?.results) && aiDraft.market_research.results.length > 0) ? (
                <div className="bg-gradient-to-br from-emerald-50/90 via-emerald-50/40 to-teal-50/60 border-2 border-emerald-300 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-emerald-700" />
                        <span>Phase 7 Deterministic Market-Aware Pricing Engine</span>
                      </span>
                      {(aiDraft.market_summary?.median_price || aiDraft.price_recommendation?.market_median) && (
                        <span className="text-[10px] font-bold text-[#933D1E] bg-indigo-100 px-2 py-0.5 rounded-md border border-[#933D1E]/30">
                          📊 Live Web Market Signal Applied
                        </span>
                      )}
                    </div>
                    {aiDraft.min_fair_price ? (
                      <span className="text-[11px] font-extrabold text-emerald-900 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-2xs">
                        🛡️ Protected 20% Floor: ₹{aiDraft.min_fair_price}
                      </span>
                    ) : (aiDraft.pricing_source === 'CASE_3_INSIDE_MARKET' || aiDraft.pricing_source === 'CASE_4_ABOVE_MARKET' || aiDraft.pricing_source === 'CASE_3_UNBENCHMARKED_ARTISAN_PRICE' || (costs.selling_price && Number(costs.selling_price) > 0)) ? (
                      <span className="text-[11px] font-extrabold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                        🏷️ Artisan Stated Price (Cost Inputs Omitted)
                      </span>
                    ) : aiDraft.market_summary?.median_price ? (
                      <span className="text-[11px] font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                        🏷️ Market Estimated (Cost Inputs Omitted)
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold text-stone-700 bg-stone-100 px-2.5 py-0.5 rounded-lg border border-stone-300">
                        🏷️ Custom Price (Cost Inputs Omitted)
                      </span>
                    )}
                  </div>

                  {/* Main Price Action Row */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-0.5 p-3 bg-white/90 border border-emerald-300 rounded-xl shadow-xs">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <h5 className="text-sm font-extrabold text-[#2A1E17]">✨ AI Recommended Selling Price</h5>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium leading-tight mt-1">
                        {(() => {
                          if (aiDraft.min_fair_price) {
                            return 'Combines artisan cost basis + 20% protected profit floor + live market signal.';
                          }
                          const hasValidRange = (
                            aiDraft.market_summary?.min_price != null &&
                            aiDraft.market_summary?.max_price != null &&
                            aiDraft.market_summary?.median_price != null &&
                            Number(aiDraft.market_summary.min_price) > 0
                          );
                          if (hasValidRange) {
                            return `Based on ${aiDraft.market_summary.priced_comparable_count || aiDraft.market_summary.comparable_count} price-verified market listings (Market Range: ₹${aiDraft.market_summary.min_price} – ₹${aiDraft.market_summary.max_price}, Median: ₹${aiDraft.market_summary.median_price}).`;
                          }
                          if (aiDraft.market_summary?.comparable_count > 0) {
                            return `${aiDraft.market_summary.comparable_count} comparable listings observed online. Verified prices not published on external snippets; respecting your stated price.`;
                          }
                          return 'Set your desired selling price or enter production costs to generate a protected price recommendation.';
                        })()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs font-black text-[#2A1E17]">Selling Price:</span>
                      <div className="flex items-center">
                        <span className="text-lg font-black text-[#933D1E] mr-1">₹</span>
                        <input
                          type="number"
                          value={aiDraft.suggested_price ?? (aiDraft.market_summary?.median_price || '')}
                          onChange={(e) => handleDraftChange('suggested_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className={`w-32 text-lg font-black border-2 rounded-xl px-3 py-1.5 text-[#2A1E17] bg-white text-right shadow-xs focus:ring-2 focus:ring-emerald-500 ${
                            aiDraft.min_fair_price && Number(aiDraft.suggested_price || aiDraft.market_summary?.median_price) < Number(aiDraft.min_fair_price || 0)
                              ? 'border-rose-500 text-rose-700 bg-rose-50'
                              : 'border-emerald-500 text-emerald-950 bg-emerald-50/50'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Floor Protection Warning Banner if Price is Below Minimum */}
                  {aiDraft.min_fair_price && Number(aiDraft.suggested_price) < Number(aiDraft.min_fair_price || 0) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center space-x-2 text-xs text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold">
                        Warning: Selling price ₹{aiDraft.suggested_price} is below your protected minimum fair floor of ₹{aiDraft.min_fair_price}. Publishing will be rejected.
                      </span>
                    </div>
                  )}

                  {/* Market & Cost Signals Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Cost Basis & Floor Card */}
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-[#6B5B51] uppercase tracking-wider block">Artisan Cost & Profit Floor</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-xs font-semibold text-[#2A1E17]">Cost Basis:</span>
                        <span className="text-xs font-bold text-[#2A1E17]">
                          {aiDraft.min_fair_price 
                            ? `₹${((Number(aiDraft.material_cost)||0) + (Number(aiDraft.labour_cost)||0) + (Number(aiDraft.packaging_cost)||0) + (Number(aiDraft.other_cost)||0))}`
                            : 'Omitted by artisan'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-xs font-semibold text-emerald-800">20% Fair Price Floor:</span>
                        <span className="text-xs font-black text-emerald-700">
                          {aiDraft.min_fair_price ? `₹${aiDraft.min_fair_price}` : 'Optional (Enter costs to enable)'}
                        </span>
                      </div>
                    </div>

                    {/* Market Research Signal Card */}
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-[#6B5B51] uppercase tracking-wider block">Live Market Research Signal</span>
                      <div className="flex justify-between items-baseline mt-1">
                        <span className="text-xs font-semibold text-[#2A1E17]">Comparable Market Median:</span>
                        <span className="text-xs font-bold text-indigo-900">
                          {aiDraft.market_summary?.median_price != null && Number(aiDraft.market_summary.median_price) > 0
                            ? `₹${aiDraft.market_summary.median_price}`
                            : 'Awaiting verified market prices'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mt-0.5">
                        <span className="text-xs font-semibold text-[#6B5B51]">Retained Benchmark Range:</span>
                        <span className="text-xs font-bold text-[#2A1E17]">
                          {aiDraft.market_summary?.min_price != null && aiDraft.market_summary?.max_price != null && Number(aiDraft.market_summary.min_price) > 0
                            ? `₹${aiDraft.market_summary.min_price} – ₹${aiDraft.market_summary.max_price} (${aiDraft.market_summary.priced_comparable_count || aiDraft.market_summary.comparable_count} items)`
                            : (aiDraft.market_summary?.comparable_count > 0 ? `${aiDraft.market_summary.comparable_count} items found (Prices unlisted)` : 'Benchmark range pending')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Demand Telemetry Status */}
                  {aiDraft.ml_demand_info?.status === 'PENDING_PUBLICATION' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F6F4EE] border border-[#E2DDD3] rounded-xl px-3 py-2 text-[#5A4A42]">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#8C6D53]" />
                        <span className="text-xs font-semibold text-[#2A1E17]">
                          7-Day Demand Forecasting: Pending Publication
                        </span>
                      </div>
                      <span className="text-[10px] text-[#7A6A60] italic">
                        Activates in Seller Business after buyer views, saves & orders
                      </span>
                    </div>
                  ) : aiDraft.ml_demand_info?.model_source === 'TRAINED_ML_MODEL' ? (
                    <div className="flex flex-wrap items-center gap-2 bg-violet-50 border border-violet-300 rounded-xl px-3 py-2">
                      <span className="text-xs font-extrabold text-violet-900 flex items-center gap-1.5">
                        🤖 <span>RandomForest ML Demand Engine Active</span>
                      </span>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                        Demand Score: {Math.round(aiDraft.ml_demand_info.predicted_demand_score ?? 0)}/100
                      </span>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                        Multiplier: {(aiDraft.ml_demand_info.ml_demand_multiplier ?? 1).toFixed(3)}×
                      </span>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                        {aiDraft.ml_demand_info.demand_level ?? 'NORMAL'} DEMAND
                      </span>
                      {aiDraft.ml_demand_info.model_info?.r2_score != null && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          R² = {aiDraft.ml_demand_info.model_info.r2_score}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Explainable Pricing Reasoning Bullets */}
                  {Array.isArray(aiDraft.price_recommendation?.reasoning) && aiDraft.price_recommendation.reasoning.length > 0 && (
                    <div className="bg-white/90 p-3 rounded-xl border border-emerald-200/90 space-y-1.5">
                      <span className="text-[11px] font-extrabold text-[#2A1E17] block flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Explainable Pricing Decision Reasoning:</span>
                      </span>
                      <ul className="space-y-1 pl-1">
                        {aiDraft.price_recommendation.reasoning.map((r, i) => (
                          <li key={i} className="text-[11px] text-[#2A1E17] flex items-start space-x-1.5 leading-snug">
                            <span className="text-emerald-600 font-bold shrink-0 mt-0.5">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-[#A6533B]/30 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center space-x-1.5 text-xs text-amber-900 font-bold">
                      <ShieldCheck className="w-4 h-4 text-[#A6533B]" />
                      <span>Pricing Not Calculated (Cost Inputs Omitted)</span>
                    </div>
                    <p className="text-[11px] text-[#A6533B]">
                      Add material, labour, packaging or other costs to generate a protected price recommendation.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-semibold text-[#1C1C1C]">Set Selling Price:</label>
                    <div className="flex items-center">
                      <span className="text-xs font-bold text-[#1C1C1C] mr-1">₹</span>
                      <input
                        type="number"
                        placeholder="e.g. 1200"
                        value={aiDraft.suggested_price ?? (aiDraft.market_summary?.median_price || '')}
                        onChange={(e) => handleDraftChange('suggested_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-28 text-xs font-bold border border-amber-300 rounded-lg px-2 py-1 text-[#1C1C1C] bg-white text-right focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Market references are grounded against authentic Indian artisan platforms */}
              {(() => {
                const results = Array.isArray(aiDraft.market_research?.results) && aiDraft.market_research.results.length > 0
                  ? aiDraft.market_research.results.filter(item => (
                      item.price &&
                      item.price > 0 &&
                      item.url?.startsWith('http') &&
                      !item.url.includes('example.com') &&
                      !item.source?.toLowerCase().includes('mock')
                    )).slice(0, 4)
                  : [];

                const medianPrice = (aiDraft.market_summary?.median_price && Number(aiDraft.market_summary.median_price) > 0)
                  ? Number(aiDraft.market_summary.median_price)
                  : null;

                const getPlatformBadge = (source = '', url = '') => {
                  const s = (source + ' ' + url).toLowerCase();
                  if (s.includes('indiahandmade')) return '🇮🇳 India Handmade (Govt Portal)';
                  if (s.includes('mystore')) return '🛍️ Mystore (ONDC Network)';
                  if (s.includes('itokri')) return '🧵 iTokri Crafts';
                  if (s.includes('jaypore')) return '🏺 Jaypore';
                  if (s.includes('craftsvilla')) return '🎨 Craftsvilla';
                  if (s.includes('tribesindia')) return '🏹 Tribes India';
                  if (s.includes('khadi')) return '🌾 Khadi India';
                  if (s.includes('amazon')) return '📦 Amazon Karigar';
                  if (s.includes('indiamart')) return '🏢 IndiaMART';
                  return source || 'Indian Craft Portal';
                };

                return (
                  <div className="bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E8E2D9] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-[#A6533B]" />
                        <span className="text-xs font-bold text-[#1C1C1C]">
                          {aiDraft.market_summary?.market_source_type === 'INTERNAL_MARKETPLACE'
                            ? 'Similar Crafts on Artisan AI (Internal Marketplace Benchmark)'
                            : 'External Market Comparables & Benchmark (India Handmade / Mystore ONDC)'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${medianPrice ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-[#6B6B6B] bg-stone-50 border-[#E8E2D9]'}`}>
                        {medianPrice ? 'Observed Market Benchmark Active' : (aiDraft.market_summary?.ai_estimated_price ? 'AI Estimated Reference' : (aiDraft.market_summary?.comparable_count > 0 ? `${aiDraft.market_summary.comparable_count} Listings Found` : 'Search Active'))}
                      </span>
                    </div>

                    {/* Median Price Benchmark summary banner */}
                    <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
                      <div className="text-[11px] text-[#2A1E17]">
                        <span className="font-extrabold text-emerald-900">
                          {medianPrice ? 'Observed Market Median: ' : (aiDraft.market_summary?.ai_estimated_price ? 'AI Estimated Price: ' : 'Comparable Market Median: ')}
                        </span>
                        <span className="text-[#6B5B51]">
                          {medianPrice 
                            ? 'Observed on verified Indian artisan marketplaces (India Handmade, Mystore, iTokri). No mock products used.'
                            : (aiDraft.market_summary?.ai_estimated_price
                                ? 'AI estimated fair-wage price recommendation. No verified external market listings observed.'
                                : 'Authentic Indian craft platforms searched. Verified price tags not available in public listings.')}
                        </span>
                      </div>
                      {medianPrice ? (
                        <span className="text-xs font-black text-emerald-950 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 shrink-0">
                          Median Price: ₹{medianPrice}
                        </span>
                      ) : aiDraft.market_summary?.ai_estimated_price ? (
                        <span className="text-xs font-black text-amber-900 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 shrink-0">
                          AI Estimate: ₹{aiDraft.market_summary.ai_estimated_price}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200 shrink-0">
                          Median Unavailable
                        </span>
                      )}
                    </div>

                    {results.length === 0 ? (
                      <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
                        {aiDraft.market_research?.notice || 'Market research median price is applied directly from verified Indian craft platforms. Individual product listings are omitted if not 100% price-verified to avoid displaying any mock or placeholder products.'}
                      </p>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-md border border-[#E8E2D9] bg-white flex flex-col justify-between space-y-2">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-xs font-bold text-[#1C1C1C] line-clamp-1">{item.title}</span>
                              {item.similarity_score != null && (
                                <span className="text-[9px] font-semibold bg-emerald-50 text-[#356B4A] px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                  Attribute Match: {Math.round(item.similarity_score * 100)}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-amber-900 font-semibold block mt-0.5">
                              {getPlatformBadge(item.source, item.url)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-[#E8E2D9]">
                            <span className="text-xs font-bold text-[#1C1C1C]">
                              {item.price ? `₹${item.price}` : 'Price unlisted'}
                            </span>
                            {item.url?.startsWith('http') && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-[#A6533B] hover:text-[#88412F] underline"
                                >
                                  Compare Price →
                                </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                );
              })()}

              {/* Auto Smart Pricing Toggle */}
              <div className="p-3 bg-indigo-50/70 border border-[#933D1E]/30 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-indigo-900 block">Enable Auto Smart Pricing</span>
                  <span className="text-[11px] text-[#933D1E] block">
                    Allow AI demand engine to rebalance price dynamically (Always ≥ 20% minimum profit floor).
                    Default is OFF for manual approval.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(aiDraft.auto_smart_pricing_enabled)}
                  onChange={(e) => handleDraftChange('auto_smart_pricing_enabled', e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 cursor-pointer shrink-0"
                />
              </div>
            </div>

            {/* Approval Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-[#EADFCF]/60">
              <button
                onClick={() => setStep('INPUT')}
                className="px-3 py-1.5 text-xs font-medium text-[#6B5B51] hover:text-[#2A1E17]"
              >
                ← Back to Input
              </button>
              <button
                onClick={handleApproveAndPublish}
                disabled={publishing}
                className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{publishing ? 'Submitting...' : 'Submit for Admin Approval'}</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
