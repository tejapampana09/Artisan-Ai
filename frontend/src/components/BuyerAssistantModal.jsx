import React, { useState, useEffect, useRef } from 'react';
import { X, Bot, Send, Mic, MicOff, Sparkles, ShoppingBag, MapPin, Globe, ArrowRight, ShieldCheck } from 'lucide-react';
import { sendBuyerCopilotMessage } from '../api/index.js';
import { useNotification } from '../context/NotificationContext.jsx';

const LANGUAGES = [
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
];

const SUGGESTIONS = {
  te: [
    '🎁 అథెంటిక్ కానుకలు (Authentic Gifts)',
    '💰 ₹2000 లోపు ప్రొడక్ట్స్ (Under ₹2000)',
    '🎨 కలంకారి సిల్క్ దుపట్టాలు (Kalamkari)',
    '🪵 చెన్నపట్న చెక్క బొమ్మలు (Wooden Toys)'
  ],
  hi: [
    '🎁 प्रामाणिक हस्तशिल्प उपहार',
    '💰 ₹2000 के अंदर कलाकृतियां',
    '🎨 मखमली कलमकारी साड़ी',
    '🪵 चन्नापटना लकड़ी के खिलौने'
  ],
  en: [
    '🎁 Best GI Heritage Gifts',
    '💰 Handicrafts under ₹2000',
    '🎨 Kalamkari Silk Collection',
    '🪵 Channapatna Wooden Toys'
  ]
};

export default function BuyerAssistantModal({ isOpen, onClose, onSelectProduct }) {
  const [language, setLanguage] = useState('te');
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'అభివందనాలు! నేను మీ చేతివృత్తుల AI గైడ్ (AI Craft Guide). మీకు ఏ విధమైన సాంప్రదాయ ఉత్పత్తులు లేదా బడ్జెట్ ప్రకారం కానుకలు కావాలో నన్ను అడగండి లేదా మాట్లాడండి!',
      products: []
    }
  ]);

  const { addNotification } = useNotification();
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend = null) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    const userMsg = {
      id: Date.now() + '-user',
      sender: 'user',
      text: query,
      products: []
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const res = await sendBuyerCopilotMessage({
        message: query,
        language: language
      });

      const botMsg = {
        id: Date.now() + '-bot',
        sender: 'bot',
        text: res.reply_text,
        products: res.recommended_products || []
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Buyer copilot error:', err);
      addNotification('Copilot failed to respond. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Native WebRTC Speech Recognition
  const toggleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addNotification('Speech recognition is not supported in your browser. Please type your prompt.', 'warning');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsRecording(false);
        handleSend(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech error:', event);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const quickPrompts = SUGGESTIONS[language] || SUGGESTIONS.en;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center sm:items-end sm:justify-end p-3 sm:p-6">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-200 flex flex-col overflow-hidden max-h-[85vh] h-[650px] animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-400 shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-wide">AI Craft Guide Copilot</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                  Live Search
                </span>
              </div>
              <p className="text-[11px] text-indigo-200">Native Multilingual Craft Shopping Assistant</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <div className="flex items-center bg-white/10 px-2 py-1 rounded-xl border border-white/20 text-xs">
              <Globe className="w-3.5 h-3.5 text-indigo-200 mr-1" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-white font-semibold text-[11px] focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="text-slate-900 bg-white">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={onClose} className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="bg-indigo-50/70 p-2.5 border-b border-indigo-100 flex items-center space-x-2 overflow-x-auto shrink-0 text-xs scrollbar-none">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 rounded-full border border-indigo-200 font-semibold text-[11px] whitespace-nowrap shadow-2xs transition-all cursor-pointer shrink-0"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 space-y-2 shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white border border-indigo-100 text-slate-800 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* Inline Product Recommendation Cards inside Chat Stream */}
                {msg.products && msg.products.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block flex items-center">
                      <Sparkles className="w-3 h-3 text-amber-500 mr-1" />
                      Live Search Craft Results ({msg.products.length})
                    </span>

                    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                      {msg.products.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => {
                            onSelectProduct(prod);
                          }}
                          className="p-2.5 bg-indigo-50/60 hover:bg-indigo-100/80 rounded-xl border border-indigo-200/80 flex items-center justify-between gap-2.5 cursor-pointer transition-all hover:scale-[1.01] group"
                        >
                          <img
                            src={prod.enhanced_image_url || prod.image_url}
                            alt={prod.title}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-slate-900 truncate text-xs group-hover:text-indigo-700">
                              {prod.title}
                            </h5>
                            <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.2 rounded border border-indigo-200">
                                {prod.category}
                              </span>
                              <span className="flex items-center text-slate-500">
                                <MapPin className="w-2.5 h-2.5 text-amber-600 mr-0.5" />
                                {prod.region_of_origin || 'India'}
                              </span>
                            </div>
                            <span className="font-extrabold text-slate-900 text-xs block mt-1">
                              ₹{prod.price?.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] shadow-2xs flex items-center space-x-1 shrink-0 cursor-pointer"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-none p-3 shadow-2xs text-xs text-indigo-700 font-semibold flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Searching live marketplace database...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
          {isRecording && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Listening in Native Speech... Speak now!</span>
              </div>
              <button onClick={() => setIsRecording(false)} className="text-xs text-rose-800 underline font-bold cursor-pointer">
                Stop
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for crafts, budget, or heritage items..."
              className="flex-1 text-xs border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />

            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-100 text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
              title="Speak in native language"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !inputMessage.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
