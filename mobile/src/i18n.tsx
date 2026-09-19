import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "en" | "te" | "hi" | "ta" | "bn";
export const LANGUAGE_KEY = "artisan_settings_language";

export type TranslationKey =
  // Common & Settings
  | "settings" | "preferences" | "appLanguage" | "selectInterfaceLanguage"
  | "savedDeliveryAddress" | "usedForCheckout" | "edit" | "cancel" | "saveAddress"
  | "orderStatusAlerts" | "orderStatusDescription" | "heritageSpecials"
  | "heritageSpecialsDescription" | "aiAssistantAdvice" | "aiAssistantDescription"
  | "english" | "telugu" | "hindi" | "tamil" | "bengali"
  // Navigation Tabs
  | "studio" | "creations" | "aiStudio" | "orders" | "business"
  | "explore" | "saved" | "bag" | "aiGuide"
  // Header & Brand
  | "artisanAi" | "ruralCommerce" | "artisanStudio" | "verifiedMasterArtisan"
  | "buyerView" | "sellerView" | "buyCrafts" | "sellAsArtisan"
  // Metrics & Dashboard
  | "totalRevenue" | "itemsFulfilled" | "pendingOrders" | "requiresDispatch"
  | "allDispatched" | "buyerEnquiries" | "directLeads" | "catalogViews"
  | "consumerInterest" | "catalogueReadiness" | "quickActions"
  | "createWithAi" | "photoVoiceStory" | "addCraft" | "manualForm"
  | "marketIntelligence" | "marketAndMl"
  // AI Hero Card
  | "voiceFirstAi" | "heroAiTitle" | "heroAiDesc" | "launchAiStudio"
  // Pipeline
  | "orderDispatchPipeline" | "totalOrdersSubtitle" | "viewAllOrders"
  | "noOrdersYet" | "noOrdersDesc" | "addNewCraft" | "orderNumber" | "buyer"
  | "marketDemandOpportunities"
  // Buyer Marketplace
  | "searchCraftsPlaceholder" | "allCrafts" | "sort" | "popular"
  | "lowToHigh" | "highToLow" | "under2000" | "trendingAcrossIndia"
  | "highArtisanDemand" | "directArtisanDelivery" | "inStock" | "preOrder"
  | "addToCart" | "addedToBag" | "noCraftsFound" | "clearFilters"
  // AI Studio
  | "yourCraftLanguage" | "uploadPhotos" | "craftQuestions" | "fairPricing"
  | "reviewAndPublish" | "speakAnswer" | "listeningTapFinish"
  | "generatingListing" | "submitListing" | "viewCatalog"
  // Product Detail & Specifications
  | "craftedBy" | "viewArtisanProfile" | "askArtisan" | "craftStoryTitle"
  | "listenAudio" | "stopAudio" | "authenticitySpecs" | "craftCategory"
  | "materialsUsed" | "originCluster" | "fairTradePolicy" | "fairTradeProtected"
  | "verifiedBuyerReviews" | "buyNow" | "translating" | "translatedBadge"
  | "translateButton" | "craftNotFound" | "returnToMarketplace" | "loadingCraftDetails"
  | "inquirySent" | "viewInquiries" | "writeQuestion" | "sendInquiry" | "close";

export const CATEGORY_TRANSLATIONS: Record<string, Record<AppLanguage, string>> = {
  "All Crafts": {
    en: "All Crafts",
    te: "అన్ని కళారూపాలు",
    hi: "सभी हस्तशिल्प",
    ta: "அனைத்து கைவினைப்பொருட்கள்",
    bn: "সমস্ত কারুশিল্প"
  },
  "Kalamkari": {
    en: "Kalamkari",
    te: "కలంకారి",
    hi: "कलमकारी",
    ta: "கலம்காரி",
    bn: "কলমকারী"
  },
  "Wooden Toys": {
    en: "Wooden Toys",
    te: "చెక్క బొమ్మలు",
    hi: "लकड़ी के खिलौने",
    ta: "மர பொம்மைகள்",
    bn: "কাঠের খেলনা"
  },
  "Blue Pottery": {
    en: "Blue Pottery",
    te: "బ్లూ పాట్టరీ",
    hi: "ब्लू पॉटरी",
    ta: "ப்ளூ பாட்டரி",
    bn: "ব্লু পটারি"
  },
  "Bidriware": {
    en: "Bidriware",
    te: "బిద్రివేర్",
    hi: "बीदरीवेयर",
    ta: "பித்ரிவேர்",
    bn: "বিদ্রিওয়্যার"
  },
  "Pochampally Ikat": {
    en: "Pochampally Ikat",
    te: "పోచంపల్లి ఇకత్",
    hi: "पोचमपल्ली इकत",
    ta: "போச்சம்பள்ளி இகத்",
    bn: "পোচমপল্লী ইকত"
  },
  "Terracotta": {
    en: "Terracotta",
    te: "టెర్రకోట",
    hi: "टेराकोटा",
    ta: "டெரகோட்டா",
    bn: "টেরাকোটা"
  },
  "Handloom": {
    en: "Handloom",
    te: "చేనేత",
    hi: "हथकरघा",
    ta: "கைத்தறி",
    bn: "তাঁত"
  },
  "Handicraft": {
    en: "Handicraft",
    te: "హస్తకళ",
    hi: "हस्तशिल्प",
    ta: "கைவினைப்பொருள்",
    bn: "হস্তশিল্প"
  },
  "Natural materials": {
    en: "Natural materials",
    te: "సహజ సిద్ధమైన పదార్థాలు",
    hi: "प्राकृतिक सामग्री",
    ta: "இயற்கை மூலப்பொருட்கள்",
    bn: "প্রাকৃতিক উপাদান"
  },
  "India": {
    en: "India",
    te: "భారతదేశం",
    hi: "भारत",
    ta: "இந்தியா",
    bn: "ভারত"
  },
  "Fair-Trade Protected": {
    en: "Fair-Trade Protected",
    te: "ఫెయిర్-ట్రేడ్ రక్షితం",
    hi: "फेयर-ट्रेड संरक्षित",
    ta: "நியாய வர்த்தக பாதுகாப்பு",
    bn: "ন্যায্য-বাণিজ্য সুরক্ষিত"
  },
  "Pottery": {
    en: "Pottery",
    te: "కుండలు & మట్టిపాత్రలు",
    hi: "मिट्टी के बर्तन",
    ta: "மட்பாண்டங்கள்",
    bn: "মৃৎশিল্প"
  },
  "Jewelry": {
    en: "Jewelry",
    te: "ఆభరణాలు",
    hi: "आभूषण",
    ta: "நகைகள்",
    bn: "গহনা"
  },
  "Paintings": {
    en: "Paintings",
    te: "చిత్రలేఖనాలు",
    hi: "चित्रकला",
    ta: "ஓவியங்கள்",
    bn: "চিত্রকর্ম"
  },
  "Textiles": {
    en: "Textiles",
    te: "వస్త్రాలు",
    hi: "वस्त्र",
    ta: "ஜவுளி",
    bn: "বস্ত্র"
  }
};

