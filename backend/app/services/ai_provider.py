import os
import json
import logging
import re
import httpx
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from backend.app.config import GEMINI_API_KEY, AI_REQUEST_TIMEOUT_SECONDS

logger = logging.getLogger("artisan_ai")

def get_models_to_try() -> list:
    """Returns fallback list of Gemini models starting with configured GEMINI_MODEL."""
    configured = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    defaults = [
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    return [configured] + [m for m in defaults if m != configured]

class AIProvider(ABC):
    """Abstract Base Class for Multilingual Artisan AI Assistant Services."""

    @abstractmethod
    async def extract_facts_and_next_question(
        self,
        language: str,
        current_facts: Dict[str, Any],
        turn_history: List[Dict[str, Any]],
        latest_answer: str,
        photo_url: Optional[str] = None
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def generate_product_listing(
        self,
        language: str,
        product_facts: Dict[str, Any],
        artisan_story: Optional[str] = None,
        market_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def translate_text(
        self,
        text: str,
        target_language: str
    ) -> str:
        pass


class GeminiAIProvider(AIProvider):
    """Production Gemini 2.5 Flash Provider Implementation."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY

    async def extract_facts_and_next_question(
        self,
        language: str,
        current_facts: Dict[str, Any],
        turn_history: List[Dict[str, Any]],
        latest_answer: str,
        photo_url: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            return self._smart_conversational_fallback(language, current_facts, turn_history, latest_answer)

        lang_names = {
            "te": "Telugu",
            "hi": "Hindi",
            "ta": "Tamil",
            "bn": "Bengali",
            "en": "English"
        }
        lang_label = lang_names.get(language, "English")

        prompt = f"""
        You are "Ananya" (కళా మిత్ర / Craft Friend), a warm, empathetic, and passionate craft counselor talking live with a traditional Indian artisan in {lang_label} ({language}).
        Your goal is to have a real, human, encouraging conversation to understand their craft masterpiece.

        Current Verified Product Facts: {json.dumps(current_facts)}
        Turn History: {json.dumps(turn_history[-6:])}
        Artisan's Latest Answer: "{latest_answer}"

        Task:
        1. Extract any new or updated product facts from the artisan's latest answer.
           Fields: product_name, category, material, craft, dimensions, weight, handmade, production_time, customizable, region, story.
        2. Decide if core facts are collected (max 5 questions allowed). If done, set action = "DONE".
        3. If action is "ASK", formulate a response in 2 parts (in {lang_label}):
           - Part A: 1 warm, human appreciation sentence acknowledging what they just shared (e.g. "అబ్బా! సహజ సిద్దమైన రంగులతో చేసారా? చాలా అద్భుతమండి!").
           - Part B: 1 natural follow-up question asking about missing details (e.g. "ఈ కళాఖండం తయారు చేయడానికి మీకు ఎంత సమయం పట్టిందో చెప్పగలరా?").

        CRITICAL CONVERSATIONAL RULES:
        - Talk like a real caring human friend, NOT a bot or formal questionnaire. Use polite honorifics ("అండి" in Telugu, "जी" in Hindi).
        - NEVER mention prices or money.
        - Output strictly valid JSON matching this schema:
        {{
            "action": "ASK" or "DONE",
            "question": "warm appreciation + follow-up question in {lang_label}",
            "target_fields": ["field_name"],
            "reason": "short explanation",
            "extracted_facts": [
                {{"field": "field_name", "value": "extracted value", "confidence": 0.95}}
            ]
        }}
        """

        models = get_models_to_try()
        async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
            for model in models:
                try:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}",
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"response_mime_type": "application/json"}
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        text_content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if text_content.startswith("```"):
                            lines = text_content.split("\n")
                            lines = [l for l in lines if not l.startswith("```")]
                            text_content = "\n".join(lines).strip()
                        return json.loads(text_content)
                except Exception as e:
                    logger.warning("[GeminiAIProvider] Fact extraction call failed on %s: %s", model, e)
                    continue

        return self._smart_conversational_fallback(language, current_facts, turn_history, latest_answer)

    def _smart_conversational_fallback(
        self,
        language: str,
        current_facts: Dict[str, Any],
        turn_history: List[Dict[str, Any]],
        latest_answer: str
    ) -> Dict[str, Any]:
        """
        Context-aware, natural, dynamic conversation engine for when Gemini API key is unconfigured or unreachable.
        Extracts facts and generates warm, natural human-like questions in artisan's native language.
        """
        ans = (latest_answer or "").strip()
        extracted = []

        def get_val(key):
            v = current_facts.get(key)
            if isinstance(v, dict):
                return v.get("value", "")
            return str(v or "")

        p_name = get_val("product_name")
        mat = get_val("material")
        cat = get_val("category")
        p_time = get_val("production_time")
        dims = get_val("dimensions")

        # 1. Fact Extraction from Answer
        if ans:
            if not p_name:
                extracted.append({"field": "product_name", "value": ans[:60], "confidence": 0.95})
                p_name = ans[:60]
            elif not mat and any(m in ans.lower() for m in ["పట్టు", "చెక్క", "సిల్క్", "wood", "silk", "brass", "కాటన్", "రంగులు", "కలంకారీ", "కంచు", "మట్టి"]):
                extracted.append({"field": "material", "value": ans, "confidence": 0.90})
                mat = ans
            elif not p_time and any(t in ans.lower() for t in ["గంటల", "రోజుల", "hours", "days", "నెలల", "సమయం"]):
                extracted.append({"field": "production_time", "value": ans, "confidence": 0.90})
                p_time = ans
            elif not dims and any(d in ans.lower() for d in ["ఇంచులు", "inches", "సెం.మీ", "cm", "సైజు", "అడుగుల"]):
                extracted.append({"field": "dimensions", "value": ans, "confidence": 0.90})
                dims = ans
            else:
                extracted.append({"field": "craft_story", "value": ans, "confidence": 0.85})

        turn_count = len(turn_history) // 2 + 1

        # 2. Formulate Next Natural Question based on language and current conversation state
        lang = (language or "te").lower()

        if lang == "te":
            if not mat:
                q = f"చాలా సంతోషమండి. '{p_name or 'మీ కళారూపం'}' తయారు చేయడానికి ఏ సహజమైన ముడి పదార్థాలు (పట్టు, టేకు చెక్క, ఇత్తడి, లేదా ప్రకృతి సిద్ధమైన రంగులు) వాడారు?"
            elif not p_time:
                q = f"చాలా చక్కటి వివరణ అండి! ఈ హస్తకళను నేయడానికి/చేయడానికి ఎంత సమయం పట్టింది మరియు ఏ సాంప్రదాయ పద్ధతి ఉపయోగించారు?"
            elif not dims:
                q = "అద్భుతమండి! ఈ కళాఖండం కొలతలు (సైజు/ఎత్తు) మరియు దీని రంగులు లేదా డిజైన్ ప్రత్యేకత ఏమిటో వివరించండి."
            elif turn_count < 4:
                q = "చాలా గొప్ప హస్తకళ అండి! ఈ కళారూపం వెనుక ఉన్న సాంస్కృతిక కథనం లేదా మీ కుటుంబ పరంపర વિશે చెప్పగలరా?"
            else:
                return {"action": "DONE", "question": None, "extracted_facts": extracted, "reason": "Gathered sufficient facts"}

        elif lang == "hi":
            if not mat:
                q = f"बहुत बढ़िया! '{p_name or 'इस कलाकृति'}' को बनाने में कौन सी प्राकृतिक सामग्री (रेशम, लकड़ी, पीतल या प्राकृतिक रंग) इस्तेमाल हुई है?"
            elif not p_time:
                q = "सुंदर जानकारी! इस हस्तकला को तैयार करने में कितना समय लगा और कौन सी पारंपरिक तकनीक इस्तेमाल की गई?"
            elif not dims:
                q = "अद्भुत! इस कलाकृति के आकार (साइज़) और इसके रंगों की खास विशेषता के बारे में बताएं।"
            elif turn_count < 4:
                q = "बहुत खूब! इस कलाकृति के पीछे की सांस्कृतिक कहानी या आपकी पारिवारिक विरासत के बारे में कुछ बताएं।"
            else:
                return {"action": "DONE", "question": None, "extracted_facts": extracted, "reason": "Gathered sufficient facts"}

        else:
            if not mat:
                q = f"Wonderful! What natural materials (such as pure silk, teak wood, brass, or organic dyes) were used to create '{p_name or 'this craft'}'?"
            elif not p_time:
                q = "Fascinating! How many hours or days did it take to handcraft this, and what traditional technique was used?"
            elif not dims:
                q = "Beautiful! Could you share its dimensions (size/height) and describe its unique artistic features?"
            elif turn_count < 4:
                q = "Inspiring! What is the cultural story or generational heritage behind this artwork?"
            else:
                return {"action": "DONE", "question": None, "extracted_facts": extracted, "reason": "Gathered sufficient facts"}

        return {
            "action": "ASK",
            "question": q,
            "target_fields": ["material" if not mat else "production_time"],
            "reason": "Dynamic smart conversational engine step",
            "extracted_facts": extracted
        }

    async def generate_product_listing(
        self,
        language: str,
        product_facts: Dict[str, Any],
        artisan_story: Optional[str] = None,
        market_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            return self._fallback_listing(product_facts)

        prompt = f"""
        You are Artisan AI's master craft cataloger.
        Generate a professional product listing based strictly on these verified artisan product facts:
        Facts: {json.dumps(product_facts)}
        Artisan Personal Story: "{artisan_story or ''}"
        Market Context: {json.dumps(market_context or {})}
        Target Language: {language}

        CRITICAL SAFETY RULE:
        - NEVER fabricate heritage, historical claims, GI certification, or false materials not mentioned by the artisan.
        - Base the listing strictly on confirmed facts.

        Return a valid JSON object with:
        - title: Market-ready title in language '{language}' (max 10 words)
        - description: Professional 2-3 sentence overview in language '{language}'
        - materials: Comma-separated list of confirmed materials
        - craft_story: Cultural or artisanal story in language '{language}' highlighting traditional craftsmanship
        - title_en: English translation of title
        - description_en: English translation of description
        - craft_story_en: English translation of craft_story
        - category: Craft category string
        - tags: Array of 4-6 relevant search tags
        """

        models = get_models_to_try()
        async with httpx.AsyncClient(timeout=AI_REQUEST_TIMEOUT_SECONDS) as client:
            for model in models:
                try:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}",
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"response_mime_type": "application/json"}
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        text_content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if text_content.startswith("```"):
                            lines = text_content.split("\n")
                            lines = [l for l in lines if not l.startswith("```")]
                            text_content = "\n".join(lines).strip()
                        parsed = json.loads(text_content)
                        parsed["translations"] = json.dumps({
                            language: {
                                "title": parsed.get("title", ""),
                                "description": parsed.get("description", ""),
                                "craft_story": parsed.get("craft_story", "")
                            },
                            "en": {
                                "title": parsed.get("title_en", parsed.get("title", "")),
                                "description": parsed.get("description_en", parsed.get("description", "")),
                                "craft_story": parsed.get("craft_story_en", parsed.get("craft_story", ""))
                            }
                        })
                        return parsed
                except Exception as e:
                    logger.warning("[GeminiAIProvider] Listing generation call failed on %s: %s", model, e)
                    continue

        return self._fallback_listing(product_facts)

    async def translate_text(self, text: str, target_language: str) -> str:
        if not text or not text.strip():
            return ""
        if not self.api_key:
            return text

        prompt = f"Translate the following craft text into language '{target_language}'. Preserve technical terms: \"{text}\""
        models = get_models_to_try()
        async with httpx.AsyncClient(timeout=5.0) as client:
            for model in models:
                try:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}",
                        json={"contents": [{"parts": [{"text": prompt}]}]},
                        headers={"Content-Type": "application/json"}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                except Exception:
                    continue
        return text

    def _fallback_listing(self, product_facts: Dict[str, Any]) -> Dict[str, Any]:
        p_name = product_facts.get("product_name", {}).get("value") if isinstance(product_facts.get("product_name"), dict) else product_facts.get("product_name")
        p_name = str(p_name or "Handcrafted Creation")
        mat = product_facts.get("material", {}).get("value") if isinstance(product_facts.get("material"), dict) else product_facts.get("material")
        cat = product_facts.get("category", {}).get("value") if isinstance(product_facts.get("category"), dict) else product_facts.get("category")
        
        return {
            "title": p_name,
            "description": f"Authentic handcrafted {cat or 'item'} made with {mat or 'natural craft materials'}.",
            "materials": str(mat or ""),
            "craft_story": "",
            "title_en": p_name,
            "description_en": f"Authentic handcrafted {cat or 'item'} made with {mat or 'natural craft materials'}.",
            "craft_story_en": "",
            "category": str(cat or "Handcrafted"),
            "tags": [str(cat or "Handmade")],
            "translations": json.dumps({"en": {"title": p_name, "description": f"Authentic handcrafted {cat or 'item'}.", "craft_story": ""}})
        }
