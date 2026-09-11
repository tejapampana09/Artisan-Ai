import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from backend.app.services.ai_provider import GeminiAIProvider

logger = logging.getLogger("artisan_ai")

INITIAL_QUESTIONS = {
    "te": "నమస్కారమండి! నేను అనన్యను (మీ కళా మిత్ర). మీ చేతులతో రూపొందించిన ఈ అద్భుతమైన హస్తకళను చూడటం నాకెంతో సంతోషంగా ఉందండి! ఈ కళాఖండం పేరు ఏమిటో, అలాగే దీని తయారీకి ఏ సహజమైన ముడి పదార్థాలు ఉపయోగించారో నాకి కాస్త చెబుతారా?",
    "hi": "नमस्ते जी! मैं अनन्या हूँ (आपकी कला मित्र)। आपके हाथों से बनी इस अद्भुत कलाकृति को देखकर मुझे बहुत खुशी हो रही है! इस खूबसूरत कला का नाम क्या है और इसे बनाने में कौन-सी प्राकृतिक सामग्री इस्तेमाल हुई है?",
    "ta": "வணக்கம்! நான் அனன்யா (உங்கள் கைவினைத் தோழி). உங்கள் இந்த அழகான கைவினைப் பொருளைப் பற்றி அறிய விரும்புவதில் எனக்கு மிக்க மகிழ்ச்சி. இதன் பெயர் என்ன, இதைச் செய்ய பயன்படுத்திய மூலப்பொருட்கள் யாவை?",
    "bn": "নমস্কার! আমি অনন্যা। আপনার এই সুন্দর ঐতিহ্যবাহী কারুশিল্পটি সম্পর্কে জানতে পেরে আমার খুব আনন্দ হচ্ছে। এই সামগ্রীটির নাম কী এবং এটি তৈরিতে কী উপাদান ব্যবহার করা হয়েছে?",
    "en": "Namaste! I'm Ananya, your craft friend. It is such a joy to see your exquisite handcrafted work! Could you please share what this artwork is called and what natural materials you crafted it with?"
}

FOLLOWUP_FALLBACKS = {
    "te": [
        "అవునా! నిజంగా చాలా అద్భుతంగా ఉందండి. ఈ హస్తకళను చేతితో తయారు చేయడానికి మీకు ఎంత సమయం పట్టింది మరియు ఏ సాంప్రదాయ పద్ధతి వాడారు?",
        "వాహ! ఎంత చక్కటి వివరమో. దీని కొలతలు (సైజు/ఎత్తు), రంగులు మరియు డిజైన్ ప్రత్యేకత ఏమిటో వివరించగలరా?",
        "చాలా గొప్ప విషయమండి! ఈ కళారూపం వెనుక ఉన్న సాంస్కృతిక విశేషాలు లేదా మీ కుటుంబ పరంపర కథనం ఏమిటి?",
        "ధన్యవాదాలండి! మీ నైపుణ్యానికి తగినట్లుగా మీరు ఈ కళాఖండానికి ఎంత విక్రయ ధర లభిస్తే బాగుంటుంది అని భావిస్తున్నారు?"
    ],
    "hi": [
        "अरे वाह! सच में बहुत ही सुंदर है। इस हस्तकला को अपने हाथों से तैयार करने में आपको कितना समय लगा और कौन सी पारंपरिक तकनीक इस्तेमाल की गई?",
        "बहुत बढ़िया! इसके आकार (साइज़/ऊँचाई), रंगों और इसकी खास कलात्मक विशेषता के बारे में बताएं।",
        "अद्भुत! इस कलाकृति के पीछे क्या सांस्कृतिक कहानी या आपकी पारिवारिक विरासत जुड़ी है?",
        "धन्यवाद जी! आपकी इस मेहनत और महारत के अनुसार आप इसका क्या उचित विक्रय मूल्य चाहते हैं?"
    ],
    "en": [
        "Wonderful! That sounds truly remarkable. How long did it take to handcraft this piece, and what traditional technique did you use?",
        "Beautiful details! Could you describe its dimensions, vibrant colors, and unique artistic features?",
        "Fascinating! What is the cultural story or generational heritage behind this craft?",
        "Thank you! Based on your hard work, what is your expected target price for this creation?"
    ]
}

