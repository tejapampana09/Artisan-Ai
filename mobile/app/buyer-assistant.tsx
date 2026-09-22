import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { useRoleGuard } from "../src/authGuard";

interface ProductCardData {
  id: number;
  title: string;
  category?: string;
  price: number;
  image_url?: string;
  enhanced_image_url?: string;
}

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  products?: ProductCardData[];
}

const SUGGESTIONS_BY_LANG: Record<string, string[]> = {
  te: [
    "కలంకారి కళ గురించి చెప్పు",
    "జిఐ (GI) ట్యాగ్ అంటే ఏమిటి?",
    "₹2,000 లోపు చేతివృత్తుల బహుమతులు",
    "చెన్నపట్న బొమ్మల విశిష్టత ఏమిటి?",
    "స్వచ్ఛమైన చందేరి పట్టు ఎలా గుర్తించాలి?",
    "ఆర్డర్ స్టేటస్ & డెలివరీ"
  ],
  hi: [
    "कलमकारी कला के बारे में बताएं",
    "जीआई (GI) टैग क्या है?",
    "₹2,000 से कम के हस्तशिल्प उपहार",
    "चन्नापटना खिलौनों की क्या खासियत है?",
    "शुद्ध चंदेरी रेशम की पहचान कैसे करें?",
    "ऑर्डर स्टेटस और डिलीवरी"
  ],
  en: [
    "Tell me about Kalamkari art",
    "What are GI tagged products?",
    "Handmade gifts under ₹2,000",
    "How to identify pure Chanderi silk?",
    "Channapatna Wooden Toys history",
    "Order Status & Delivery"
  ]
};

