import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Sparkles, Image as ImageIcon, CheckCircle2, 
  Layers, Volume2, Globe, ShieldCheck, ArrowRight, RefreshCw, Wand2,
  Camera, Upload, Trash2, AlertTriangle
} from 'lucide-react';
import { processAICatalog, approveAndPublishAICatalog } from '../api/index.js';
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
  { id: 'royal_silk', name: 'Royal Silk', style: 'radial-gradient(circle at center, #701a75 0%, #2e1065 100%)', label: '👑 Royal Silk' },
  { id: 'teak_wood', name: 'Teak Wood Table', style: 'linear-gradient(to bottom, #78350f, #451a03)', label: '🪵 Teak Wood' },
  { id: 'marble_pedestal', name: 'Marble Pedestal', style: 'radial-gradient(circle at center, #ffffff 0%, #cbd5e1 100%)', label: '🏛️ Marble' },
  { id: 'courtyard', name: 'Heritage Courtyard', style: 'linear-gradient(to right, #9a3412, #c2410c)', label: '🌺 Courtyard' }
];

const getAdaptiveQnaQuestions = (qnaAnswers, selectedPhoto, selectedLang) => {
  const titleText = (qnaAnswers.q1_title || selectedPhoto?.name || '').toLowerCase();
  const catText = (selectedPhoto?.category || '').toLowerCase();
  const combo = `${titleText} ${catText}`;

  let q2Obj = {
    id: 'q2_materials',
    num: 2,
    te: '2. ఇది చేతితో చేసినదా? ఏ మెటీరియల్స్ మరియు రంగులు వాడారు?',
    hi: '2. क्या यह हस्तनिर्मित है? कौन सी सामग्री और रंगों का उपयोग किया गया है?',
    en: '2. Is it handmade? What materials & natural dyes did you use?',
    ta: '2. இது கையால் செய்யப்பட்டதா? என்ன பொருட்கள் பயன்படுத்தப்பட்டன?',
    bn: '2. এটি কি হাতে তৈরি? কি উপাদান ব্যবহার করা হয়েছে?',
    placeholder: {
      te: 'ఉదాహరణ: 100% పట్టు నూలు, ఆర్గానిక్ కూరగాయల రంగులు...',
      hi: 'उदाहरण: 100% प्राकृतिक रेशम, जैविक रंग...',
      en: 'e.g. 100% Pure Mulberry Silk, Organic Natural Dyes...',
      ta: 'எடுத்துக்காட்டு: 100% பட்டு, இயற்கை சாயங்கள்...',
      bn: 'উদাহরণ: খাঁটি রেশম, প্রাকৃতিক রঙ...'
    }
  };

  if (combo.includes('kalamkari') || combo.includes('dupatta') || combo.includes('saree') || combo.includes('ikat') || combo.includes('handloom') || combo.includes('silk') || combo.includes('cotton')) {
    q2Obj = {
      id: 'q2_materials',
      num: 2,
      te: '2. (చేనేత/టెక్స్‌టైల్) ఏ రకమైన దారం, మగ్గం, మరియు రంగులు (సహజ లేదా ఆర్గానిక్) వాడారు?',
      hi: '2. (वस्त्र एवं बुनाई) किस प्रकार का धागा, हथकरघा और रंग (प्राकृतिक या जैविक) उपयोग किया?',
      en: '2. (Textile & Weave) What yarn count, loom type, and natural/organic dyes were used?',
      ta: '2. (கைத்தறி) என்ன நூல், தறி மற்றும் இயற்கை சாயங்கள் பயன்படுத்தப்பட்டன?',
      bn: '2. (তাঁত শিল্প) কি ধরনের সুতা এবং প্রাকৃতিক রঙ ব্যবহার করা হয়েছে?',
      placeholder: {
        te: 'ఉదాహరణ: 100% మల్బరీ పట్టు, కరక్కాయ మరియు సహజ రంగులు, మచిలీపట్నం అచ్చు ప్రింటింగ్...',
        hi: 'उदाहरण: 100% शहतूत रेशम, मयरोबलन एवं प्राकृतिक वनस्पति रंग...',
        en: 'e.g. 100% Mulberry Silk, Myrobalan & Alum Natural Dyes, Traditional Hand Block Print...',
        ta: 'எடுத்துக்காட்டு: 100% பட்டு, இயற்கை சாயங்கள்...',
        bn: 'উদাহরণ: খাঁটি রেশম, প্রাকৃতিক রঙ...'
      }
    };
  } else if (combo.includes('toy') || combo.includes('wood') || combo.includes('carving') || combo.includes('channapatna')) {
    q2Obj = {
      id: 'q2_materials',
      num: 2,
      te: '2. (చెక్క తయారీ) ఏ రకం చెక్క వాడారు? లాకర్/రంగులు పిల్లలకు సురక్షితమేనా?',
      hi: '2. (काष्ठ कला) किस प्रकार की लकड़ी और सुरक्षित लाख रंगों का उपयोग किया गया?',
      en: '2. (Woodcraft) What wood species (Teak/Ivorywood) and non-toxic lacquers were used?',
      ta: '2. (மர வேலை) என்ன மரவகை மற்றும் விஷமற்ற வண்ணங்கள் பயன்படுத்தப்பட்டன?',
      bn: '2. (কাঠের কাজ) কি ধরণের কাঠ এবং বিষাক্ত নয় এমন রঙ ব্যবহার করা হয়েছে?',
      placeholder: {
        te: 'ఉదాహరణ: అంకుడు చెక్క, పిల్లలకు సురక్షితమైన కూరగాయల జిగురు రంగులు...',
        hi: 'उदाहरण: अले की लकड़ी, प्राकृतिक लाख रंग...',
        en: 'e.g. Soft Ivory Wood, Non-toxic Vegetable Lacquer finish...',
        ta: 'எடுத்துக்காட்டு: இயற்கை மரம், பாதுகாப்பான சாயங்கள்...',
        bn: 'উদাহরণ: প্রাকৃতিক কাঠ, নিরাপদ রঙ...'
      }
    };
  } else if (combo.includes('pottery') || combo.includes('ceramic') || combo.includes('clay') || combo.includes('terracotta') || combo.includes('blue pottery')) {
    q2Obj = {
      id: 'q2_materials',
      num: 2,
      te: '2. (మట్టి కళ) ఏ రకం మట్టి, క్వార్ట్జ్ రాయితో తయారుచేసి ఏ నీలి రంగు గ్లేజింగ్ అద్దారు?',
      hi: '2. (मृदा कला) किस मिट्टी/क्वार्ट्ज पाउडर और कोबाल्ट चमक का उपयोग किया गया?',
      en: '2. (Ceramic & Pottery) What clay composition and cobalt metal glazes were used?',
      ta: '2. (மண்பாண்டம்) என்ன களிமண் மற்றும் இயற்கை பூச்சுகள் பயன்படுத்தப்பட்டன?',
      bn: '2. (মৃৎশিল্প) কি ধরণের মাটি এবং প্রাকৃতিক রঙের লেপ ব্যবহার করা হয়েছে?',
      placeholder: {
        te: 'ఉదాహరణ: క్వార్ట్జ్ మట్టి, కోబాల్ట్ నీలి రంగు గ్లేజింగ్, సాంప్రదాయ కొలిమిలో కాల్చినది...',
        hi: 'उदाहरण: क्वार्ट्ज मिट्टी, कोबाल्ट नीला रंग, पारंपरिक भट्टी...',
        en: 'e.g. Natural Quartz Clay Dough, Oxide Cobalt Blue Glaze, Kiln-fired...',
        ta: 'எடுத்துக்காட்டு: களிமண், இயற்கை பூச்சு...',
        bn: 'উদাহরণ: প্রাকৃতিক কাদা মাটি, প্রাকৃতিক লেপ...'
      }
    };
  } else if (combo.includes('bidriware') || combo.includes('metal') || combo.includes('silver') || combo.includes('brass')) {
    q2Obj = {
      id: 'q2_materials',
      num: 2,
      te: '2. (బిద్రి/లోహ చెక్కడం) ఏ లోహం మరియు స్వచ్ఛమైన వెండి అచ్చులు వాడారు?',
      hi: '2. (धातु कला) किस धातु मिश्र धातु और शुद्ध चांदी के तारों का उपयोग किया गया?',
      en: '2. (Metalwork & Inlay) What base alloy and pure silver wire/sheet inlays were used?',
      ta: '2. (உலோக வேலை) என்ன உலோகக் கலவை மற்றும் வெள்ளி கம்பிகள் பயன்படுத்தப்பட்டன?',
      bn: '2. (ধাতু শিল্প) কি ধাতু এবং খাঁটি রূপার তার ব্যবহার করা হয়েছে?',
      placeholder: {
        te: 'ఉదాహరణ: జింక్-రాగి అల్లాయ్, 99.9% స్వచ్ఛమైన వెండి వైర్ అచ్చు, బిదర్ మట్టి నలుపు గ్లేజ్...',
        hi: 'उदाहरण: जस्ता-तांबा मिश्र धातु, 99.9% शुद्ध चांदी का तार...',
        en: 'e.g. Zinc-Copper Alloy Base, 99.9% Pure Silver Wire Inlay, Bidar Soil Oxidation...',
        ta: 'எடுத்துக்காட்டு: வெள்ளி கம்பி, பித்தளை...',
        bn: 'উদাহরণ: খাঁটি রূপার তার, তামা...'
      }
    };
  }

  let q3Obj = {
    id: 'q3_story',
    num: 3,
    te: '3. ఈ ప్రాడక్ట్ ఎంత సమయం శ్రమించి చేశారు? పరంపరాగత ప్రత్యేకత లేదా కథ ఏమిటి?',
    hi: '3. इसे बनाने में कितना समय लगा? इसकी पारंपरिक कहानी या खासियत क्या है?',
    en: '3. How many days of artisan effort did it take? What is its unique craft heritage story?',
    ta: '3. இதை செய்ய எத்தனை நாட்கள் ஆனது? இதன் பாரம்பரிய கதை என்ன?',
    bn: '3. এটি তৈরি করতে কত দিন সময় লেগেছে? এর ঐতিহ্যবাহী গল্প কি?',
    placeholder: {
      te: 'ఉదాహరణ: 10 రోజులు శ్రమించి తరతరాల అనుభవంతో వేసిన చేతి పని...',
      hi: 'उदाहरण: 10 दिनों का कठिन परिश्रम, पीढ़ियों पुरानी कला...',
      en: 'e.g. Takes 10 days of painstaking handcraft by master artisan using 3rd gen family heritage technique...',
      ta: 'எடுத்துக்காட்டு: 10 நாட்கள் கைவினை உழைப்பு...',
      bn: 'উদাহরণ: ১০ দিনের কঠোর পরিশ্রমের ফসল...'
    }
  };

  return [
    {
      id: 'q1_title',
      num: 1,
      te: '1. మీ ప్రొడక్ట్ పేరు మరియు వర్గం ఏమిటి?',
      hi: '1. आपके उत्पाद का नाम और श्रेणी क्या है?',
      en: '1. What is your product name and craft type?',
      ta: '1. உங்கள் பொருளின் பெயர் மற்றும் வகை என்ன?',
      bn: '1. আপনার পণ্যের নাম এবং শ্রেণী কি?',
      placeholder: {
        te: 'ఉదాహరణ: మచిలీపట్నం హ్యాండ్‌ప్రింటెడ్ కలంకారి దుపట్టా...',
        hi: 'उदाहरण: मछलीपट्टनम हस्त निर्मित कलमकारी दुपट्टा...',
        en: 'e.g. Handpainted Kalamkari Silk Dupatta...',
        ta: 'எடுத்துக்காட்டு: கைத்தறி துப்பட்டா...',
        bn: 'উদাহরণ: হাতে বোনা শাড়ি...'
      }
    },
    q2Obj,
    q3Obj
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

  const QNA_QUESTIONS = [
    {
      id: 'q1_title',
      num: 1,
      te: '1. మీ ప్రొడక్ట్ పేరు ఏమిటి?',
      hi: '1. आपके उत्पाद का नाम क्या है?',
      en: '1. What is your product name?',
      ta: '1. உங்கள் பொருளின் பெயர் என்ன?',
      bn: '1. আপনার পণ্যের নাম কি?',
      placeholder: {
        te: 'ఉదాహరణ: చేతితో నేసిన కలంకారి దుపట్టా...',
        hi: 'उदाहरण: हाथ से बुना हुआ कलमकारी दुपट्टा...',
        en: 'e.g. Handpainted Kalamkari Silk Dupatta...',
        ta: 'எடுத்துக்காட்டு: கைத்தறி துப்பட்டா...',
        bn: 'উদাহরণ: হাতে বোনা শাড়ি...'
      }
    },
    {
      id: 'q2_materials',
      num: 2,
      te: '2. ఇది చేతితో చేసినదా? ఏం మెటీరియల్స్ వాడారు?',
      hi: '2. क्या यह हस्तनिर्मित है? कौन सी सामग्री का उपयोग किया गया है?',
      en: '2. Is it handmade? What materials did you use?',
      ta: '2. இது கையால் செய்யப்பட்டதா? என்ன பொருட்கள் பயன்படுத்தப்பட்டன?',
      bn: '2. এটি কি হাতে তৈরি? কি উপাদান ব্যবহার করা হয়েছে?',
      placeholder: {
        te: 'ఉదాహరణ: 100% పట్టు నూలు, సహజ రంగులు...',
        hi: 'उदाहरण: 100% रेशम, प्राकृतिक वनस्पति रंग...',
        en: 'e.g. 100% Pure Mulberry Silk, Natural Organic Dyes...',
        ta: 'எடுத்துக்காட்டு: 100% பட்டு, இயற்கை சாயங்கள்...',
        bn: 'উদাহরণ: খাঁটি রেশম, প্রাকৃতিক রঙ...'
      }
    },
    {
      id: 'q3_story',
      num: 3,
      te: '3. ఈ ప్రాడక్ట్ ఎలా తయారుచేశారు? ప్రత్యేకత ఏంటి?',
      hi: '3. यह कैसे बनाया गया? इसकी खासियत या कहानी बताएं।',
      en: '3. How was it crafted? Tell us its story:',
      ta: '3. இது எவ்வாறு செய்யப்பட்டது? இதன் கதையை கூறுங்கள்:',
      bn: '3. এটি কিভাবে তৈরি করা হয়েছে? এর গল্প বলুন:'
    }
  ];

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
  const { language: activeLanguage, t } = useLanguage();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedLang, setSelectedLang] = useState(activeLanguage || 'te');

  useEffect(() => {
    if (activeLanguage) {
      setSelectedLang(activeLanguage);
    }
  }, [activeLanguage, isOpen]);
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [selectedBackdrop, setSelectedBackdrop] = useState('royal_silk');
  const [costs, setCosts] = useState({ material: '', labour: '', packaging: '' });
  const [aiDraft, setAiDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imgErrorOriginal, setImgErrorOriginal] = useState(false);
  const [imgErrorEnhanced, setImgErrorEnhanced] = useState(false);
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
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

  // Native WebRTC Audio Recording with Timer & Honest Fallback
  const startRecording = async (targetQnaKey = null) => {
    try {
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

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Concurrent Speech Recognition if available
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.lang = selectedLang === 'te' ? 'te-IN' : selectedLang === 'hi' ? 'hi-IN' : 'en-IN';
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map((res) => res[0].transcript)
              .join('');
            if (transcript) {
              if (targetQnaKey) {
                setQnaAnswers((prev) => ({ ...prev, [targetQnaKey]: transcript }));
              } else {
                setVoiceText(transcript);
              }
            }
          };
          recognition.start();
        } catch (e) {
          console.warn('Speech recognition parallel listener skipped', e);
        }
      }
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setMicError('Microphone input unavailable. You can type your description directly below.');
      notify.warning('Microphone access unavailable. Please type your craft description.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
    const oth = Number(costs.other) || 0;
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
          suggested_price: costBasis > 0 ? Math.round(costBasis * 1.40) : null,
          min_fair_price: minFair,
          pricing_available: costBasis > 0,
          pricing_source: costBasis > 0 ? 'COST_PLUS_MARGIN' : 'AWAITING_ARTISAN_INPUT',
          notice: costBasis > 0 ? 'Saved locally in rural offline mode.' : 'Saved locally in rural offline mode. Cost inputs omitted; please set selling price manually.',
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

    try {
      const res = await processAICatalog({
        voice_description: voiceText.trim(),
        language: selectedLang,
        image_url: effectiveImg,
        category_hint: effectiveCat,
        material_cost: mat || null,
        labour_cost: lab || null,
        packaging_cost: pkg || null,
        other_cost: oth || null
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
    setCosts({ material: '', labour: '', packaging: '', other: '' });
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
    const finalPrice = Number(aiDraft.suggested_price);
    if (!finalPrice || finalPrice <= 0) {
      notify.warning('Please enter a valid selling price before publishing.');
      return;
    }

    // Always publish in English as primary title, description, and craft story
    const pubTitle = (aiDraft.title_en || aiDraft.title || '').trim();
    const pubDesc = (aiDraft.description_en || aiDraft.description || '').trim();
    const pubStory = (aiDraft.craft_story_en || aiDraft.craft_story || '').trim();

    setPublishing(true);
    if (isOffline) {
      queueProductDraft({
        title: pubTitle,
        category: aiDraft.category,
        materials: aiDraft.materials,
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
        image_url: aiDraft.image_url,
        enhanced_image_url: aiDraft.enhanced_image_url,
        status: 'DRAFT'
      });
      onPublished(`Saved "${pubTitle}" to local device queue (Pending Cloud Sync)!`);
      setPublishing(false);
      resetForm();
      onClose();
      return;
    }

    try {
      await approveAndPublishAICatalog({
        title: pubTitle,
        category: aiDraft.category,
        materials: aiDraft.materials,
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
        image_url: aiDraft.image_url,
        enhanced_image_url: aiDraft.enhanced_image_url,
        status: 'PUBLISHED'
      });
      onPublished(`Successfully published "${pubTitle}" to catalog!`);
      resetForm();
      onClose();
    } catch (err) {
      notify.error('Approval failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Voice-First AI Smart Cataloging Studio</h3>
              <p className="text-xs text-slate-500">Capture photo + Speak in native language → AI Catalog Draft</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Stage Product Lifecycle State Machine */}
        <div className="pt-2 pb-2 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 shrink-0 overflow-x-auto">
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

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-4">
        {/* STEP 1: Input Flow */}
        {step === 'INPUT' && (
          <div className="mt-4 space-y-4">
            {/* Sub-step Progress Navigation Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setInputSubStep('PHOTO')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'PHOTO'
                    ? 'bg-white text-amber-800 shadow-xs border border-amber-200 font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>1. Craft Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSubStep('QNA')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'QNA'
                    ? 'bg-white text-indigo-800 shadow-xs border border-indigo-200 font-extrabold'
                    : 'hover:text-slate-900'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. AI Guided Q&A</span>
              </button>

              <button
                type="button"
                onClick={() => setInputSubStep('COSTS')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  inputSubStep === 'COSTS'
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200 font-extrabold'
                    : 'hover:text-slate-900'
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
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
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
                  <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3.5 overflow-hidden">
                      <img
                        src={customImageUrl}
                        alt="Selected Craft"
                        className="w-20 h-20 rounded-xl object-cover border border-amber-200 shrink-0 shadow-sm"
                        onError={() => setImgErrorOriginal(true)}
                      />
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-extrabold text-slate-900">
                            {selectedPhoto ? selectedPhoto.name : 'Photo Attached Successfully'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Ready for AI Multimodal Vision Analysis & Studio Background Lighting.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-1.5 shrink-0">
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
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/80 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 group-hover:scale-110 flex items-center justify-center mb-2 transition-transform shadow-xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">Take Photo (Camera)</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Capture live with phone camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-600 bg-amber-50/40 hover:bg-amber-50/80 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 group-hover:scale-110 flex items-center justify-center mb-2 transition-transform shadow-xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">Upload Image File</span>
                      <span className="text-[10px] text-slate-500">Choose from device photo gallery</span>
                    </button>
                  </div>
                )}

                {/* Sample Inspiration Crafts (Explicitly Separated Demo Examples) */}
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-extrabold text-slate-700 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Or Try a Demo Inspiration Craft Example</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      🧪 Demo Examples Only
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2.5">
                    Clicking a sample below loads a pre-configured craft image and story for quick testing without uploading your own photo.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {SAMPLE_PHOTOS.map((p) => (
                      <div
                        key={p.name}
                        onClick={() => handlePhotoSelect(p)}
                        className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedPhoto?.name === p.name ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="absolute top-1 right-1 z-10">
                          <span className="text-[9px] font-extrabold bg-amber-600 text-white px-1.5 py-0.5 rounded shadow-xs">
                            DEMO
                          </span>
                        </div>
                        <img src={p.url} alt={p.name} className="w-full h-18 object-cover" />
                        <div className="p-1.5 bg-white text-center">
                          <span className="text-[11px] font-bold text-slate-800 truncate block">{p.name}</span>
                          <span className="text-[9px] text-amber-700 font-semibold">{p.category}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setInputSubStep('QNA')}
                    className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-indigo-50 border border-indigo-200 rounded-2xl gap-2">
                  <div>
                    <span className="text-xs font-extrabold text-indigo-900 block">AI Adaptive Voice & Text Questions</span>
                    <span className="text-[11px] text-indigo-700 block">Questions automatically adapt based on your craft category & inputs:</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shrink-0">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
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
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">Microphone Access Notice: </span>
                        <span>{micError}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMicError(null); startRecording(); }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 cursor-pointer shrink-0 ml-2"
                    >
                      Retry Mic
                    </button>
                  </div>
                )}

                {/* 3 Dynamic Adaptive Question Cards */}
                <div className="space-y-3">
                  {getAdaptiveQnaQuestions(qnaAnswers, selectedPhoto, selectedLang).map((q, idx) => {
                    const questionText = q[selectedLang] || q.en;
                    const phText = q.placeholder?.[selectedLang] || q.placeholder?.en || 'Type or click microphone to speak answer...';
                    const answerVal = qnaAnswers[q.id] || '';

                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          activeQnaIndex === idx
                            ? 'border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-500/10 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                        onClick={() => setActiveQnaIndex(idx)}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] flex items-center justify-center shrink-0">
                              {q.num}
                            </span>
                            <span>{questionText}</span>
                          </label>
                        </div>

                        <div className="relative mt-2">
                          <textarea
                            rows="2"
                            value={answerVal}
                            onChange={(e) => setQnaAnswers({ ...qnaAnswers, [q.id]: e.target.value })}
                            placeholder={phText}
                            className="w-full text-xs border border-slate-200 rounded-xl p-2.5 pr-22 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveQnaIndex(idx);
                              if (isRecording) {
                                stopRecording();
                              } else {
                                startRecording(q.id);
                              }
                            }}
                            className={`absolute right-2 top-2 px-2.5 py-1.5 rounded-lg transition-all text-xs font-bold flex items-center space-x-1 cursor-pointer ${
                              isRecording && activeQnaIndex === idx
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            {isRecording && activeQnaIndex === idx ? (
                              <>
                                <MicOff className="w-3.5 h-3.5" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-3.5 h-3.5" />
                                <span>Speak</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Combined Voice Text Preview / Additional Details */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">
                    Combined Craft Description for Gemini AI:
                  </span>
                  <p className="text-xs text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200 leading-snug">
                    {voiceText || 'Answer the questions above or speak via microphone to build your catalog description.'}
                  </p>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setInputSubStep('PHOTO')}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                  >
                    ← Back to Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputSubStep('COSTS')}
                    className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <span>Next: Cost & Margin</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Material Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.material}
                      placeholder="e.g. 450"
                      onChange={(e) => setCosts({ ...costs, material: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Labour Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.labour}
                      placeholder="e.g. 400"
                      onChange={(e) => setCosts({ ...costs, labour: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Packaging Cost (₹)</label>
                    <input
                      type="number"
                      value={costs.packaging}
                      placeholder="e.g. 60"
                      onChange={(e) => setCosts({ ...costs, packaging: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Other Costs (₹)</label>
                    <input
                      type="number"
                      value={costs.other || ''}
                      placeholder="e.g. 40"
                      onChange={(e) => setCosts({ ...costs, other: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Live Cost Basis & Minimum Fair Price Calculation Display */}
                {((Number(costs.material) || 0) + (Number(costs.labour) || 0) + (Number(costs.packaging) || 0) + (Number(costs.other) || 0)) > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 block">Calculated Total Cost Basis:</span>
                      <span className="text-xs font-bold text-amber-800">
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
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setInputSubStep('QNA')}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
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
          <div className="mt-4 space-y-4 pr-1">
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
                  <div 
                    className="border-2 border-amber-500/50 rounded-xl overflow-hidden relative shadow-xs p-1 transition-all"
                    style={{ background: STUDIO_BACKDROPS.find(b => b.id === selectedBackdrop)?.style || STUDIO_BACKDROPS[0].style }}
                  >
                    <span className="absolute top-2 left-2 z-10 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center space-x-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Studio ({STUDIO_BACKDROPS.find(b => b.id === selectedBackdrop)?.name})</span>
                    </span>
                    {!imgErrorEnhanced ? (
                      <img
                        src={aiDraft.enhanced_image_url || aiDraft.image_url}
                        alt="Enhanced Studio"
                        className="w-full h-34 object-contain rounded-lg drop-shadow-2xl filter contrast-105 brightness-105"
                        onError={() => setImgErrorEnhanced(true)}
                      />
                    ) : (
                      <div className="w-full h-34 bg-amber-50/50 flex flex-col items-center justify-center text-amber-600/70 text-xs p-3 text-center">
                        <ImageIcon className="w-8 h-8 text-amber-300 mb-1" />
                        <span className="text-[11px] font-medium text-slate-600">AI Studio preview pending</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Studio Backdrop Filter Controls */}
                <div className="mt-2.5 p-2 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-900 shrink-0 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Select Backdrop Studio Lighting:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {STUDIO_BACKDROPS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBackdrop(b.id)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          selectedBackdrop === b.id
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
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

            {/* Language Review & Global Publishing Indicator Header */}
            <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-extrabold text-indigo-900 flex items-center space-x-1.5">
                  <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Marketplace Listing Language: 🇬🇧 English (Global Standard)</span>
                </span>
                <span className="text-[11px] text-indigo-700 block mt-0.5">
                  Voice input ({selectedLang.toUpperCase()}) was auto-translated into English for global buyers while preserving native translations.
                </span>
              </div>
              <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-indigo-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewLang('en')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    reviewLang === 'en'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇬🇧 English (Publish Default)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewLang('native')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    reviewLang === 'native'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇮🇳 Native ({selectedLang.toUpperCase()})
                </button>
              </div>
            </div>

            {/* Editable Draft Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Generated Title (Editable - {reviewLang === 'en' ? 'English Standard' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <input
                  type="text"
                  value={reviewLang === 'en' ? (aiDraft.title_en || aiDraft.title || '') : (aiDraft.title_native || aiDraft.title || '')}
                  onChange={(e) => handleDraftChange('title', e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={aiDraft.category || ''}
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
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marketplace Description ({reviewLang === 'en' ? 'English' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <textarea
                  rows="2"
                  value={reviewLang === 'en' ? (aiDraft.description_en || aiDraft.description || '') : (aiDraft.description_native || aiDraft.description || '')}
                  onChange={(e) => handleDraftChange('description', e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Heritage & Cultural Craft Story ({reviewLang === 'en' ? 'English' : `Native ${selectedLang.toUpperCase()}`})
                </label>
                <textarea
                  rows="2"
                  value={reviewLang === 'en' ? (aiDraft.craft_story_en || aiDraft.craft_story || '') : (aiDraft.craft_story_native || aiDraft.craft_story || '')}
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

              {/* Auto Smart Pricing Toggle */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-indigo-900 block">Enable Auto Smart Pricing</span>
                  <span className="text-[11px] text-indigo-700 block">
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
    </div>
  );
}
