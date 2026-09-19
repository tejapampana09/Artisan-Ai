import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "en" | "te" | "hi";
export const LANGUAGE_KEY = "artisan_settings_language";

type TranslationKey =
  | "settings" | "preferences" | "appLanguage" | "selectInterfaceLanguage"
  | "savedDeliveryAddress" | "usedForCheckout" | "edit" | "cancel" | "saveAddress"
  | "orderStatusAlerts" | "orderStatusDescription" | "heritageSpecials"
  | "heritageSpecialsDescription" | "aiAssistantAdvice" | "aiAssistantDescription"
  | "english" | "telugu" | "hindi" | "studio" | "creations" | "aiStudio"
  | "orders" | "business" | "explore" | "saved" | "bag" | "aiGuide";

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    settings: "Settings", preferences: "Preferences", appLanguage: "App Language",
    selectInterfaceLanguage: "Select your preferred interface language",
    savedDeliveryAddress: "Saved Delivery Address", usedForCheckout: "Used for quick one-tap ONDC checkout",
    edit: "Edit", cancel: "Cancel", saveAddress: "Save Address", orderStatusAlerts: "Order Status Alerts",
    orderStatusDescription: "Instant updates when artisans ship your craft", heritageSpecials: "Heritage Craft Specials",
    heritageSpecialsDescription: "Exclusive GI-tagged product drops", aiAssistantAdvice: "AI Assistant Advice",
    aiAssistantDescription: "Proactive pricing insights & craft care guides", english: "English", telugu: "Telugu", hindi: "Hindi",
    studio: "Studio", creations: "Creations", aiStudio: "AI Studio", orders: "Orders", business: "Business",
    explore: "Explore", saved: "Saved", bag: "Bag", aiGuide: "AI Guide"
  },
  te: {
    settings: "సెట్టింగ్స్", preferences: "ప్రాధాన్యతలు", appLanguage: "యాప్ భాష",
    selectInterfaceLanguage: "మీకు ఇష్టమైన ఇంటర్‌ఫేస్ భాషను ఎంచుకోండి",
    savedDeliveryAddress: "సేవ్ చేసిన డెలివరీ చిరునామా", usedForCheckout: "వేగవంతమైన ONDC చెక్అవుట్ కోసం",
    edit: "మార్చు", cancel: "రద్దు చేయి", saveAddress: "చిరునామా సేవ్ చేయి", orderStatusAlerts: "ఆర్డర్ స్థితి అలర్ట్లు",
    orderStatusDescription: "కళాకారుడు మీ వస్తువును పంపినప్పుడు తక్షణ సమాచారం", heritageSpecials: "వారసత్వ కళా ప్రత్యేకాలు",
    heritageSpecialsDescription: "ప్రత్యేక GI ట్యాగ్ ఉత్పత్తులు", aiAssistantAdvice: "AI అసిస్టెంట్ సూచనలు",
    aiAssistantDescription: "ధర సూచనలు మరియు కళ సంరక్షణ మార్గదర్శకాలు", english: "ఇంగ్లీష్", telugu: "తెలుగు", hindi: "హిందీ",
    studio: "స్టూడియో", creations: "నా సృష్టులు", aiStudio: "AI స్టూడియో", orders: "ఆర్డర్లు", business: "వ్యాపారం",
    explore: "వెతుకు", saved: "సేవ్ చేసినవి", bag: "బ్యాగ్", aiGuide: "AI గైడ్"
  },
  hi: {
    settings: "सेटिंग्स", preferences: "प्राथमिकताएं", appLanguage: "ऐप भाषा",
    selectInterfaceLanguage: "अपनी पसंदीदा इंटरफेस भाषा चुनें",
    savedDeliveryAddress: "सहेजा गया डिलीवरी पता", usedForCheckout: "त्वरित ONDC चेकआउट के लिए",
    edit: "संपादित करें", cancel: "रद्द करें", saveAddress: "पता सहेजें", orderStatusAlerts: "ऑर्डर स्थिति अलर्ट",
    orderStatusDescription: "कारीगर द्वारा सामान भेजने पर तुरंत जानकारी", heritageSpecials: "विरासत शिल्प विशेष",
    heritageSpecialsDescription: "विशेष GI-टैग वाले उत्पाद", aiAssistantAdvice: "AI सहायक सुझाव",
    aiAssistantDescription: "सक्रिय मूल्य सुझाव और शिल्प देखभाल गाइड", english: "अंग्रेज़ी", telugu: "तेलुगु", hindi: "हिंदी",
    studio: "स्टूडियो", creations: "मेरी रचनाएं", aiStudio: "AI स्टूडियो", orders: "ऑर्डर", business: "व्यवसाय",
    explore: "खोजें", saved: "सहेजे गए", bag: "बैग", aiGuide: "AI गाइड"
  }
};

type I18nValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((value) => {
      if (value === "en" || value === "te" || value === "hi") setLanguageState(value);
    }).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: async (next) => {
      setLanguageState(next);
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
    },
    t: (key) => translations[language][key]
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
