import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  createAudioPlayer,
  AudioPlayer
} from "expo-audio";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";
import { Ionicons } from "@expo/vector-icons";
import { api, BASE_URL } from "../src/api";
import { imageAssetToApiSource } from "../src/media";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  PrimaryButton,
  SecondaryButton,
  Chip
} from "../src/components";
import { useI18n, AppLanguage } from "../src/i18n";

// ─── 1. SAMPLE CRAFTS (Exact match to Web AICatalogStudioModal) ───
const SAMPLE_PHOTOS = [
  {
    name: "Kalamkari Dupatta",
    category: "Kalamkari",
    url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
    materials: "Pure Mulberry Silk, Natural Vegetable Dyes",
    te: "ఇది మచిలీపట్నం కలంకారి చేతితో వేసిన సిల్క్ దుపట్టా. సహజ కూరగాయల రంగులతో 10 రోజులు శ్రమించి వేశాం.",
    hi: "यह मछलीपट्टनम कलमकारी रेशम दुपट्टा है। प्राकृतिक रंगों से हाथ से बनाया गया है।",
    en: "This is a hand-painted Machilipatnam Kalamkari silk dupatta made using 100% natural organic dyes.",
    ta: "இது மச்சிலிப்பட்டினம் கலம்வாரி பட்டு துப்பட்டா. இயற்கை சாயங்களால் 10 நாட்கள் கையால் செய்யப்பட்டது.",
    bn: "এটি মছিলিপত্তনম কলমকারি সিল্ক ওড়না। ১০০% প্রাকৃতিক জৈব রং দিয়ে হাতে তৈরি।"
  },
  {
    name: "Channapatna Wooden Toy",
    category: "Wooden Toys",
    url: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
    materials: "Ivory Wood (Aale Mara), Natural Lacquer Dyes",
    te: "ఇది చెక్కతో చేసిన సాంప్రదాయ చెన్నపట్న బొమ్మ. పిల్లలకు సురక్షితమైన సహజ రంగులు వాడాము.",
    hi: "यह पारंपरिक चन्नापटना लकड़ी का खिलौना है, बच्चों के लिए प्राकृतिक लाख रंगों से सुरक्षित बना है।",
    en: "This is a traditional Channapatna wooden rolling toy made from ivory wood and non-toxic vegetable lacquer.",
    ta: "இது பாரம்பரிய சன்னபட்டணா மர பொம்மை, குழந்தைகளுக்கு பாதுகாப்பானது.",
    bn: "এটি চন্নাপট্টনার ঐতিহ্যবাহী কাঠের খেলনা, শিশুদের জন্য বিষমুক্ত প্রাকৃতিক রঙে তৈরি।"
  },
  {
    name: "Jaipur Blue Pottery Bowl",
    category: "Blue Pottery",
    url: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80",
    materials: "Ground Quartz Stone, Multani Mitti, Cobalt Oxide",
    te: "ఇది జైపూర్ బ్లూ పాట్టరీ డెకరేటివ్ బౌల్. క్వార్ట్జ్ రాయితో తయారుచేసి సహజ కోబాల్ట్ నీలి రంగు వేశాం.",
    hi: "यह जयपुर ब्लू पॉटरी की हस्तनिर्मित सजावटी कटोरी है, जिसमें कोबाल्ट रंग का उपयोग किया गया है।",
    en: "This is an authentic Jaipur blue pottery decorative ceramic bowl glazed with natural cobalt and quartz.",
    ta: "இது ஜெய்ப்பூர் நீல மண்பாண்ட அலங்கார கிண்ணம்.",
    bn: "এটি জয়পুর ব্লু পটারি আলংকারিক সিরামিক বাটি।"
  },
  {
    name: "Bidriware Silver Plate",
    category: "Bidriware",
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    materials: "Zinc-Copper Alloy, 99.9% Pure Silver Wire",
    te: "ఇది బిద్రి వెండి చెక్కడపు ప్లేట్. బిదర్ కోట మట్టితో నలుపు రంగు తెచ్చి స్వచ్ఛమైన వెండి వైర్ అద్దాము.",
    hi: "यह बीदरीवेयर का शुद्ध चांदी के तारों से जड़ा हुआ सजावटी बर्तन है, बीदर के किले की मिट्टी से काला किया गया है।",
    en: "This is an imperial Bidriware ornamental vessel with 99.9% pure silver wire inlay on oxidized zinc alloy.",
    ta: "இது பித்ரிவேர் தூய வெள்ளி வேலைப்பாடு அலங்கார தட்டு.",
    bn: "এটি বিদরিওয়্যার ৯৯.৯% খাঁটি রুপোর তারের কাজ করা আলংকারিক পাত্র।"
  }
];

// ─── 2. SUPPORTED LANGUAGES (Exact match to Web) ───
const LANGUAGES = [
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "bn", label: "বাংলা (Bengali)" }
];

// ─── 3. STUDIO LIGHTING BACKDROPS (Exact match to Web) ───
const STUDIO_BACKDROPS = [
  { id: "marble_pedestal", label: "🏛️ Slate White", name: "Studio Slate White" },
  { id: "neutral_warm", label: "✨ Warm Cream", name: "Artisan Warm Cream" },
  { id: "royal_silk", label: "👑 Royal Silk", name: "Royal Silk" },
  { id: "teak_wood", label: "🪵 Teak Wood", name: "Teak Wood Table" },
  { id: "courtyard", label: "🌺 Courtyard", name: "Heritage Courtyard" }
];