export default function BuyerAssistant() {
  useRoleGuard("buyer");
  const { language } = useI18n();

  const getGreeting = () => {
    if (language === "te") {
      return "నమస్కారం! 🙏 నేను మీ ఆర్టిసన్ AI గైడ్. సంప్రదాయ భారతీయ హస్తకళలు, GI గుర్తింపు పొందిన కళారూపాలు, సహజసిద్ధమైన ఉత్పత్తుల గురించి నన్ను అడగండి.";
    }
    if (language === "hi") {
      return "नमस्ते! 🙏 मैं आपका कारीगर AI साथी हूँ। पारंपरिक भारतीय हस्तशिल्प, जीआई टैग कलाकृतियों और प्राकृतिक उत्पादों के बारे में मुझसे पूछें।";
    }
    if (language === "ta") {
      return "வணக்கம்! 🙏 நான் உங்கள் கைவினை AI வழிகாட்டி. பாரம்பரிய இந்திய கைவினைப்பொருட்கள் மற்றும் புவிசார் குறியீடு கலைகள் பற்றி என்னிடம் கேளுங்கள்.";
    }
    if (language === "bn") {
      return "নমস্কার! 🙏 আমি আপনার কারিগর AI সহায়ক। ভারতের ঐতিহ্যবাহী হস্তশিল্প এবং জিআই স্বীকৃত পণ্য সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।";
    }
    return "Namaste! 🙏 I am your Artisan AI Companion. I can help you discover authentic traditional Indian craft forms, explore GI tagged heritages, find the perfect handmade creations, or answer questions about natural materials and artisans.";
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      sender: "ai",
      text: getGreeting(),
      timestamp: "Just now"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => {
      showSub.remove();
      Speech.stop();
    };
  }, []);

  const handleToggleSpeech = async (msgId: string, text: string) => {
    if (!text || text.trim() === "") return;
    try {
      if (speakingMsgId === msgId) {
        Speech.stop();
        setSpeakingMsgId(null);
        return;
      }
      Speech.stop();
      setSpeakingMsgId(msgId);

      const langMap: Record<string, string> = {
        te: "te-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        bn: "bn-IN",
        en: "en-US"
      };
      const voiceLang = langMap[language] || "en-US";

      Speech.speak(text, {
        language: voiceLang,
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setSpeakingMsgId(null),
        onError: () => {
          if (voiceLang !== "en-US") {
            Speech.speak(text, {
              language: "en-US",
              pitch: 1.0,
              rate: 0.95,
              onDone: () => setSpeakingMsgId(null),
              onError: () => setSpeakingMsgId(null)
            });
          } else {
            setSpeakingMsgId(null);
          }
        }
      });
    } catch {
      setSpeakingMsgId(null);
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await api.buyerCopilot({ message: query, language });
      const answerText =
        res?.reply_text ||
        res?.response ||
        res?.message ||
        res?.reply ||
        (typeof res === "string"
          ? res
          : (language === "te"
              ? "మా మార్కెట్‌ప్లేస్‌లో మీకోసం కొన్ని అథెంటిక్ కళారూపాలు లభించాయి. కింద చూడవచ్చు."
              : "I found some heritage crafts for you in our marketplace. Explore the recommendations below."));

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "ai",
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        products: Array.isArray(res?.recommended_products) ? res.recommended_products : []
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "ai",
        text:
          "I had trouble connecting to the artisan intelligence network. " +
          (err?.detail || err?.message || "Please check your connection and try again."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top App Bar (Exact Stitch Design) */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/buyer");
            }}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={20} color={theme.accent} />
          </Pressable>
          <View style={styles.brandGroup}>
            <MaterialIcons name="storefront" size={24} color={theme.accent} />
            <Text style={styles.brandTitle}>Artisan-Ai</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            style={styles.cartIconBtn}
            onPress={() => router.push("/buyer-cart")}
            hitSlop={10}
          >
            <Ionicons name="bag-handle-outline" size={20} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date Divider */}
          <View style={styles.dateDivider}>
            <Text style={styles.dateDividerText}>Heritage Companion</Text>
          </View>

          {/* Messages Feed */}
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.messageRow,
                m.sender === "user" ? styles.userRow : styles.aiRow
              ]}
            >
              {m.sender === "ai" && (
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  m.sender === "user" ? styles.userBubble : styles.aiBubble
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    m.sender === "user" ? styles.userText : styles.aiText
                  ]}
                >
                  {m.text}
                </Text>

                {/* Embedded Product Cards (Stitch Design) */}
                {m.products && m.products.length > 0 && (
                  <View style={styles.productsContainer}>
                    <Text style={styles.productsHeader}>
                      {language === "te" ? "సిఫార్సు చేయబడిన కళారూపాలు:" : language === "hi" ? "सुझाए गए हस्तशिल्प:" : "Recommended Crafts:"}
                    </Text>
                    {m.products.slice(0, 3).map((prod) => {
                      const img = prod.enhanced_image_url || prod.image_url;
                      return (
                        <Pressable
                          key={prod.id}
                          style={styles.productCard}
                          onPress={() => router.push(`/product?id=${prod.id}`)}
                        >
                          <Image
                            source={{
                              uri:
                                img ||
                                "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400"
                            }}
                            style={styles.productThumb}
                            resizeMode="cover"
                          />
                          <View style={styles.productInfo}>
                            <Text style={styles.productTitle} numberOfLines={1}>
                              {prod.title}
                            </Text>
                            <Text style={styles.productCategory} numberOfLines={1}>
                              {prod.category || "Authentic Craft"}
                            </Text>
                            <Text style={styles.productPrice}>
                              ₹{Number(prod.price || 0).toLocaleString("en-IN")}
                            </Text>
                          </View>
                          <View style={styles.viewBtn}>
                            <Ionicons name="arrow-forward" size={16} color="#fff" />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.bubbleBottomRow}>
                  {m.sender === "ai" && (
                    <Pressable
                      style={styles.speakBtn}
                      onPress={() => handleToggleSpeech(m.id, m.text)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Read aloud"
                    >
                      <Ionicons
                        name={speakingMsgId === m.id ? "volume-high" : "volume-medium-outline"}
                        size={15}
                        color={speakingMsgId === m.id ? theme.colors.primary : theme.colors.inkMuted}
                      />
                      <Text
                        style={[
                          styles.speakBtnText,
                          speakingMsgId === m.id && { color: theme.colors.primary }
                        ]}
                      >
                        {speakingMsgId === m.id
                          ? (language === "te" ? "వివరిస్తోంది…" : "Speaking…")
                          : (language === "te" ? "వినండి" : "Listen")}
                      </Text>
                    </Pressable>
                  )}
                  <Text
                    style={[
                      styles.timestamp,
                      m.sender === "user" ? styles.userTimestamp : styles.aiTimestamp
                    ]}
                  >
                    {m.timestamp}
                  </Text>
                </View>
              </View>

              {m.sender === "user" && (
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={14} color="#fff" />
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={[styles.messageRow, styles.aiRow]}>
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={14} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={styles.thinkingText}>
                  {language === "te"
                    ? "సాంప్రదాయ కళాఖండాల వివరాలు పరిశీలిస్తోంది…"
                    : language === "hi"
                    ? "पारंपरिक कलाकृतियों की जानकारी खोजी जा रही है…"
                    : "Searching heritage archives & craft lineage…"}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestion Chips Above Input */}
        <View style={styles.chipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {(SUGGESTIONS_BY_LANG[language] || SUGGESTIONS_BY_LANG.en).map((item, idx) => (
              <Pressable
                key={idx}
                onPress={() => sendMessage(item)}
                style={styles.chip}
                disabled={loading}
              >
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Bottom Chat Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder={
                language === "te"
                  ? "కళలు, GI ట్యాగ్‌లు, బహుమతుల గురించి అడగండి..."
                  : language === "hi"
                  ? "हस्तशिल्प, जीआई टैग, साड़ियों के बारे में पूछें..."
                  : "Ask about crafts, GI tags, silk, pottery…"
              }
              placeholderTextColor="#A89F95"
              value={input}
              onChangeText={setInput}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              editable={!loading}
            />
          </View>
          <Pressable
            onPress={() => sendMessage()}
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnDisabled
            ]}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FCF9F8"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center"
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  cartIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#9F3C16",
    letterSpacing: -0.5
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 24
  },
  dateDivider: {
    alignSelf: "center",
    backgroundColor: "#F0EDED",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16
  },
  dateDividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#57423B"
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
    gap: 8
  },
  userRow: {
    justifyContent: "flex-end"
  },
  aiRow: {
    justifyContent: "flex-start"
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#9F3C16",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9F3C16",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#835500",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  aiBubble: {
    backgroundColor: "#F6F3F2",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.4)"
  },
  userBubble: {
    backgroundColor: "#BF542C",
    borderBottomRightRadius: 4
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21
  },
  aiText: {
    color: "#1B1C1C"
  },
  userText: {
    color: "#FFFFFF",
    fontWeight: "500"
  },
  bubbleBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(159, 60, 22, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4
  },
  speakBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A726A"
  },
  timestamp: {
    fontSize: 10,
    textAlign: "right"
  },
  aiTimestamp: {
    color: "#8A726A"
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.75)"
  },
  productsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(222, 192, 183, 0.6)"
  },
  productsHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#57423B",
    marginBottom: 8
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EAE7E7",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#F0EDED"
  },
  productInfo: {
    flex: 1,
    marginLeft: 10
  },
  productTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1C1C"
  },
  productCategory: {
    fontSize: 11,
    color: "#8A726A",
    marginTop: 1
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9F3C16",
    marginTop: 2
  },
  viewBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#9F3C16",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  thinkingText: {
    fontSize: 13,
    color: "#8A726A",
    fontStyle: "italic"
  },
  chipsContainer: {
    backgroundColor: "#FCF9F8",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED"
  },
  chipsScroll: {
    paddingHorizontal: 20,
    gap: 8
  },
  chip: {
    backgroundColor: "#F6F3F2",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#57423B"
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FCF9F8",
    borderTopWidth: 1,
    borderTopColor: "#EAE7E7",
    gap: 10
  },
  inputPill: {
    flex: 1,
    backgroundColor: "#F6F3F2",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderWidth: 1,
    borderColor: "#DEC0B7"
  },
  input: {
    fontSize: 14,
    color: "#1B1C1C"
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#9F3C16",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9F3C16",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3
  },
  sendBtnDisabled: {
    backgroundColor: "#DCD9D9",
    elevation: 0
  }
});
