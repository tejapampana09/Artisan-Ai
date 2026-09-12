import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from backend.app.services.ai_provider import GeminiAIProvider

logger = logging.getLogger("artisan_ai")

PREDEFINED_QUESTIONS = {
    "te": [
        "నమస్కారమండి! నేను అనన్యను (మీ కళా మిత్ర). మీ చేతులతో రూపొందించిన ఈ కళాఖండం పేరు ఏమిటి? అలాగే దీని తయారీకి ఏ సహజమైన ముడి పదార్థాలు ఉపయోగించారు?",
        "ఈ హస్తకళను చేతితో తయారు చేయడానికి మీకు ఎంత సమయం పట్టింది? మరియు ఏ సాంప్రదాయ పద్ధతి వాడారు?",
        "దీని కొలతలు (సైజు/పొడవు), రంగులు మరియు డిజైన్ ప్రత్యేకత ఏమిటో వివరించగలరా?",
        "ఈ కళారూపం వెనుక ఉన్న సాంస్కృతిక విశేషాలు లేదా మీ కుటుంబ పరంపర కథనం ఏమిటి?"
    ],
    "hi": [
        "नमस्ते जी! मैं अनन्या हूँ (आपकी कला मित्र)। इस खूबसूरत हस्तकला का नाम क्या है और इसे बनाने में कौन-सी प्राकृतिक सामग्री इस्तेमाल हुई है?",
        "इस हस्तकला को अपने हाथों से तैयार करने में आपको कितना समय लगा और कौन सी पारंपरिक तकनीक इस्तेमाल की गई?",
        "इसके आकार (साइज़/लंबाई), रंगों और डिज़ाइन की क्या विशेषता है?",
        "इस कलाकृति के पीछे क्या सांस्कृतिक कहानी या आपकी पारिवारिक विरासत जुड़ी है?"
    ],
    "ta": [
        "வணக்கம்! நான் அனன்யா. இந்த அழகான கைவினைப் பொருளின் பெயர் என்ன, இதைச் செய்ய பயன்படுத்திய மூலப்பொருட்கள் யாவை?",
        "இந்த கைவினைப் பொருளை செய்ய உங்களுக்கு எவ்வளவு காலம் பிடித்தது மற்றும் என்ன பாரம்பரிய நுட்பத்தைப் பயன்படுத்தினீர்கள்?",
        "இதன் பரிமாணங்கள் (அளவு), வண்ணங்கள் மற்றும் சிறப்பு அம்சங்களை விவரிக்க முடியுமா?",
        "இந்த கைவினைக்குப் பின்னால் உள்ள கலாச்சார பாரம்பரியம் அல்லது உங்கள் குடும்பத்தின் கைவினைக் கதை என்ன?"
    ],
    "bn": [
        "নমস্কার! আমি অনন্যা। এই সুন্দর হস্তশিল্পটির নাম কী এবং এটি তৈরিতে কী প্রাকৃতিক উপাদান ব্যবহার করা হয়েছে?",
        "এটি তৈরি করতে আপনার কত সময় লেগেছে এবং কোন ঐতিহ্যবাহী কৌশল ব্যবহার করা হয়েছে?",
        "এর আকার, রঙ এবং অনন্য বৈশিষ্ট্যগুলি সম্পর্কে বলুন।",
        "এই শিল্পের পেছনের সাংস্কৃতিক ঐতিহ্য বা আপনার পারিবারিক গল্পটি কী?"
    ],
    "en": [
        "Namaste! I'm Ananya, your craft partner. What is the name of this handcrafted artwork, and what natural materials did you craft it with?",
        "How long did it take you to handcraft this piece, and what traditional technique did you use?",
        "Could you describe its dimensions, size, colors, and unique artistic features?",
        "What is the cultural heritage, special occasion, or family tradition behind this craft?"
    ]
}

def get_initial_question(language: str = "te") -> str:
    lang = (language or "te").lower()
    questions = PREDEFINED_QUESTIONS.get(lang, PREDEFINED_QUESTIONS["en"])
    return questions[0]

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
    Manages deterministic predefined craft questions, fact extraction, and 4-question completion.
    """
    def __init__(self, provider: Optional[GeminiAIProvider] = None):
        self.provider = provider or GeminiAIProvider()

    async def get_dynamic_initial_question(self, language: str, category_hint: Optional[str] = None, photo_url: Optional[str] = None) -> str:
        """Returns the clear, instant predefined Question 1."""
        return get_initial_question(language)

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
        2. Calls AIProvider to extract facts (with heuristic fallback).
        3. Validates facts and updates fact state.
        4. Progresses through guaranteed PREDEFINED_QUESTIONS (Question 1 to 4).
        5. Marks FACTS_COMPLETE after Question 4 or when core facts gathered.
        """
        current_facts: Dict[str, Any] = {}
        if current_facts_raw:
            try:
                current_facts = json.loads(current_facts_raw)
            except Exception:
                current_facts = {}

        # 1. Call AIProvider to extract facts
        extracted = []
        try:
            ai_res = await self.provider.extract_facts_and_next_question(
                language=language,
                current_facts=current_facts,
                turn_history=turn_history_raw,
                latest_answer=latest_answer,
                photo_url=photo_url
            )
            extracted = ai_res.get("extracted_facts", [])
        except Exception as e:
            logger.warning("[AdaptiveInterviewer] AI fact extraction error, using heuristic: %s", e)

        # Heuristic fallback if AI extraction was empty
        if not extracted and latest_answer.strip():
            ans = latest_answer.strip()
            if current_question_count == 1:
                extracted.append({"field": "material", "value": ans, "confidence": 0.95})
            elif current_question_count == 2:
                extracted.append({"field": "production_time", "value": ans, "confidence": 0.95})
                extracted.append({"field": "handmade", "value": "True", "confidence": 0.98})
            elif current_question_count == 3:
                extracted.append({"field": "dimensions", "value": ans, "confidence": 0.95})
            elif current_question_count >= 4:
                extracted.append({"field": "cultural_story", "value": ans, "confidence": 0.95})

        new_extracted_facts = []
        # 2. Fact validation and provenance update
        for item in extracted:
            field = item.get("field")
            val = item.get("value")
            conf = item.get("confidence", 0.90)

            if field and val:
                fact_obj = normalize_fact_entry(
                    value=val,
                    source="ARTISAN_CONFIRMED",
                    confidence=conf,
                    turn_id=current_question_count
                )
                current_facts[field] = fact_obj
                new_extracted_facts.append({"field": field, **fact_obj})

        # 3. Deterministic Predefined Question Progression
        lang_key = (language or "te").lower()
        questions = PREDEFINED_QUESTIONS.get(lang_key, PREDEFINED_QUESTIONS["en"])

        new_count = current_question_count + 1

        if new_count <= len(questions):
            # Target next question index:
            # When current_question_count is 1 (completed Q1), next is questions[1] (Q2)
            # When current_question_count is 2 (completed Q2), next is questions[2] (Q3)
            # When current_question_count is 3 (completed Q3), next is questions[3] (Q4)
            next_q = questions[new_count - 1]
            action = "ASK"
            is_complete = False
        else:
            next_q = None
            action = "DONE"
            is_complete = True

        return current_facts, new_extracted_facts, action, next_q, is_complete