def get_initial_question(language: str = "te") -> str:
    lang = (language or "te").lower()
    return INITIAL_QUESTIONS.get(lang, INITIAL_QUESTIONS["en"])

def normalize_fact_entry(value: Any, source: str = "ARTISAN_CONFIRMED", confidence: float = 0.95, turn_id: Optional[int] = None) -> Dict[str, Any]:
    """Ensures consistent fact structure with provenance tracking."""
    return {
        "value": str(value).strip() if value is not None else "",
        "source": source, # ARTISAN_CONFIRMED, AI_INFERENCE, UNKNOWN
        "confidence": float(confidence),
        "turn_id": turn_id
    }

class AdaptiveInterviewerService:
    """
    Manages adaptive conversation, fact validation, and max 5 question limit.
    """
    def __init__(self, provider: Optional[GeminiAIProvider] = None):
        self.provider = provider or GeminiAIProvider()

    async def process_artisan_answer(
        self,
        session_id: int,
        language: str,
        current_facts_raw: Optional[str],
        turn_history_raw: List[Dict[str, Any]],
        current_question_count: int,
        latest_answer: str,
        photo_url: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], str, Optional[str], bool]:
        """
        Processes answer turn:
        1. Parses current verified facts.
        2. Calls AIProvider to extract facts and choose next question.
        3. Validates facts and updates fact state (ARTISAN_CONFIRMED > AI_INFERENCE).
        4. Enforces question_count <= 5.
        """
        current_facts: Dict[str, Any] = {}
        if current_facts_raw:
            try:
                current_facts = json.loads(current_facts_raw)
            except Exception:
                current_facts = {}

        # 1. Call AIProvider
        ai_res = await self.provider.extract_facts_and_next_question(
            language=language,
            current_facts=current_facts,
            turn_history=turn_history_raw,
            latest_answer=latest_answer,
            photo_url=photo_url
        )

        extracted = ai_res.get("extracted_facts", [])
        action = ai_res.get("action", "ASK")
        next_q = ai_res.get("question")

        new_extracted_facts = []
        # 2. Fact validation and provenance update
        for item in extracted:
            field = item.get("field")
            val = item.get("value")
            conf = item.get("confidence", 0.90)

            if field and val:
                existing = current_facts.get(field)
                if existing and isinstance(existing, dict) and existing.get("source") == "ARTISAN_CONFIRMED":
                    continue

                fact_obj = normalize_fact_entry(
                    value=val,
                    source="ARTISAN_CONFIRMED",
                    confidence=conf,
                    turn_id=current_question_count
                )
                current_facts[field] = fact_obj
                new_extracted_facts.append({"field": field, **fact_obj})

        # Ensure fallback questions feel natural if AI didn't supply one
        lang_key = (language or "te").lower()
        fallbacks = FOLLOWUP_FALLBACKS.get(lang_key, FOLLOWUP_FALLBACKS["en"])
        if not next_q and current_question_count < len(fallbacks):
            next_q = fallbacks[current_question_count - 1 if current_question_count > 0 else 0]

        has_name = bool(current_facts.get("product_name", {}).get("value"))
        has_cat_or_mat = bool(current_facts.get("category", {}).get("value") or current_facts.get("material", {}).get("value"))
        
        new_count = current_question_count + 1

        # Enforce maximum 5 questions limit
        if new_count >= 5 or (has_name and has_cat_or_mat and action == "DONE"):
            action = "DONE"
            next_q = None
            is_complete = True
        elif action == "DONE":
            is_complete = True
        else:
            is_complete = False

        return current_facts, new_extracted_facts, action, next_q, is_complete