export function getCategoryTranslation(categoryName: string, lang: AppLanguage): string {
  if (!categoryName) return categoryName;
  const match = CATEGORY_TRANSLATIONS[categoryName];
  if (match && match[lang]) return match[lang];
  const lower = categoryName.toLowerCase();
  for (const [key, map] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (key.toLowerCase() === lower && map[lang]) {
      return map[lang];
    }
  }
  return categoryName;
}

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    settings: "Settings", preferences: "Preferences", appLanguage: "App Language",
    selectInterfaceLanguage: "Select your preferred interface language",
    savedDeliveryAddress: "Saved Delivery Address", usedForCheckout: "Used for quick one-tap checkout",
    edit: "Edit", cancel: "Cancel", saveAddress: "Save Address", orderStatusAlerts: "Order Status Alerts",
    orderStatusDescription: "Instant updates when artisans ship your craft", heritageSpecials: "Heritage Craft Specials",
    heritageSpecialsDescription: "Exclusive handcrafted product drops", aiAssistantAdvice: "AI Assistant Advice",
    aiAssistantDescription: "Proactive pricing insights & craft care guides",
    english: "English", telugu: "Telugu", hindi: "Hindi", tamil: "Tamil", bengali: "Bengali",
    studio: "Studio", creations: "Creations", aiStudio: "AI Studio", orders: "Orders", business: "Business",
    explore: "Explore", saved: "Saved", bag: "Bag", aiGuide: "AI Guide",
    artisanAi: "ARTISAN AI", ruralCommerce: "Rural Craft Commerce & Intelligence",
    artisanStudio: "Artisan Studio", verifiedMasterArtisan: "VERIFIED MASTER ARTISAN",
    buyerView: "🛍️ Buyer View", sellerView: "🎨 Artisan View",
    buyCrafts: "Buy Crafts", sellAsArtisan: "Sell as Artisan 🎨",
    totalRevenue: "Total Revenue", itemsFulfilled: "items fulfilled",
    pendingOrders: "Pending Orders", requiresDispatch: "Requires Dispatch", allDispatched: "All orders dispatched",
    buyerEnquiries: "Buyer Enquiries", directLeads: "Direct artisan leads",
    catalogViews: "Catalog Views", consumerInterest: "Consumer interest",
    catalogueReadiness: "Catalogue Readiness", quickActions: "Quick Actions",
    createWithAi: "Create with AI", photoVoiceStory: "Photo & Voice Story",
    addCraft: "Add Craft", manualForm: "Manual Form",
    marketIntelligence: "Intelligence", marketAndMl: "Market & ML",
    voiceFirstAi: "VOICE-FIRST MULTIMODAL AI",
    heroAiTitle: "Turn your craft photos & stories into live catalog listings",
    heroAiDesc: "Upload a picture, speak in your native language, enhance studio backdrops, and get instant fair-price evaluations.",
    launchAiStudio: "Launch AI Catalog Studio ›",
    orderDispatchPipeline: "Order Dispatch Pipeline", totalOrdersSubtitle: "total customer orders",
    viewAllOrders: "View All Orders", noOrdersYet: "No Orders Yet",
    noOrdersDesc: "When buyers purchase your pieces through Artisan AI or ONDC, they will appear here.",
    addNewCraft: "Add a New Craft", orderNumber: "Order #", buyer: "Buyer",
    marketDemandOpportunities: "Market Demand Opportunities",
    searchCraftsPlaceholder: "Search sarees, lacquer toys, pottery, brass…",
    allCrafts: "All Crafts", sort: "Sort:", popular: "Popular",
    lowToHigh: "₹ Low to High", highToLow: "₹ High to Low", under2000: "Under ₹2,000",
    trendingAcrossIndia: "Trending Across India", highArtisanDemand: "High Artisan Demand",
    directArtisanDelivery: "🚚 Direct Artisan Delivery", inStock: "in stock", preOrder: "Pre-Order",
    addToCart: "Add to Cart", addedToBag: "Added to Bag",
    noCraftsFound: "No handcrafted creations found", clearFilters: "Clear Filters",
    yourCraftLanguage: "YOUR CRAFT LANGUAGE / మీ భాష",
    uploadPhotos: "1. Upload Photos", craftQuestions: "2. Craft Story & Q&A",
    fairPricing: "3. Fair Pricing & Cost", reviewAndPublish: "4. Review & Publish",
    speakAnswer: "Speak Answer", listeningTapFinish: "Listening... Tap to Finish",
    generatingListing: "AI is analyzing your craft & preparing fair pricing...",
    submitListing: "Publish Craft to Marketplace", viewCatalog: "View Creations",
    craftedBy: "Crafted by", viewArtisanProfile: "View Artisan Profile ›", askArtisan: "Ask Artisan",
    craftStoryTitle: "Craft Story & Artisan Heritage", listenAudio: "Listen", stopAudio: "Stop Voice",
    authenticitySpecs: "AUTHENTICITY SPECIFICATIONS", craftCategory: "Craft Category",
    materialsUsed: "Materials Used", originCluster: "Origin Cluster", fairTradePolicy: "Fair Trade Policy",
    fairTradeProtected: "Fair-Trade Protected", verifiedBuyerReviews: "VERIFIED BUYER REVIEWS",
    buyNow: "Buy Now", translating: "Translating with AI...", translatedBadge: "AI Translated",
    translateButton: "Translate", craftNotFound: "Craft not found", returnToMarketplace: "‹ Return to Marketplace",
    loadingCraftDetails: "Loading authentic craft details…", inquirySent: "Inquiry Sent",
    viewInquiries: "View Inquiries", writeQuestion: "Write your question...", sendInquiry: "Send Inquiry", close: "Close"
  },
  te: {
    settings: "సెట్టింగ్స్", preferences: "ప్రాధాన్యతలు", appLanguage: "యాప్ భాష",
    selectInterfaceLanguage: "మీకు ఇష్టమైన ఇంటర్‌ఫేస్ భాషను ఎంచుకోండి",
    savedDeliveryAddress: "సేవ్ చేసిన డెలివరీ చిరునామా", usedForCheckout: "వేగవంతమైన చెక్అవుట్ కోసం",
    edit: "మార్చు", cancel: "రద్దు చేయి", saveAddress: "చిరునామా సేవ్ చేయి", orderStatusAlerts: "ఆర్డర్ స్థితి అలర్ట్లు",
    orderStatusDescription: "కళాకారుడు మీ వస్తువును పంపినప్పుడు తక్షణ సమాచారం", heritageSpecials: "వారసత్వ కళా ప్రత్యేకాలు",
    heritageSpecialsDescription: "ప్రత్యేక హస్తకళా ఉత్పత్తులు", aiAssistantAdvice: "AI అసిస్టెంట్ సూచనలు",
    aiAssistantDescription: "ధర సూచనలు మరియు కళ సంరక్షణ మార్గదర్శకాలు",
    english: "English (ఇంగ్లీష్)", telugu: "తెలుగు (Telugu)", hindi: "हिंदी (హిందీ)", tamil: "தமிழ் (తమిళం)", bengali: "বাংলা (బెంగాలీ)",
    studio: "స్టూడియో", creations: "నా సృష్టులు", aiStudio: "AI స్టూడియో", orders: "ఆర్డర్లు", business: "వ్యాపారం",
    explore: "వెతుకు", saved: "సేవ్ చేసినవి", bag: "బ్యాగ్", aiGuide: "AI గైడ్",
    artisanAi: "ఆర్టిసాన్ AI", ruralCommerce: "గ్రామీణ కళా వాణిజ్యం & ఇంటెలిజెన్స్",
    artisanStudio: "కళాకారుల స్టూడియో", verifiedMasterArtisan: "ధృవీకరించబడిన కళాకారుడు",
    buyerView: "🛍️ కొనుగోలుదారు వీక్షణ", sellerView: "🎨 కళాకారుల వీక్షణ",
    buyCrafts: "చేతివృత్తులు కొనండి", sellAsArtisan: "కళాకారుడిగా అమ్మండి 🎨",
    totalRevenue: "మొత్తం ఆదాయం", itemsFulfilled: "అమ్మిన వస్తువులు",
    pendingOrders: "పెండింగ్ ఆర్డర్లు", requiresDispatch: "పంపించాల్సి ఉంది", allDispatched: "అన్ని ఆర్డర్లు పంపించబడ్డాయి",
    buyerEnquiries: "విచారణలు", directLeads: "కస్టమర్ సందేశాలు",
    catalogViews: "క్యాటలాగ్ వీక్షణలు", consumerInterest: "కొనుగోలుదారుల ఆసక్తి",
    catalogueReadiness: "క్యాటలాగ్ సంసిద్ధత", quickActions: "త్వరిత చర్యలు",
    createWithAi: "AI తో సృష్టించండి", photoVoiceStory: "ఫోటో & వాయిస్ కథ",
    addCraft: "క్రాఫ్ట్ జోడించండి", manualForm: "ఫారం నింపండి",
    marketIntelligence: "ఇంటెలిజెన్స్", marketAndMl: "మార్కెట్ & విశ్లేషణ",
    voiceFirstAi: "వాయిస్ ఆధారిత మల్టీమోడల్ AI",
    heroAiTitle: "మీ ఫోటోలు & కథలను మార్కెట్ లిస్టింగ్‌గా మార్చండి",
    heroAiDesc: "ఫోటో తీయండి, మీ మాతృభాషలో మాట్లాడండి, అందమైన స్టూడియో బ్యాక్‌డ్రాప్‌లు మరియు న్యాయమైన ధర పొందండి.",
    launchAiStudio: "AI క్యాటలాగ్ స్టూడియో ప్రారంభించండి ›",
    orderDispatchPipeline: "ఆర్డర్ డెలివరీ పైప్‌లైన్", totalOrdersSubtitle: "మొత్తం కస్టమర్ ఆర్డర్లు",
    viewAllOrders: "అన్ని ఆర్డర్లు చూడండి", noOrdersYet: "ఇంకా ఆర్డర్లు రాలేదు",
    noOrdersDesc: "కొనుగోలుదారులు మీ కళాకృతులను ఆర్డర్ చేసినప్పుడు, అవి ఇక్కడ కనిపిస్తాయి.",
    addNewCraft: "కొత్త కళాఖండం జోడించండి", orderNumber: "ఆర్డర్ #", buyer: "కొనుగోలుదారు",
    marketDemandOpportunities: "మార్కెట్ డిమాండ్ అవకాశాలు",
    searchCraftsPlaceholder: "చీరలు, చెక్క బొమ్మలు, కుండలు, ఇత్తడి వెతకండి…",
    allCrafts: "అన్ని కళారూపాలు", sort: "క్రమం:", popular: "పాపులర్",
    lowToHigh: "₹ తక్కువ నుండి ఎక్కువ", highToLow: "₹ ఎక్కువ నుండి తక్కువ", under2000: "₹2,000 లోపు",
    trendingAcrossIndia: "భారతదేశంలో ట్రెండింగ్", highArtisanDemand: "అత్యధిక డిమాండ్",
    directArtisanDelivery: "🚚 నేరుగా కళాకారుడి నుండి డెలివరీ", inStock: "అందుబాటులో ఉంది", preOrder: "ముందస్తు ఆర్డర్",
    addToCart: "బ్యాగ్‌కి జోడించు", addedToBag: "బ్యాగ్‌లో చేర్చబడింది",
    noCraftsFound: "చేతివృత్తుల కళాకృతులు ఏవీ కనుగొనబడలేదు", clearFilters: "ఫిల్టర్లు తొలగించండి",
    yourCraftLanguage: "YOUR CRAFT LANGUAGE / మీ భాష",
    uploadPhotos: "1. ఫోటోలు అప్‌లోడ్ చేయండి", craftQuestions: "2. క్రాఫ్ట్ కథ & ప్రశ్నలు",
    fairPricing: "3. న్యాయమైన ధర & ఖర్చులు", reviewAndPublish: "4. పరిశీలించి ప్రచురించండి",
    speakAnswer: "సమాధానం చెప్పండి", listeningTapFinish: "వింటోంది... ఆపడానికి నొక్కండి",
    generatingListing: "AI మీ క్రాఫ్ట్‌ను విశ్లేషించి ధరను లెక్కిస్తోంది...",
    submitListing: "మార్కెట్‌ప్లేస్‌లో ప్రచురించండి", viewCatalog: "సృష్టులు చూడండి",
    craftedBy: "రూపొందించిన వారు", viewArtisanProfile: "ఆర్టిసాన్ ప్రొఫైల్ చూడండి ›", askArtisan: "ఆర్టిసాన్‌ను అడగండి",
    craftStoryTitle: "కళా వారసత్వం & కథ", listenAudio: "వినండి", stopAudio: "వాయిస్ ఆపండి",
    authenticitySpecs: "ప్రామాణిక వివరాలు", craftCategory: "క్రాఫ్ట్ వర్గం",
    materialsUsed: "వాడిన పదార్థాలు", originCluster: "మూల ప్రాంతం", fairTradePolicy: "ఫెయిర్ ట్రేడ్ విధానం",
    fairTradeProtected: "ఫెయిర్-ట్రేడ్ రక్షితం", verifiedBuyerReviews: "ధృవీకరించబడిన కస్టమర్ సమీక్షలు",
    buyNow: "ఇప్పుడే కొనండి", translating: "AI తెలుగులోకి అనువదిస్తోంది...", translatedBadge: "తెలుగులోకి అనువదించబడింది",
    translateButton: "తెలుగులోకి అనువదించు", craftNotFound: "కళారూపం కనుగొనబడలేదు", returnToMarketplace: "‹ మార్కెట్‌ప్లేస్‌కు తిరిగి వెళ్ళండి",
    loadingCraftDetails: "ప్రామాణిక వివరాలు లోడ్ అవుతున్నాయి…", inquirySent: "విచారణ పంపబడింది",
    viewInquiries: "విచారణలు చూడండి", writeQuestion: "మీ ప్రశ్నను ఇక్కడ రాయండి...", sendInquiry: "సందేశం పంపండి", close: "మూసివేయి"
  },
  hi: {
    settings: "सेटिंग्स", preferences: "प्राथमिकताएं", appLanguage: "ऐप भाषा",
    selectInterfaceLanguage: "अपनी पसंदीदा इंटरफेस भाषा चुनें",
    savedDeliveryAddress: "सहेजा गया डिलीवरी पता", usedForCheckout: "त्वरित चेकआउट के लिए",
    edit: "संपादित करें", cancel: "रद्द करें", saveAddress: "पता सहेजें", orderStatusAlerts: "ऑर्डर स्थिति अलर्ट",
    orderStatusDescription: "कारीगर द्वारा सामान भेजने पर तुरंत जानकारी", heritageSpecials: "विरासत शिल्प विशेष",
    heritageSpecialsDescription: "विशेष हस्तशिल्प उत्पाद", aiAssistantAdvice: "AI सहायक सुझाव",
    aiAssistantDescription: "सक्रिय मूल्य सुझाव और शिल्प देखभाल गाइड",
    english: "English (अंग्रेज़ी)", telugu: "తెలుగు (तेलुगु)", hindi: "हिंदी (Hindi)", tamil: "தமிழ் (तमिल)", bengali: "বাংলা (बंगाली)",
    studio: "स्टूडियो", creations: "मेरी रचनाएं", aiStudio: "AI स्टूडियो", orders: "ऑर्डर", business: "व्यवसाय",
    explore: "खोजें", saved: "सहेजे गए", bag: "बैग", aiGuide: "AI गाइड",
    artisanAi: "आर्टिसन AI", ruralCommerce: "ग्रामीण शिल्प वाणिज्य और बुद्धिमत्ता",
    artisanStudio: "कारीगर स्टूडियो", verifiedMasterArtisan: "सत्यापित मास्टर कारीगर",
    buyerView: "🛍️ खरीदार दृश्य", sellerView: "🎨 कारीगर दृश्य",
    buyCrafts: "शिल्प खरीदें", sellAsArtisan: "कारीगर के रूप में बेचें 🎨",
    totalRevenue: "कुल राजस्व", itemsFulfilled: "बिके हुए उत्पाद",
    pendingOrders: "लंबित ऑर्डर", requiresDispatch: "भेजना बाकी है", allDispatched: "सभी ऑर्डर भेज दिए गए",
    buyerEnquiries: "ग्राहक पूछताछ", directLeads: "सीधे खरीदार संदेश",
    catalogViews: "कैटलॉग दृश्य", consumerInterest: "उपभोक्ता रुचि",
    catalogueReadiness: "कैटलॉग तत्परता", quickActions: "त्वरित क्रियाएं",
    createWithAi: "AI से बनाएं", photoVoiceStory: "फोटो और आवाज की कहानी",
    addCraft: "शिल्प जोड़ें", manualForm: "मैन्युअल फॉर्म",
    marketIntelligence: "इंटेलिजेंस", marketAndMl: "बाजार और विश्लेषण",
    voiceFirstAi: "आवाज आधारित मल्टीमॉडल AI",
    heroAiTitle: "अपनी शिल्प तस्वीरों और कहानियों को लाइव कैटलॉग में बदलें",
    heroAiDesc: "फोटो लें, अपनी मातृभाषा में बोलें, स्टूडियो बैकग्राउंड बढ़ाएं और तुरंत उचित मूल्य मूल्यांकन पाएं।",
    launchAiStudio: "AI कैटलॉग स्टूडियो शुरू करें ›",
    orderDispatchPipeline: "ऑर्डर प्रेषण पाइपलाइन", totalOrdersSubtitle: "कुल ग्राहक ऑर्डर",
    viewAllOrders: "सभी ऑर्डर देखें", noOrdersYet: "अभी तक कोई ऑर्डर नहीं",
    noOrdersDesc: "जब खरीदार आपके उत्पाद ऑर्डर करेंगे, तो वे यहां दिखाई देंगे।",
    addNewCraft: "नया शिल्प जोड़ें", orderNumber: "ऑर्डर #", buyer: "खरीदार",
    marketDemandOpportunities: "बाजार मांग के अवसर",
    searchCraftsPlaceholder: "साड़ी, लकड़ी के खिलौने, मिट्टी के बर्तन खोजें…",
    allCrafts: "सभी हस्तशिल्प", sort: "क्रम:", popular: "लोकप्रिय",
    lowToHigh: "₹ कम से ज्यादा", highToLow: "₹ ज्यादा से कम", under2000: "₹2,000 से कम",
    trendingAcrossIndia: "पूरे भारत में ट्रेंडिंग", highArtisanDemand: "अधिक मांग",
    directArtisanDelivery: "🚚 सीधे कारीगर से डिलीवरी", inStock: "उपलब्ध है", preOrder: "प्री-ऑर्डर",
    addToCart: "बैग में जोड़ें", addedToBag: "बैग में जोड़ा गया",
    noCraftsFound: "कोई हस्तशिल्प नहीं मिला", clearFilters: "फ़िल्टर हटाएं",
    yourCraftLanguage: "YOUR CRAFT LANGUAGE / अपनी भाषा",
    uploadPhotos: "1. फोटो अपलोड करें", craftQuestions: "2. शिल्प कहानी और प्रश्न",
    fairPricing: "3. उचित मूल्य और लागत", reviewAndPublish: "4. समीक्षा और प्रकाशित करें",
    speakAnswer: "उत्तर बोलें", listeningTapFinish: "सुन रहा है... समाप्त करने के लिए टैप करें",
    generatingListing: "AI आपके शिल्प का विश्लेषण कर रहा है...",
    submitListing: "मार्केटप्लेस पर प्रकाशित करें", viewCatalog: "रचनाएं देखें",
    craftedBy: "कारीगर", viewArtisanProfile: "कारीगर प्रोफ़ाइल देखें ›", askArtisan: "कारीगर से पूछें",
    craftStoryTitle: "शिल्प कथा एवं विरासत", listenAudio: "सुनें", stopAudio: "आवाज़ रोकें",
    authenticitySpecs: "प्रमाणिकता विवरण", craftCategory: "शिल्प श्रेणी",
    materialsUsed: "प्रयुक्त सामग्री", originCluster: "मूल क्षेत्र", fairTradePolicy: "उचित व्यापार नीति",
    fairTradeProtected: "फेयर-ट्रेड संरक्षित", verifiedBuyerReviews: "सत्यापित खरीदार समीक्षाएं",
    buyNow: "अभी खरीदें", translating: "AI हिंदी में अनुवाद कर रहा है...", translatedBadge: "हिंदी में अनुवादित",
    translateButton: "हिंदी में अनुवाद करें", craftNotFound: "हस्तशिल्प नहीं मिला", returnToMarketplace: "‹ बाज़ार में वापस जाएं",
    loadingCraftDetails: "प्रामाणिक शिल्प विवरण लोड हो रहे हैं…", inquirySent: "पूछताछ भेजी गई",
    viewInquiries: "पूछताछ देखें", writeQuestion: "अपना प्रश्न लिखें...", sendInquiry: "पूछताछ भेजें", close: "बंद करें"
  },
  ta: {
    settings: "அமைப்புகள்", preferences: "விருப்பங்கள்", appLanguage: "பயன்பாட்டு மொழி",
    selectInterfaceLanguage: "உங்கள் விருப்பமான மொழியைத் தேர்ந்தெடுக்கவும்",
    savedDeliveryAddress: "சேமிக்கப்பட்ட முகவரி", usedForCheckout: "விரைவான செக்அவுட்டிற்கு",
    edit: "திருத்து", cancel: "ரத்து செய்", saveAddress: "சேமி", orderStatusAlerts: "ஆர்டர் நிலை அறிவிப்புகள்",
    orderStatusDescription: "கைவினைஞர்கள் அனுப்பும்போது உடனடி அறிவிப்பு", heritageSpecials: "பாரம்பரிய கைவினைப் பொருட்கள்",
    heritageSpecialsDescription: "சிறப்பு கைவினைப் பொருட்கள்", aiAssistantAdvice: "AI வழிகாட்டுதல்",
    aiAssistantDescription: "விலை பரிந்துரைகள் மற்றும் கைவினைப் பராமரிப்பு",
    english: "English (ஆங்கிலம்)", telugu: "తెలుగు (தெலுங்கு)", hindi: "हिंदी (இந்தி)", tamil: "தமிழ் (Tamil)", bengali: "বাংলা (வங்காளி)",
    studio: "ஸ்டுடியோ", creations: "படைப்புகள்", aiStudio: "AI ஸ்டுடியோ", orders: "ஆர்டர்கள்", business: "வணிகம்",
    explore: "ஆராயுங்கள்", saved: "சேமிக்கப்பட்டவை", bag: "பை", aiGuide: "AI வழிகாட்டி",
    artisanAi: "கைவினைஞர் AI", ruralCommerce: "கிராமப்புற கைவினை வணிகம்",
    artisanStudio: "கைவினைஞர் அரங்கம்", verifiedMasterArtisan: "சான்றளிக்கப்பட்ட முதன்மை கைவினைஞர்",
    buyerView: "🛍️ வாங்குபவர் பார்வை", sellerView: "🎨 கைவினைஞர் பார்வை",
    buyCrafts: "கைவினைப்பொருட்கள் வாங்க", sellAsArtisan: "கைவினைஞராக விற்க 🎨",
    totalRevenue: "மொத்த வருவாய்", itemsFulfilled: "விற்பனையான பொருட்கள்",
    pendingOrders: "நிலுவையில் உள்ள ஆர்டர்கள்", requiresDispatch: "அனுப்ப வேண்டும்", allDispatched: "அனைத்தும் அனுப்பப்பட்டன",
    buyerEnquiries: "வாங்குபவர் விசாரணைகள்", directLeads: "நேரடி தொடர்புகள்",
    catalogViews: "பார்வைகள்", consumerInterest: "வாடிக்கையாளர் ஆர்வம்",
    catalogueReadiness: "தயாரான நிலை", quickActions: "விரைவுச் செயல்கள்",
    createWithAi: "AI மூலம் உருவாக்கு", photoVoiceStory: "படம் & குரல் கதை",
    addCraft: "பொருள் சேர்", manualForm: "படிவம் நிரப்பு",
    marketIntelligence: "நுண்ணறிவு", marketAndMl: "சந்தை பகுப்பாய்வு",
    voiceFirstAi: "குரல் அடிப்படையிலான AI",
    heroAiTitle: "உங்கள் படங்களையும் கதைகளையும் தயாரிப்புப் பட்டியலாக மாற்றுங்கள்",
    heroAiDesc: "படம் பதிவேற்றுங்கள், உங்கள் தாய்மொழியில் பேசுங்கள், சிறந்த விலை மதிப்பீடு பெறுங்கள்.",
    launchAiStudio: "AI ஸ்டுடியோவைத் தொடங்கு ›",
    orderDispatchPipeline: "ஆர்டர் அனுப்பும் வழிமுறை", totalOrdersSubtitle: "மொத்த ஆர்டர்கள்",
    viewAllOrders: "அனைத்து ஆர்டர்களையும் பார்", noOrdersYet: "ஆர்டர்கள் எதுவும் இல்லை",
    noOrdersDesc: "வாடிக்கையாளர்கள் உங்கள் பொருட்களை வாங்கும்போது இங்கு தோன்றும்.",
    addNewCraft: "புதிய கைவினைப்பொருளைச் சேர்", orderNumber: "ஆர்டர் #", buyer: "வாங்குபவர்",
    marketDemandOpportunities: "சந்தை வாய்ப்புகள்",
    searchCraftsPlaceholder: "புடவைகள், மர பொம்மைகள், மண்பாண்டங்கள் தேடுங்கள்…",
    allCrafts: "அனைத்து கைவினைப்பொருட்கள்", sort: "வரிசை:", popular: "பிரபலமானவை",
    lowToHigh: "₹ குறைவு முதல் அதிகம்", highToLow: "₹ அதிகம் முதல் குறைவு", under2000: "₹2,000 கீழ்",
    trendingAcrossIndia: "இந்தியாவில் பிரபலமானது", highArtisanDemand: "அதிக தேவை",
    directArtisanDelivery: "🚚 நேரடி டெலிவரி", inStock: "கையிருப்பில் உள்ளது", preOrder: "முன்பதிவு",
    addToCart: "பையில் சேர்", addedToBag: "சேர்க்கப்பட்டது",
    noCraftsFound: "பொருட்கள் எதுவும் கிடைக்கவில்லை", clearFilters: "வடிப்பான்களை நீக்கு",
    yourCraftLanguage: "YOUR CRAFT LANGUAGE / உங்கள் மொழி",
    uploadPhotos: "1. படம் பதிவேற்று", craftQuestions: "2. கைவினைக் கதை & வினாக்கள்",
    fairPricing: "3. நியாயமான விலை & செலவு", reviewAndPublish: "4. சரிபார்த்து வெளியிடு",
    speakAnswer: "பதிலை பேசவும்", listeningTapFinish: "கேட்கிறது... முடிக்க தட்டவும்",
    generatingListing: "AI பகுப்பாய்வு செய்கிறது...",
    submitListing: "சந்தையில் வெளியிடு", viewCatalog: "படைப்புகளைப் பார்",
    craftedBy: "செய்தவர்", viewArtisanProfile: "கைவினைஞர் சுயவிவரம் ›", askArtisan: "கைவினைஞரிடம் கேட்கவும்",
    craftStoryTitle: "கைவினை கதை & பாரம்பரியம்", listenAudio: "கேட்கவும்", stopAudio: "குரலை நிறுத்து",
    authenticitySpecs: "உண்மைத்தன்மை விவரக்குறிப்புகள்", craftCategory: "கைவினை வகை",
    materialsUsed: "பயன்படுத்தப்பட்ட பொருட்கள்", originCluster: "தோற்ற பகுதி", fairTradePolicy: "நியாய வர்த்தக கொள்கை",
    fairTradeProtected: "நியாய வர்த்தக பாதுகாப்பு", verifiedBuyerReviews: "சரிபார்க்கப்பட்ட வாங்குபவர் மதிப்புரைகள்",
    buyNow: "இப்போது வாங்கவும்", translating: "AI தமிழில் மொழிபெயர்க்கிறது...", translatedBadge: "தமிழில் மொழிபெயர்க்கப்பட்டது",
    translateButton: "தமிழில் மொழிபெயர்க்கவும்", craftNotFound: "பொருள் கிடைக்கவில்லை", returnToMarketplace: "‹ சந்தைக்குத் திரும்பு",
    loadingCraftDetails: "கைவினை விவரங்கள் ஏற்றப்படுகின்றன…", inquirySent: "விசாரணை அனுப்பப்பட்டது",
    viewInquiries: "விசாரணைகளைப் பார்", writeQuestion: "உங்கள் கேள்வியை எழுதுங்கள்...", sendInquiry: "விசாரணை அனுப்பு", close: "மூடு"
  },
  bn: {
    settings: "সেটিংস", preferences: "পছন্দসমূহ", appLanguage: "অ্যাপের ভাষা",
    selectInterfaceLanguage: "আপনার পছন্দের ভাষা নির্বাচন করুন",
    savedDeliveryAddress: "সংরক্ষিত ডেলিভারি ঠিকানা", usedForCheckout: "দ্রুত চেকআউটের জন্য",
    edit: "সম্পাদনা", cancel: "বাতিল", saveAddress: "ঠিকানা সংরক্ষণ", orderStatusAlerts: "অর্ডার স্ট্যাটাস সতর্কতা",
    orderStatusDescription: "কারিগর পণ্য পাঠালে তাত্ক্ষণিক আপডেট", heritageSpecials: "ঐতিহ্যবাহী হস্তশিল্প",
    heritageSpecialsDescription: "বিশেষ হস্তশিল্প পণ্য", aiAssistantAdvice: "AI সহকারী পরামর্শ",
    aiAssistantDescription: "সক্রিয় মূল্য বিশ্লেষণ এবং যত্ন গাইড",
    english: "English (ইংরেজি)", telugu: "తెలుగు (তেলেগু)", hindi: "हिंदी (হিন্দি)", tamil: "தமிழ் (তামিল)", bengali: "বাংলা (Bengali)",
    studio: "স্টুডিও", creations: "সৃষ্টিসমূহ", aiStudio: "AI স্টুডিও", orders: "অর্ডার", business: "ব্যবসা",
    explore: "অনুসন্ধান", saved: "সংরক্ষিত", bag: "ব্যাগ", aiGuide: "AI গাইড",
    artisanAi: "আর্টিসান AI", ruralCommerce: "গ্রামীণ হস্তশিল্প বাণিজ্য",
    artisanStudio: "কারিগর স্টুডিও", verifiedMasterArtisan: "যাচাইকৃত কারিগর",
    buyerView: "🛍️ ক্রেতার দৃশ্য", sellerView: "🎨 কারিগরের দৃশ্য",
    buyCrafts: "শিল্পকর্ম কিনুন", sellAsArtisan: "কারিগর হিসেবে বিক্রি করুন 🎨",
    totalRevenue: "মোট আয়", itemsFulfilled: "বিক্রিত পণ্য",
    pendingOrders: "মুলতুবি অর্ডার", requiresDispatch: "পাঠানো প্রয়োজন", allDispatched: "সব পাঠানো হয়েছে",
    buyerEnquiries: "ক্রেতার অনুসন্ধান", directLeads: "সরাসরি ক্রেতার বার্তা",
    catalogViews: "ক্যাটালগ ভিউ", consumerInterest: "গ্রাহক আগ্রহ",
    catalogueReadiness: "ক্যাটালগ প্রস্তুতি", quickActions: "দ্রুত ক্রিয়া",
    createWithAi: "AI দিয়ে তৈরি করুন", photoVoiceStory: "ছবি এবং ভয়েস গল্প",
    addCraft: "শিল্পকর্ম যোগ করুন", manualForm: "ম্যানুয়াল ফর্ম",
    marketIntelligence: "ইন্টেলিজেন্স", marketAndMl: "বাজার ও বিশ্লেষণ",
    voiceFirstAi: "ভয়েস-ফার্স্ট মাল্টিমোডাল AI",
    heroAiTitle: "আপনার ছবি এবং গল্পকে পণ্যের তালিকায় রূপান্তর করুন",
    heroAiDesc: "ছবি তুলুন, নিজের ভাষায় কথা বলুন, স্টুডিও ব্যাকগ্রাউন্ড এবং ন্যায্য মূল্য পান।",
    launchAiStudio: "AI ক্যাটালগ স্টুডিও শুরু করুন ›",
    orderDispatchPipeline: "অর্ডার ডেলিভারি পাইপলাইন", totalOrdersSubtitle: "মোট ক্রেতা অর্ডার",
    viewAllOrders: "সব অর্ডার দেখুন", noOrdersYet: "এখনও কোনও অর্ডার নেই",
    noOrdersDesc: "ক্রেতারা পণ্য অর্ডার করলে তা এখানে প্রদর্শিত হবে।",
    addNewCraft: "নতুন শিল্পকর্ম যোগ করুন", orderNumber: "অর্ডার #", buyer: "ক্রেতা",
    marketDemandOpportunities: "বাজারের চাহিদার সুযোগ",
    searchCraftsPlaceholder: "শাড়ি, কাঠের খেলনা, মৃৎশিল্প খুঁজুন…",
    allCrafts: "সমস্ত কারুশিল্প", sort: "বাছাই:", popular: "জনপ্রিয়",
    lowToHigh: "₹ কম থেকে বেশি", highToLow: "₹ বেশি থেকে কম", under2000: "₹২,০০০ এর নিচে",
    trendingAcrossIndia: "ভারত জুড়ে ট্রেন্ডিং", highArtisanDemand: "উচ্চ চাহিদা",
    directArtisanDelivery: "🚚 সরাসরি কারিগরের ডেলিভারি", inStock: "মজুদ আছে", preOrder: "প্রি-অর্ডার",
    addToCart: "ব্যাগে যোগ করুন", addedToBag: "ব্যাগে যোগ করা হয়েছে",
    noCraftsFound: "কোনও শিল্পকর্ম পাওয়া যায়নি", clearFilters: "ফিল্টার মুছুন",
    yourCraftLanguage: "YOUR CRAFT LANGUAGE / আপনার ভাষা",
    uploadPhotos: "1. ছবি আপলোড করুন", craftQuestions: "2. শিল্পের গল্প ও প্রশ্ন",
    fairPricing: "3. ন্যায্য মূল্য ও খরচ", reviewAndPublish: "4. পর্যালোচনা ও প্রকাশ",
    speakAnswer: "উত্তর বলুন", listeningTapFinish: "শুনছে... শেষ করতে ট্যাপ করুন",
    generatingListing: "AI আপনার শিল্পকর্ম বিশ্লেষণ করছে...",
    submitListing: "মার্কেটপ্লেসে প্রকাশ করুন", viewCatalog: "সৃষ্টিগুলি দেখুন",
    craftedBy: "কারিগর", viewArtisanProfile: "কারিগর প্রোফাইল দেখুন ›", askArtisan: "কারিগরকে জিজ্ঞাসা করুন",
    craftStoryTitle: "কারুশিল্পের গল্প ও ঐতিহ্য", listenAudio: "শুনুন", stopAudio: "ভয়েস থামান",
    authenticitySpecs: "প্রামাণিকতা বিশদ", craftCategory: "কারুশিল্প বিভাগ",
    materialsUsed: "ব্যবহৃত উপকরণ", originCluster: "মূল অঞ্চল", fairTradePolicy: "ন্যায্য বাণিজ্য নীতি",
    fairTradeProtected: "ন্যায্য-বাণিজ্য সুরক্ষিত", verifiedBuyerReviews: "যাচাইকৃত ক্রেতা পর্যালোচনা",
    buyNow: "এখনই কিনুন", translating: "AI বাংলায় অনুবাদ করছে...", translatedBadge: "বাংলায় অনুবাদ করা হয়েছে",
    translateButton: "বাংলায় অনুবাদ করুন", craftNotFound: "কারুশিল্প পাওয়া যায়নি", returnToMarketplace: "‹ মার্কেটপ্লেসে ফিরে যান",
    loadingCraftDetails: "প্রামাণিক কারুশিল্পের বিবরণ লোড হচ্ছে…", inquirySent: "অনুসন্ধান পাঠানো হয়েছে",
    viewInquiries: "অনুসন্ধানগুলি দেখুন", writeQuestion: "আপনার প্রশ্ন লিখুন...", sendInquiry: "অনুসন্ধান পাঠান", close: "বন্ধ করুন"
  }
};

type I18nValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
  getCategory: (categoryName: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((value) => {
      if (value === "en" || value === "te" || value === "hi" || value === "ta" || value === "bn") {
        setLanguageState(value as AppLanguage);
      }
    }).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: async (next) => {
      setLanguageState(next);
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
    },
    t: (key) => translations[language]?.[key] || translations.en[key] || (key as string),
    getCategory: (cat) => getCategoryTranslation(cat, language)
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