// ─── 4. 3 GUIDED CONVERSATIONAL QUESTIONS (Exact match to Web) ───
const QNA_QUESTIONS = [
  {
    id: "q1_title",
    num: 1,
    badge: "PRODUCT & CRAFT",
    title: "Product Name & Craft Tradition",
    te: "మీరు తయారు చేసిన ఈ వస్తువు పేరు ఏంటి? ఇది ఏ రకమైన చేతివృత్తికి సంబంధించినది?",
    hi: "आपने जो यह वस्तु बनाई है, उसका नाम क्या है? यह किस प्रकार की हस्तकला से जुड़ी है?",
    en: "What is the name of this product, and what type of craft does it belong to?",
    ta: "நீங்கள் தயாரித்த இந்த பொருளின் பெயர் என்ன? இது எந்த வகையான கைவினையைச் சேர்ந்தது?",
    bn: "আপনি তৈরি করা এই পণ্যটির নাম কী? এটি কোন ধরনের হস্তশিল্পের সঙ্গে যুক্ত?",
    placeholder: "e.g. Handpainted Kalamkari Silk Dupatta, Wooden Rocking Horse..."
  },
  {
    id: "q2_materials",
    num: 2,
    badge: "MATERIALS & PROCESS",
    title: "Materials & Handmade Process",
    te: "దీన్ని తయారు చేయడానికి ఏ పదార్థాలు వాడారు? ఇది పూర్తిగా చేతితో తయారు చేశారా?",
    hi: "इसे बनाने के लिए आपने किन सामग्रियों का इस्तेमाल किया? क्या यह पूरी तरह हाथ से बनाया गया है?",
    en: "What materials did you use to make it? Is it completely handmade?",
    ta: "இதை தயாரிக்க என்ன பொருட்களை பயன்படுத்தினீர்கள்? இது முழுவதும் கையால் செய்யப்பட்டதா?",
    bn: "এটি তৈরি করতে আপনি কী কী উপকরণ ব্যবহার করেছেন? এটি কি পুরোপুরি হাতে তৈরি?",
    placeholder: "e.g. 100% Mulberry silk, natural indigo dye, bamboo kalam, pure handmade..."
  },
  {
    id: "q3_story",
    num: 3,
    badge: "HERITAGE & LINEAGE",
    title: "Artisan Lineage & Craft Story",
    te: "ఒక్క వస్తువును తయారు చేయడానికి సాధారణంగా ఎంత సమయం పడుతుంది? ఈ కళకు సంబంధించిన ప్రత్యేకత లేదా మీ కుటుంబ కథ ఏదైనా ఉందా?",
    hi: "एक वस्तु बनाने में आमतौर पर कितना समय लगता है? इस कला की कोई खासियत या आपके परिवार से जुड़ी कोई कहानी है?",
    en: "How much time does it usually take to make one piece? Is there anything special about this craft or a story from your family?",
    ta: "ஒரு பொருளை தயாரிக்க பொதுவாக எவ்வளவு நேரம் ஆகும்? இந்த கைவினையின் சிறப்பு அல்லது உங்கள் குடும்பக் கதை ஏதேனும் உள்ளதா?",
    bn: "একটি পণ্য তৈরি করতে সাধারণত কত সময় লাগে? এর বিশেষত্ব বা আপনার পরিবারের কোনো ঐতিহ্যবাহী গল্প আছে কি?",
    placeholder: "e.g. It takes 10 days to complete, craft lineage practiced for 3 generations..."
  }
];

export default function SellerAICatalogStudio() {
  // Main workflow steps: 'INPUT' (1) -> 'PROCESSING' (2) -> 'REVIEW' (3)
  const [step, setStep] = useState<"INPUT" | "PROCESSING" | "REVIEW">("INPUT");

  // Input sub-steps: 'PHOTO' -> 'QNA' -> 'COSTS'
  const [inputSubStep, setInputSubStep] = useState<"PHOTO" | "QNA" | "COSTS">("PHOTO");
  const [activeQnaIndex, setActiveQnaIndex] = useState(0);

  // Core Form State
  const { language: appLanguage, setLanguage: setAppLanguage } = useI18n();
  const [selectedLang, setSelectedLang] = useState<string>(appLanguage || "te");

  useEffect(() => {
    if (appLanguage) {
      setSelectedLang(appLanguage);
    }
  }, [appLanguage]);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [categoryHint, setCategoryHint] = useState("");
  const [qnaAnswers, setQnaAnswers] = useState({
    q1_title: "",
    q2_materials: "",
    q3_story: ""
  });

  // Cost breakdown
  const [materialCost, setMaterialCost] = useState("");
  const [labourCost, setLabourCost] = useState("");
  const [packagingCost, setPackagingCost] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [targetSellingPrice, setTargetSellingPrice] = useState("");

  // Audio Recording State
  const [isRecordingPermissionGranted, setIsRecordingPermissionGranted] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // Audio TTS playback state
  const [speakingQId, setSpeakingQId] = useState<string | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  // AI Pipeline Output & Review State
  const [aiDraft, setAiDraft] = useState<any>(null);
  const [selectedBackdrop, setSelectedBackdrop] = useState("marble_pedestal");
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [reviewLang, setReviewLang] = useState<"en" | "native">("en");

  // Editable fields in Review
  const [editTitle, setEditTitle] = useState("");
  const [editTitleNative, setEditTitleNative] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editMaterials, setEditMaterials] = useState("");
  const [editStory, setEditStory] = useState("");
  const [editStoryNative, setEditStoryNative] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDescriptionNative, setEditDescriptionNative] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("5");
  const [publishing, setPublishing] = useState(false);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch {}
      }
    };
  }, []);

  // ─── Image Selection Handlers ───
  const usePickedImage = async (asset: {
    uri: string;
    base64?: string | null;
    mimeType?: string | null;
  }) => {
    try {
      setImagePreviewUri(asset.uri);
      // Keep the JSON request below the production proxy body limit.
      const optimized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        {
          compress: 0.45,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );
      setImageUri(
        imageAssetToApiSource({
          uri: optimized.uri,
          base64: optimized.base64,
          mimeType: "image/jpeg"
        })
      );
    } catch (error: any) {
      Alert.alert("Photo Unavailable", error?.message || "Please choose the image again.");
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      base64: true
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      usePickedImage(res.assets[0]);
    }
  };

  const snapPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return Alert.alert("Camera Permission", "Camera access is needed to photograph craft items.");
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: true });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      usePickedImage(res.assets[0]);
    }
  };

  const handleSelectSampleCraft = (sample: typeof SAMPLE_PHOTOS[0]) => {
    setImageUri(sample.url);
    setImagePreviewUri(sample.url);
    setCategoryHint(sample.category);

    const langText = (sample as any)[selectedLang] || sample.en;
    setQnaAnswers({
      q1_title: sample.name,
      q2_materials: sample.materials,
      q3_story: langText
    });
    Alert.alert("Sample Loaded", `Loaded authentic details for "${sample.name}". You can customize them or proceed directly.`);
  };

  // ─── Native Speech-to-Text Recognition ───
  const [isRecognizing, setIsRecognizing] = useState(false);

  useSpeechRecognitionEvent("start", () => {
    setIsRecognizing(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecognizing(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      const activeQ = QNA_QUESTIONS[activeQnaIndex];
      setQnaAnswers((prev) => ({
        ...prev,
        [activeQ.id]: transcript
      }));
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.warn("Speech recognition error:", event.error, event.message);
    setIsRecognizing(false);
  });

  const handleToggleSpeech = async () => {
    try {
      if (isRecognizing) {
        await ExpoSpeechRecognitionModule.stop();
        setIsRecognizing(false);
        return;
      }

      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        return Alert.alert(
          "Microphone Permission",
          "Microphone access is required to speak your answer."
        );
      }

      const localeMap: Record<string, string> = {
        te: "te-IN",
        hi: "hi-IN",
        en: "en-IN",
        ta: "ta-IN",
        bn: "bn-IN",
        kn: "kn-IN",
        mr: "mr-IN",
        gu: "gu-IN",
      };
      const langCode = localeMap[selectedLang] || "te-IN";

      await ExpoSpeechRecognitionModule.start({
        lang: langCode,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (err: any) {
      console.warn("Failed to start speech recognition:", err);
      Alert.alert("Speech Error", err?.message || "Could not start speech recognition.");
      setIsRecognizing(false);
    }
  };

  // ─── TTS Voice Readout of Questions ───
  const handleSpeakQuestion = async (qId: string, text: string) => {
    if (speakingQId === qId) {
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch {}
      }
      setSpeakingQId(null);
      return;
    }

    try {
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
        } catch {}
      }

      setSpeakingQId(qId);
      const url = `${BASE_URL}/api/tts?text=${encodeURIComponent(text)}&lang=${selectedLang}`;
      const player = createAudioPlayer({ uri: url });
      audioPlayerRef.current = player;
      player.play();
    } catch (err: any) {
      console.warn("TTS playback failed:", err);
      setSpeakingQId(null);
    }
  };

  // ─── RUN AI GENERATION (Exact payload sent by Web) ───
  const handleRunAIGeneration = async () => {
    if (!imageUri && !qnaAnswers.q1_title.trim() && !qnaAnswers.q3_story.trim()) {
      return Alert.alert(
        "Craft Details Needed",
        "Please provide a craft photograph or answer the guided questions before generating."
      );
    }

    setStep("PROCESSING");

    const effectiveCat = categoryHint.trim() || "Handicraft";
    const parsedMaterials = qnaAnswers.q2_materials
      ? qnaAnswers.q2_materials.split(",").map((s) => s.trim()).filter(Boolean)
      : ["Natural materials"];

    const combinedVoiceText = [
      qnaAnswers.q1_title ? `Product Name: ${qnaAnswers.q1_title}` : "",
      qnaAnswers.q2_materials ? `Handmade & Materials: ${qnaAnswers.q2_materials}` : "",
      qnaAnswers.q3_story ? `Craft Process & Lineage: ${qnaAnswers.q3_story}` : ""
    ].filter(Boolean).join("\n");

    const artisanFacts = {
      product_name: qnaAnswers.q1_title.trim(),
      craft_type: effectiveCat.trim(),
      materials: parsedMaterials,
      handmade: true,
      making_time: "7-10 days",
      artisan_story: qnaAnswers.q3_story.trim(),
      special_characteristics: combinedVoiceText
    };

    const mat = parseFloat(materialCost) || 0;
    const lab = parseFloat(labourCost) || 0;
    const pkg = parseFloat(packagingCost) || 0;
    const oth = parseFloat(otherCost) || 0;
    const targetPrice = parseFloat(targetSellingPrice) || 0;

    try {
      const res = await api.processCatalog({
        artisan_facts: artisanFacts,
        qna_answers: qnaAnswers,
        voice_description: combinedVoiceText,
        language: selectedLang,
        image_url: imageUri || undefined,
        category_hint: effectiveCat,
        material_cost: mat,
        labour_cost: lab,
        packaging_cost: pkg,
        other_cost: oth,
        selling_price: targetPrice
      });

      setAiDraft(res);

      // Hydrate editable fields
      let nativeTranslation: any = null;
      try {
        const translations = typeof res.translations === "string"
          ? JSON.parse(res.translations)
          : res.translations;
        nativeTranslation = translations?.[selectedLang] || null;
      } catch {}

      const englishTitle = res.title_en || res.catalog?.title_en || res.title || res.catalog?.title || artisanFacts.product_name;
      const englishStory = res.craft_story_en || res.catalog?.craft_story_en || res.craft_story || res.catalog?.craft_story || artisanFacts.artisan_story;
      const englishDescription = res.description_en || res.catalog?.description_en || res.description || res.catalog?.description || "Authentic handcrafted heritage item.";
      setEditTitle(englishTitle);
      setEditTitleNative(nativeTranslation?.title || (res.title !== englishTitle ? res.title : englishTitle));
      setEditCategory(res.category || res.catalog?.category || effectiveCat);
      setEditMaterials(res.materials || res.catalog?.materials || parsedMaterials.join(", "));
      setEditStory(englishStory);
      setEditStoryNative(nativeTranslation?.craft_story || englishStory);
      setEditDescription(englishDescription);
      setEditDescriptionNative(nativeTranslation?.description || englishDescription);

      const rawPrice =
        res.suggested_price ??
        res.price_recommendation?.recommended_price ??
        res.market_summary?.median_price ??
        res.market_summary?.min_price;
      setEditPrice(rawPrice && Number(rawPrice) > 0 ? String(Math.round(Number(rawPrice))) : "");

      setStep("REVIEW");
    } catch (err: any) {
      Alert.alert("AI Generation Error", err?.detail || err?.message || "AI cataloging service timed out. Please retry.");
      setStep("INPUT");
    }
  };

  // ─── IMAGE ENHANCEMENT (Backdrop studio) ───
  const handleEnhanceImage = async () => {
    if (!imageUri) {
      return Alert.alert("No Image", "Add a photo first to enhance it.");
    }
    setEnhancing(true);
    try {
      const res = await api.enhanceImage(imageUri, selectedBackdrop);
      if (res && res.enhanced_image_url) {
        setEnhancedImageUri(res.enhanced_image_url);
        Alert.alert("Studio Lighting Enhanced", res.notice || "Backdrop lighting and contrast normalized.");
      }
    } catch (err: any) {
      Alert.alert("Enhancement Notice", err?.detail || err?.message || "Enhancement preview unavailable.");
    } finally {
      setEnhancing(false);
    }
  };

  // ─── SUBMIT CATALOG FOR REVIEW / PUBLISH ───
  const handleSubmitForReview = async () => {
    if (!aiDraft?.draft_token) {
      return Alert.alert("Error", "Missing verified server draft token.");
    }
    if (!editTitle.trim()) {
      return Alert.alert("Title Required", "Please specify a product title.");
    }
    if (!editPrice || parseFloat(editPrice) <= 0) {
      return Alert.alert("Price Required", "Please enter a valid selling price.");
    }

    setPublishing(true);
    const submissionPayload: Record<string, unknown> = {
      draft_token: aiDraft.draft_token,
      title: editTitle.trim(),
      category: editCategory.trim(),
      materials: editMaterials.trim() || undefined,
      description: editDescription.trim() || undefined,
      craft_story: editStory.trim() || undefined,
      title_en: editTitle.trim() || undefined,
      description_en: editDescription.trim() || undefined,
      craft_story_en: editStory.trim() || undefined,
      translations: JSON.stringify({
        [selectedLang]: {
          title: editTitleNative.trim() || editTitle.trim(),
          description: editDescriptionNative.trim() || editDescription.trim(),
          craft_story: editStoryNative.trim() || editStory.trim()
        },
        en: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          craft_story: editStory.trim()
        }
      }),
      price: parseFloat(editPrice),
      stock: parseInt(editStock, 10) || 5,
      material_cost: parseFloat(materialCost) || 0,
      labour_cost: parseFloat(labourCost) || 0,
      packaging_cost: parseFloat(packagingCost) || 0,
      other_cost: parseFloat(otherCost) || 0,
      image_url: imageUri || undefined,
      enhanced_image_url: enhancedImageUri || undefined,
      status: "PUBLISHED"
    };

    try {
      await api.submitCatalogForApproval(submissionPayload);
      Alert.alert(
        "Catalogue Submitted",
        `"${editTitle}" has been submitted for verification. It will appear in your creations list.`,
        [
          {
            text: "View My Creations",
            onPress: () => router.replace("/seller-products")
          }
        ]
      );
    } catch (err: any) {
      Alert.alert("Submission Failed", err?.detail || err?.message || "Could not submit the catalogue for review.");
    } finally {
      setPublishing(false);
    }
  };

  const activeQuestion = QNA_QUESTIONS[activeQnaIndex];
  const activeQuestionText = (activeQuestion as any)[selectedLang] || activeQuestion.en;

  return (
    <Screen scrollable withBottomNavPadding={false}>
      <Header
        title="AI Catalog Studio"
        subtitle="Voice-First Multimodal AI Cataloging"
        showBack
        roleBadge="ARTISAN"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step Indicator Header (Exact match to Web 3-Step Flow) */}
        <View style={styles.stepIndicatorRow}>
          <View style={[styles.stepDot, (step === "INPUT" || step === "PROCESSING" || step === "REVIEW") && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, styles.stepDotTextActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, (step === "PROCESSING" || step === "REVIEW") && styles.stepLineActive]} />
          <View style={[styles.stepDot, (step === "PROCESSING" || step === "REVIEW") && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, (step === "PROCESSING" || step === "REVIEW") && styles.stepDotTextActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, step === "REVIEW" && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === "REVIEW" && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, step === "REVIEW" && styles.stepDotTextActive]}>3</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* STEP 1: INPUT WORKFLOW (PHOTO -> QNA -> COSTS)                            */}
        {/* ========================================================================= */}
        {step === "INPUT" && (
          <View>
            {/* Sub-step Tabs Header */}
            <View style={styles.subStepTabs}>
              <Pressable
                style={[styles.subStepTab, inputSubStep === "PHOTO" && styles.subStepTabActive]}
                onPress={() => setInputSubStep("PHOTO")}
              >
                <Ionicons name="camera-outline" size={14} color={inputSubStep === "PHOTO" ? theme.accent : theme.muted} />
                <Text style={[styles.subStepTabText, inputSubStep === "PHOTO" && styles.subStepTabTextActive]}>
                  {selectedLang === "te" ? "1. ఫోటో & భాష" : selectedLang === "hi" ? "1. फोटो व भाषा" : "1. Photo & Language"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.subStepTab, inputSubStep === "QNA" && styles.subStepTabActive]}
                onPress={() => setInputSubStep("QNA")}
              >
                <Ionicons name="chatbubbles-outline" size={14} color={inputSubStep === "QNA" ? theme.accent : theme.muted} />
                <Text style={[styles.subStepTabText, inputSubStep === "QNA" && styles.subStepTabTextActive]}>
                  {selectedLang === "te" ? "2. వాయిస్ సమాధానాలు" : selectedLang === "hi" ? "2. आवाज प्रश्नोत्तर" : "2. Voice Q&A"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.subStepTab, inputSubStep === "COSTS" && styles.subStepTabActive]}
                onPress={() => setInputSubStep("COSTS")}
              >
                <Ionicons name="cash-outline" size={14} color={inputSubStep === "COSTS" ? theme.accent : theme.muted} />
                <Text style={[styles.subStepTabText, inputSubStep === "COSTS" && styles.subStepTabTextActive]}>
                  {selectedLang === "te" ? "3. ఖర్చులు & ధర" : selectedLang === "hi" ? "3. लागत व मूल्य" : "3. Costing"}
                </Text>
              </Pressable>
            </View>

            {/* ─── SUB-STEP 1: PHOTO & LANGUAGE ─── */}
            {inputSubStep === "PHOTO" && (
              <View>
                {/* Language Picker */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>YOUR CRAFT LANGUAGE / మీ భాష</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {LANGUAGES.map((l) => (
                      <Chip
                        key={l.code}
                        label={l.label}
                        selected={selectedLang === l.code}
                        onPress={() => {
                          setSelectedLang(l.code);
                          if (l.code === "en" || l.code === "te" || l.code === "hi" || l.code === "ta" || l.code === "bn") {
                            setAppLanguage(l.code as AppLanguage);
                          }
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>

                {/* Photo Capture Card */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>CRAFT PHOTOGRAPH</Text>
                  {imagePreviewUri ? (
                    <View style={styles.photoPreviewWrapper}>
                      <Image source={{ uri: imagePreviewUri }} style={styles.photoPreview} resizeMode="cover" />
                      <Pressable style={styles.repickBtn} onPress={pickImage}>
                        <Ionicons name="camera-reverse" size={15} color="#FFFFFF" />
                        <Text style={styles.repickText}>Replace Photo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.photoPickerBox}>
                      <Ionicons name="camera" size={38} color={theme.accent} />
                      <Text style={styles.photoPickerTitle}>Capture Craft Piece</Text>
                      <Text style={styles.photoPickerSub}>Take a clear photo in good lighting</Text>
                      <View style={styles.photoBtnRow}>
                        <Pressable style={styles.photoBtn} onPress={pickImage}>
                          <Ionicons name="images-outline" size={16} color={theme.accent} />
                          <Text style={styles.photoBtnText}>Gallery</Text>
                        </Pressable>
                        <Pressable style={styles.photoBtn} onPress={snapPhoto}>
                          <Ionicons name="camera-outline" size={16} color={theme.accent} />
                          <Text style={styles.photoBtnText}>Camera</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                {imagePreviewUri ? (
                  <PrimaryButton
                    title="Instant Photo Catalog ✨"
                    onPress={handleRunAIGeneration}
                    style={{ marginTop: 10 }}
                  />
                ) : null}

                {/* Sample Crafts Carousel (Exact Match to Web) */}
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>OR QUICK-SELECT A SAMPLE CRAFT</Text>
                  <Text style={styles.helperText}>Tap any verified GI craft to auto-populate photos and details:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {SAMPLE_PHOTOS.map((sample, idx) => (
                      <Pressable
                        key={idx}
                        style={[
                          styles.sampleCard,
                          imageUri === sample.url && styles.sampleCardActive
                        ]}
                        onPress={() => handleSelectSampleCraft(sample)}
                      >
                        <Image source={{ uri: sample.url }} style={styles.sampleImg} />
                        <View style={styles.sampleInfo}>
                          <Text style={styles.sampleName} numberOfLines={1}>{sample.name}</Text>
                          <Text style={styles.sampleCat}>{sample.category}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <PrimaryButton
                  title="Continue to Guided Voice Q&A →"
                  onPress={() => setInputSubStep("QNA")}
                  style={{ marginTop: 10 }}
                />
              </View>
            )}

            {/* ─── SUB-STEP 2: GUIDED 3-QUESTION Q&A (Exact Match to Web) ─── */}
            {inputSubStep === "QNA" && (
              <View>
                {/* Question Progress Dots */}
                <View style={styles.qnaProgressRow}>
                  {QNA_QUESTIONS.map((q, idx) => (
                    <Pressable
                      key={q.id}
                      style={[
                        styles.qnaStepDot,
                        activeQnaIndex === idx && styles.qnaStepDotActive,
                        Boolean(qnaAnswers[q.id as keyof typeof qnaAnswers]) && styles.qnaStepDotCompleted
                      ]}
                      onPress={() => setActiveQnaIndex(idx)}
                    >
                      <Text style={[styles.qnaStepText, activeQnaIndex === idx && styles.qnaStepTextActive]}>
                        Q{idx + 1}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Active Question Card */}
                <View style={styles.card}>
                  <View style={styles.qnaHeaderRow}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{activeQuestion.badge}</Text>
                    </View>
                    <Pressable
                      style={styles.speakerBtn}
                      onPress={() => handleSpeakQuestion(activeQuestion.id, activeQuestionText)}
                    >
                      <Ionicons
                        name={speakingQId === activeQuestion.id ? "volume-high" : "volume-medium-outline"}
                        size={18}
                        color={theme.accent}
                      />
                      <Text style={styles.speakerBtnText}>
                        {speakingQId === activeQuestion.id
                          ? (selectedLang === "te" ? "మాట్లాడుతోంది…" : selectedLang === "hi" ? "बोल रहा है…" : "Speaking…")
                          : (selectedLang === "te" ? "ప్రశ్న వినండి" : selectedLang === "hi" ? "प्रश्न सुनें" : "Read Aloud")}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.questionTitle}>{activeQuestion.title}</Text>
                  <Text style={styles.questionSpeech}>{activeQuestionText}</Text>

                  {/* Answer Input */}
                  <TextInput
                    style={styles.answerInput}
                    placeholder={activeQuestion.placeholder}
                    placeholderTextColor="#9A8E85"
                    multiline
                    numberOfLines={3}
                    value={qnaAnswers[activeQuestion.id as keyof typeof qnaAnswers]}
                    onChangeText={(txt) => setQnaAnswers((prev) => ({ ...prev, [activeQuestion.id]: txt }))}
                  />

                  {/* Native Speech-to-Text Button */}
                  <Pressable
                    style={[
                      styles.voiceBtn,
                      isRecognizing && styles.voiceBtnRecording
                    ]}
                    onPress={handleToggleSpeech}
                  >
                    <Ionicons
                      name={isRecognizing ? "stop-circle" : "mic"}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.voiceBtnText}>
                      {isRecognizing
                        ? selectedLang === "te"
                          ? "వింటోంది... ఆపడానికి నొక్కండి"
                          : selectedLang === "hi"
                          ? "सुन रहा है... समाप्त करने के लिए टैप करें"
                          : selectedLang === "ta"
                          ? "கேட்கிறது... முடிக்க தட்டவும்"
                          : selectedLang === "bn"
                          ? "শুনছে... শেষ করতে ট্যাপ করুন"
                          : "Listening... Tap to Finish"
                        : selectedLang === "te"
                        ? "సమాధానం చెప్పండి"
                        : selectedLang === "hi"
                        ? "उत्तर बोलें"
                        : selectedLang === "ta"
                        ? "பதிலை பேசவும்"
                        : selectedLang === "bn"
                        ? "উত্তর বলুন"
                        : "Speak Answer"}
                    </Text>
                  </Pressable>
                </View>

                {/* Navigation Buttons */}
                <View style={styles.btnRow}>
                  {activeQnaIndex > 0 ? (
                    <SecondaryButton
                      title="← Previous"
                      onPress={() => setActiveQnaIndex((i) => i - 1)}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                  ) : (
                    <SecondaryButton
                      title="← Back to Photo"
                      onPress={() => setInputSubStep("PHOTO")}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                  )}

                  {activeQnaIndex < QNA_QUESTIONS.length - 1 ? (
                    <PrimaryButton
                      title="Next Question →"
                      onPress={() => setActiveQnaIndex((i) => i + 1)}
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <PrimaryButton
                      title="Costing & Pricing →"
                      onPress={() => setInputSubStep("COSTS")}
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
              </View>
            )}

            {/* ─── SUB-STEP 3: COSTING & PRICING BREAKDOWN ─── */}
            {inputSubStep === "COSTS" && (
              <View>
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>COSTING ENGINE & FAIR ARTISAN WAGES</Text>
                  <Text style={styles.helperText}>
                    Enter your actual expenses so the explainable dynamic pricing engine calculates fair market margins.
                  </Text>

                  <View style={styles.costGrid}>
                    <View style={styles.costField}>
                      <Text style={styles.costLabel}>Raw Materials (₹)</Text>
                      <TextInput
                        style={styles.costInput}
                        keyboardType="numeric"
                        value={materialCost}
                        onChangeText={setMaterialCost}
                        placeholder="0"
                      />
                    </View>

                    <View style={styles.costField}>
                      <Text style={styles.costLabel}>Artisan Labour (₹)</Text>
                      <TextInput
                        style={styles.costInput}
                        keyboardType="numeric"
                        value={labourCost}
                        onChangeText={setLabourCost}
                        placeholder="0"
                      />
                    </View>
                  </View>

                  <View style={styles.costGrid}>
                    <View style={styles.costField}>
                      <Text style={styles.costLabel}>Packaging (₹)</Text>
                      <TextInput
                        style={styles.costInput}
                        keyboardType="numeric"
                        value={packagingCost}
                        onChangeText={setPackagingCost}
                        placeholder="0"
                      />
                    </View>

                    <View style={styles.costField}>
                      <Text style={styles.costLabel}>Overheads & Freight (₹)</Text>
                      <TextInput
                        style={styles.costInput}
                        keyboardType="numeric"
                        value={otherCost}
                        onChangeText={setOtherCost}
                        placeholder="0"
                      />
                    </View>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.costLabel}>Expected Selling Price (₹) - Optional</Text>
                    <TextInput
                      style={styles.costInput}
                      keyboardType="numeric"
                      value={targetSellingPrice}
                      onChangeText={setTargetSellingPrice}
                      placeholder="e.g. 1500"
                    />
                    <Text style={styles.subHelper}>
                      Total baseline cost: ₹{(parseFloat(materialCost) || 0) + (parseFloat(labourCost) || 0) + (parseFloat(packagingCost) || 0) + (parseFloat(otherCost) || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.btnRow}>
                  <SecondaryButton
                    title="← Back to Q&A"
                    onPress={() => setInputSubStep("QNA")}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <PrimaryButton
                    title="Generate AI Catalogue ✨"
                    onPress={handleRunAIGeneration}
                    style={{ flex: 1.5 }}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: MULTIMODAL AI PROCESSING ANIMATION                                */}
        {/* ========================================================================= */}
        {step === "PROCESSING" && (
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={theme.accent} style={{ marginBottom: 20 }} />
            <Text style={styles.processingTitle}>Crafting Your AI Master Catalogue</Text>
            <Text style={styles.processingSub}>Multimodal Gemini AI is analyzing craft lineage, materials, and fair market pricing.</Text>

            <View style={styles.pipelineSteps}>
              <View style={styles.pipelineRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginRight: 10 }} />
                <Text style={styles.pipelineText}>Transcribing voice & craft heritage notes</Text>
              </View>
              <View style={styles.pipelineRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginRight: 10 }} />
                <Text style={styles.pipelineText}>Evaluating GI cluster & material authenticity</Text>
              </View>
              <View style={styles.pipelineRow}>
                <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginRight: 10 }} />
                <Text style={styles.pipelineText}>Calculating explainable fair price benchmark</Text>
              </View>
              <View style={styles.pipelineRow}>
                <Ionicons name="hourglass-outline" size={18} color={theme.accent} style={{ marginRight: 10 }} />
                <Text style={styles.pipelineText}>Generating studio lighting & high-res details</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: REVIEW & PUBLISH (Exact Match to Web AICatalogStudioModal)        */}
        {/* ========================================================================= */}
        {step === "REVIEW" && (
          <View>
            {/* Review Language Toggle */}
            <View style={styles.tabContainer}>
              <Pressable
                style={[styles.tab, reviewLang === "en" && styles.tabActive]}
                onPress={() => setReviewLang("en")}
              >
                <Text style={[styles.tabText, reviewLang === "en" && styles.tabTextActive]}>
                  English Catalogue
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, reviewLang === "native" && styles.tabActive]}
                onPress={() => setReviewLang("native")}
              >
                <Text style={[styles.tabText, reviewLang === "native" && styles.tabTextActive]}>
                  {selectedLang.toUpperCase()} Edition
                </Text>
              </Pressable>
            </View>

            {/* Studio Lighting & Backdrop Enhancement Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>STUDIO LIGHTING & BACKDROP</Text>
              <View style={styles.dualImageRow}>
                <View style={styles.imgCompareBox}>
                  <Image source={{ uri: imagePreviewUri || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800" }} style={styles.compareImg} />
                  <Text style={styles.imgCaption}>Original Photo</Text>
                </View>
                <View style={styles.imgCompareBox}>
                  <Image source={{ uri: enhancedImageUri || imagePreviewUri || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800" }} style={styles.compareImg} />
                  <Text style={styles.imgCaption}>Studio Enhanced</Text>
                </View>
              </View>

              <Text style={[styles.helperText, { marginTop: 12 }]}>Select Studio Backdrop:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {STUDIO_BACKDROPS.map((bd) => (
                  <Chip
                    key={bd.id}
                    label={bd.label}
                    selected={selectedBackdrop === bd.id}
                    onPress={() => setSelectedBackdrop(bd.id)}
                  />
                ))}
              </ScrollView>

              <Pressable
                style={[styles.enhanceBtn, enhancing && { opacity: 0.6 }]}
                onPress={handleEnhanceImage}
                disabled={enhancing}
              >
                {enhancing ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.enhanceBtnText}>
                  {enhancing ? "Enhancing Studio Lighting…" : "Apply Studio Lighting"}
                </Text>
              </Pressable>
            </View>

            {/* Explainable Dynamic Price Recommendation Card */}
            {(() => {
              const market = aiDraft?.market_summary || {};
              const research = aiDraft?.market_research || {};
              const listings = Array.isArray(research.results) ? research.results : [];
              const hasMarketData = Number(market.comparable_count || 0) > 0;
              return (
                <>
                  <View style={styles.pricingCard}>
                    <View style={styles.pricingHeaderRow}>
                      <View>
                        <Text style={styles.pricingBadge}>AI FAIR-WAGE PRICING</Text>
                        <Text style={styles.pricingValue}>
                          {editPrice ? `₹${editPrice}` : (aiDraft?.suggested_price ? `₹${aiDraft.suggested_price}` : "Awaiting calculation")}
                        </Text>
                      </View>
                      <View style={styles.fairRatioBox}>
                        <Text style={styles.fairRatioLabel}>Fair Wage Margin</Text>
                        <Text style={styles.fairRatioValue}>Cost-Floor Protected</Text>
                      </View>
                    </View>

                    <View style={styles.pricingBreakdown}>
                      {Boolean(
                        (materialCost && Number(materialCost) > 0) ||
                        (labourCost && Number(labourCost) > 0) ||
                        (packagingCost && Number(packagingCost) > 0)
                      ) ? (
                        <Text style={styles.breakdownText}>
                          • Cost Floor: Materials ₹{materialCost || "0"} | Labour ₹{labourCost || "0"} | Packaging ₹{packagingCost || "0"}
                        </Text>
                      ) : (
                        <Text style={styles.breakdownText}>
                          • Cost Floor: Derived dynamically from craft standards and living wage guidelines
                        </Text>
                      )}
                      {aiDraft?.price_recommendation?.demand_label && (
                        <Text style={styles.breakdownText}>
                          • Buyer Demand Signal: {aiDraft.price_recommendation.demand_label}
                          {aiDraft.price_recommendation.demand_factor
                            ? ` (${aiDraft.price_recommendation.demand_factor}x factor)`
                            : ""}
                        </Text>
                      )}
                      <Text style={styles.breakdownText}>
                        {market.min_price != null && market.max_price != null
                          ? Math.round(market.min_price) !== Math.round(market.max_price)
                            ? `• External Comparable Benchmark: ₹${Math.round(market.min_price)} – ₹${Math.round(market.max_price)} (Observed)`
                            : `• External Comparable Benchmark: ₹${Math.round(market.min_price)} (Single listing observed)`
                          : "• External Comparable Benchmark: Awaiting external market matches"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.marketCard}>
                    <Text style={styles.sectionLabel}>
                      {hasMarketData ? "EXTERNAL COMPARABLE PRODUCTS (PRICE BENCHMARK)" : "EXTERNAL COMPARABLE PRODUCTS — NO ONLINE MATCH"}
                    </Text>
                    <Text style={styles.marketQuery}>
                      Online listings searched for: {research.query || editTitle || editCategory}
                    </Text>
                  {hasMarketData ? (
                    <>
                      <View style={styles.marketStatsRow}>
                        <View>
                          <Text style={styles.marketStatLabel}>Observed listings</Text>
                          <Text style={styles.marketStatValue}>{market.comparable_count}</Text>
                        </View>
                        <View>
                          <Text style={styles.marketStatLabel}>Observed range</Text>
                          <Text style={styles.marketStatValue}>
                            {market.min_price != null && market.max_price != null
                              ? Math.round(market.min_price) !== Math.round(market.max_price)
                                ? `₹${Math.round(market.min_price)} - ₹${Math.round(market.max_price)}`
                                : `₹${Math.round(market.min_price)}`
                              : "Unavailable"}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.marketStatLabel}>Observed median</Text>
                          <Text style={styles.marketStatValue}>
                            {market.median_price != null ? `₹${Math.round(market.median_price)}` : "Unavailable"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.marketConfidence}>
                        Confidence: {market.market_confidence || "LOW"} · Distinct from marketplace buyer demand
                      </Text>
                      {listings.slice(0, 5).map((listing: any, index: number) => (
                        <Pressable
                          key={`${listing.url || listing.title}-${index}`}
                          style={styles.marketListing}
                          onPress={() => listing.url && Linking.openURL(listing.url).catch(() => {})}
                          disabled={!listing.url}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.marketListingTitle} numberOfLines={2}>{listing.title}</Text>
                            <Text style={styles.marketListingSource}>
                              {listing.source || "External marketplace"} · {listing.match_tier || "MATCH"}
                              {listing.url ? " ↗" : ""}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.marketListingPrice}>
                              {listing.price != null ? `₹${Math.round(listing.price)}` : "Price N/A"}
                            </Text>
                            {listing.url && (
                              <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: "600", marginTop: 2 }}>
                                View Item ↗
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      ))}
                    </>
                  ) : (
                    <Text style={styles.marketEmptyText}>
                      {research.notice || "No price-verified comparable listings found online. Dynamic pricing uses your guaranteed cost floor and category demand without inventing external products."}
                    </Text>
                  )}
                </View>
              </>
            );
          })()}

            {/* Editable Catalogue Content Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>EDITABLE CATALOGUE DETAILS</Text>

              <Text style={styles.inputLabel}>Product Title</Text>
              <TextInput
                style={styles.textInput}
                value={reviewLang === "en" ? editTitle : editTitleNative}
                onChangeText={reviewLang === "en" ? setEditTitle : setEditTitleNative}
              />

              <Text style={styles.inputLabel}>Craft Category</Text>
              <TextInput
                style={styles.textInput}
                value={editCategory}
                onChangeText={setEditCategory}
              />

              <Text style={styles.inputLabel}>Authentic Materials</Text>
              <TextInput
                style={styles.textInput}
                value={editMaterials}
                onChangeText={setEditMaterials}
              />

              <Text style={styles.inputLabel}>Artisan Craft Story & Lineage</Text>
              <TextInput
                style={[styles.textInput, { height: 70 }]}
                value={reviewLang === "en" ? editStory : editStoryNative}
                onChangeText={reviewLang === "en" ? setEditStory : setEditStoryNative}
                multiline
              />

              <Text style={styles.inputLabel}>Detailed Description</Text>
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                value={reviewLang === "en" ? editDescription : editDescriptionNative}
                onChangeText={reviewLang === "en" ? setEditDescription : setEditDescriptionNative}
                multiline
              />

              <View style={styles.costGrid}>
                <View style={styles.costField}>
                  <Text style={styles.inputLabel}>Selling Price (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editPrice}
                    onChangeText={setEditPrice}
                  />
                </View>
                <View style={styles.costField}>
                  <Text style={styles.inputLabel}>Available Stock</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={editStock}
                    onChangeText={setEditStock}
                  />
                </View>
              </View>
            </View>

            {/* Final Action Buttons */}
            <View style={styles.btnRow}>
              <SecondaryButton
                title="← Edit Inputs"
                onPress={() => setStep("INPUT")}
                style={{ flex: 1, marginRight: 8 }}
              />
              <PrimaryButton
                title={publishing ? "Submitting…" : "Publish Catalogue →"}
                onPress={handleSubmitForReview}
                loading={publishing}
                style={{ flex: 1.8 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E4DCD3",
    alignItems: "center",
    justifyContent: "center"
  },
  stepDotActive: {
    backgroundColor: theme.accent
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.muted
  },
  stepDotTextActive: {
    color: "#FFFFFF"
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E4DCD3",
    marginHorizontal: 8
  },
  stepLineActive: {
    backgroundColor: theme.accent
  },
  subStepTabs: {
    flexDirection: "row",
    backgroundColor: "#EDE5D8",
    padding: 3,
    borderRadius: 14,
    marginBottom: 16
  },
  subStepTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 11
  },
  subStepTabActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2
  },
  subStepTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.muted,
    marginLeft: 5
  },
  subStepTabTextActive: {
    color: theme.accent
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
    elevation: 1
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: theme.muted,
    marginBottom: 8
  },
  helperText: {
    fontSize: 12,
    color: theme.muted,
    lineHeight: 17
  },
  chipScroll: {
    flexDirection: "row",
    marginVertical: 6
  },
  photoPickerBox: {
    borderWidth: 1.5,
    borderColor: "#D9CDC0",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#FAF6F0",
    marginTop: 8
  },
  photoPickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.ink,
    marginTop: 8
  },
  photoPickerSub: {
    fontSize: 12,
    color: theme.muted,
    marginTop: 4,
    marginBottom: 14
  },
  photoBtnRow: {
    flexDirection: "row",
    gap: 12
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.accent,
    marginLeft: 6
  },
  photoPreviewWrapper: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 16
  },
  repickBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center"
  },
  repickText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 5
  },
  sampleCard: {
    width: 140,
    backgroundColor: "#FAF6F0",
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "transparent"
  },
  sampleCardActive: {
    borderColor: theme.accent
  },
  sampleImg: {
    width: "100%",
    height: 90
  },
  sampleInfo: {
    padding: 8
  },
  sampleName: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.ink
  },
  sampleCat: {
    fontSize: 10,
    color: theme.muted,
    marginTop: 2
  },
  qnaProgressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14
  },
  qnaStepDot: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#E8E0D5"
  },
  qnaStepDotActive: {
    backgroundColor: theme.accent
  },
  qnaStepDotCompleted: {
    backgroundColor: "#2E7D32"
  },
  qnaStepText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.muted
  },
  qnaStepTextActive: {
    color: "#FFFFFF"
  },
  qnaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  badgePill: {
    backgroundColor: "#FCEEE3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.accent,
    letterSpacing: 1
  },
  speakerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF6F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border
  },
  speakerBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.accent,
    marginLeft: 5
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 4
  },
  questionSpeech: {
    fontSize: 13,
    color: theme.muted,
    lineHeight: 18,
    marginBottom: 12
  },
  answerInput: {
    backgroundColor: "#FAF6F0",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: theme.ink,
    borderWidth: 1,
    borderColor: theme.border,
    textAlignVertical: "top",
    marginBottom: 12
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 12
  },
  voiceBtnRecording: {
    backgroundColor: "#D32F2F"
  },
  voiceBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 8
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6
  },
  costGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10
  },
  costField: {
    flex: 1
  },
  costLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink,
    marginBottom: 5
  },
  costInput: {
    backgroundColor: "#FAF6F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.ink,
    borderWidth: 1,
    borderColor: theme.border
  },
  subHelper: {
    fontSize: 11,
    color: theme.muted,
    marginTop: 5
  },
  processingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    marginVertical: 20
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink,
    textAlign: "center",
    marginBottom: 6
  },
  processingSub: {
    fontSize: 13,
    color: theme.muted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20
  },
  pipelineSteps: {
    width: "100%",
    backgroundColor: "#FAF6F0",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border
  },
  pipelineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  pipelineText: {
    fontSize: 13,
    color: theme.ink,
    fontWeight: "600"
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#EDE5D8",
    padding: 3,
    borderRadius: 14,
    marginBottom: 16
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 11
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.muted
  },
  tabTextActive: {
    color: theme.ink
  },
  dualImageRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  imgCompareBox: {
    flex: 1,
    alignItems: "center"
  },
  compareImg: {
    width: "100%",
    height: 120,
    borderRadius: 12
  },
  imgCaption: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.muted,
    marginTop: 5
  },
  enhanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12
  },
  enhanceBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  pricingCard: {
    backgroundColor: "#FAF6F0",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2D7C7",
    marginBottom: 16
  },
  pricingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  pricingBadge: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: theme.accent
  },
  pricingValue: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.ink
  },
  fairRatioBox: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "flex-end"
  },
  fairRatioLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32"
  },
  fairRatioValue: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1B5E20"
  },
  pricingBreakdown: {
    borderTopWidth: 1,
    borderTopColor: "#E2D7C7",
    paddingTop: 10
  },
  breakdownText: {
    fontSize: 11,
    color: theme.muted,
    lineHeight: 16
  },
  marketCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2D7C7",
    marginBottom: 16
  },
  marketQuery: {
    color: theme.muted,
    fontSize: 12,
    marginBottom: 12
  },
  marketStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE5D9",
    paddingBottom: 12,
    marginBottom: 10
  },
  marketStatLabel: {
    color: theme.muted,
    fontSize: 10,
    marginBottom: 4
  },
  marketStatValue: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  marketConfidence: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8
  },
  marketListing: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0E9DF",
    paddingVertical: 10,
    gap: 10
  },
  marketListingTitle: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: "700"
  },
  marketListingSource: {
    color: theme.muted,
    fontSize: 10,
    marginTop: 3
  },
  marketListingPrice: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "900"
  },
  marketEmptyText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.ink,
    marginTop: 10,
    marginBottom: 4
  },
  textInput: {
    backgroundColor: "#FAF6F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.ink,
    borderWidth: 1,
    borderColor: theme.border
  }
});
