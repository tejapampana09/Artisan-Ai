import os
import asyncio
import json
import logging
import re
from typing import Dict, Any, Optional
import websockets
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.app.config import GEMINI_API_KEY
from backend.app.models import InterviewSession, InterviewTurn
from backend.app.services.gemini_interviewer import AdaptiveInterviewerService, get_initial_question

logger = logging.getLogger("artisan_ai")

MAX_INTERVIEW_QUESTIONS = 4

GEMINI_LIVE_WSS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

GEMINI_LIVE_MODEL = os.getenv(
    "GEMINI_LIVE_MODEL",
    "models/gemini-2.5-flash-native-audio-preview-12-2025"
)

class GeminiLiveService:
    """
    Bidirectional WebSocket proxy bridge connecting FastAPI client to Google Gemini Live API.
    Uses v1beta WSS endpoint with gemini-2.5-flash-native-audio-preview-12-2025.
    Architecture:
      - Artisan Speaks -> PCM -> Gemini Live
      - Gemini Live Transcribes -> inputTranscription -> Backend AdaptiveInterviewerService
      - Backend processes facts, updates state with row-lock, decides next question
      - Next Question -> BACKEND_QUESTION prompt -> Gemini Live speaks approved question
    """

    def __init__(self, db: Session, session: InterviewSession):
        self.db = db
        self.session = session
        self.interviewer_service = AdaptiveInterviewerService()
        self.gemini_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.answer_processing: bool = False
        self.last_user_spoken_text: str = ""

    def _get_language_code(self) -> str:
        lang_code_map = {
            "te": "te-IN",
            "hi": "hi-IN",
            "ta": "ta-IN",
            "bn": "bn-IN",
            "en": "en-IN",
        }
        return lang_code_map.get(self.session.language, "te-IN")

    def _build_system_instruction(self) -> str:
        lang_names = {
            "te": "Telugu (తెలుగు)",
            "hi": "Hindi (हिंदी)",
            "ta": "Tamil (தமிழ்)",
            "bn": "Bengali (বাংলা)",
            "en": "English"
        }
        lang_label = lang_names.get(self.session.language, "Telugu")
        category_hint = self.session.category_hint or "handcrafted masterpiece"
        
        return f"""
You are "Ananya" (కళా మిత్ర), the warm, polite, and empathetic voice interface for the Artisan AI interview controller.
You are speaking live with a traditional Indian artisan about their craft: "{category_hint}".

STRICT BEHAVIORAL PROTOCOL:
1. You are a controlled voice renderer. You do NOT decide what questions to ask and must NEVER conduct an independent interview.
2. When the artisan speaks, listen attentively and quietly. Do not interrupt with questions of your own.
3. You will receive instructions starting with "BACKEND_QUESTION:". When you receive a "BACKEND_QUESTION:", speak that exact question warmly, politely, and naturally to the artisan in {lang_label} (using polite honorifics like 'అండి' in Telugu, 'జీ' in Hindi).
4. Keep your spoken output brief, clear, and friendly (1-2 sentences maximum). Do not invent follow-up questions or add unapproved topics.
5. Transcribe artisan spoken input strictly in {lang_label} script (Telugu script for Telugu, Devanagari for Hindi). Never output foreign scripts or phonetic approximations in other alphabets.
""".strip()

    def _get_current_or_initial_question(self) -> str:
        sorted_turns = sorted(self.session.turns, key=lambda t: (t.turn_number, t.id or 0)) if self.session.turns else []
        for t in reversed(sorted_turns):
            if t.speaker == "ASSISTANT" and t.question:
                return t.question
        return get_initial_question(self.session.language)

    def _get_completion_message(self) -> str:
        completion_messages = {
            "te": "ధన్యవాదాలండి! మీ కళా వివరాలన్నీ నమోదు చేశాం. ఇప్పుడు మీ కళకు సరైన విక్రయ ధరను నిర్ణయించడానికి మార్కెట్ పరిశోధన ప్రారంభిద్దాం.",
            "hi": "धन्यवाद जी! आपकी कलाकृति की सभी मुख्य जानकारी दर्ज हो चुकी है। अब हम उचित विक्रय मूल्य निर्धारित करने के लिए बाज़ार अनुसंधान शुरू करते हैं।",
            "ta": "நன்றி! உங்கள் கைவினைக் குறிப்புகள் பதிவு செய்யப்பட்டன. நியாயமான விலையைக் கண்டறிய சந்தை ஆராய்ச்சியைத் தொடங்குவோம்.",
            "bn": "ধন্যবাদ! আপনার হস্তশিল্পের সমস্ত প্রয়োজনীয় বিবরণ নথিভুক্ত করা হয়েছে। এবার বাজার গবেষণা শুরু করা যাক।",
            "en": "Thank you! All craftsmanship details have been recorded. We will now proceed with market evidence research to establish a fair price."
        }
        return completion_messages.get(self.session.language, completion_messages["en"])

    async def connect_to_gemini(self) -> bool:
        if not GEMINI_API_KEY:
            logger.warning("[GeminiLiveService] No GEMINI_API_KEY configured. WSS proxy will run in simulated/fallback mode.")
            return False

        ws_url = f"{GEMINI_LIVE_WSS_URL}?key={GEMINI_API_KEY}"
        try:
            self.gemini_ws = await asyncio.wait_for(websockets.connect(ws_url), timeout=10.0)
            
            # Formulate Gemini Live setup frame with sibling inputAudioTranscription
            setup_frame = {
                "setup": {
                    "model": GEMINI_LIVE_MODEL,
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Aoede"
                                }
                            }
                        }
                    },
                    "inputAudioTranscription": {
                        "languageCodes": [self._get_language_code()]
                    },
                    "systemInstruction": {
                        "parts": [{"text": self._build_system_instruction()}]
                    }
                }
            }
            await self.gemini_ws.send(json.dumps(setup_frame))
            logger.info(f"[GeminiLiveService] Established v1beta WSS session with Gemini Live ({GEMINI_LIVE_MODEL}) for session #{self.session.id}")
            return True
        except Exception as e:
            logger.error(f"[GeminiLiveService] Failed to connect to Gemini Live WSS: {e}")
            self.gemini_ws = None
            return False

    async def start_proxy_loop(self, client_ws: WebSocket):
        """
        Runs dual asynchronous streaming loops:
        1. client_to_gemini: forwards PCM audio & text commands from browser to Gemini Live.
        2. gemini_to_client: forwards 24kHz PCM audio, transcripts & interruption signals to browser,
           and bridges finalized speech transcription to the backend AdaptiveInterviewerService.
        """
        gemini_connected = await self.connect_to_gemini()

        # Send initial connected status to client
        await client_ws.send_json({
            "type": "connected",
            "session_id": self.session.id,
            "language": self.session.language,
            "question_count": self.session.question_count,
            "max_questions": MAX_INTERVIEW_QUESTIONS,
            "live_mode": gemini_connected,
            "simulated": not gemini_connected,
            "model": GEMINI_LIVE_MODEL
        })

        async def client_to_gemini():
            try:
                while True:
                    data = await client_ws.receive_text()
                    msg = json.loads(data)
                    msg_type = msg.get("type")

                    if msg_type == "audio" and msg.get("pcm"):
                        # Send 16kHz PCM audio chunk to Gemini Live using mediaChunks
                        if self.gemini_ws:
                            realtime_frame = {
                                "realtimeInput": {
                                    "mediaChunks": [{
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": msg["pcm"]
                                    }]
                                }
                            }
                            await self.gemini_ws.send(json.dumps(realtime_frame))

                    elif msg_type == "answer_text" and msg.get("text"):
                        # Process text answer and trigger backend fact extraction & question count check
                        user_text = msg["text"].strip()
                        self.last_user_spoken_text = ""
                        if user_text and not self.answer_processing:
                            self.answer_processing = True
                            try:
                                await self._process_artisan_text_answer(client_ws, user_text)
                            finally:
                                self.answer_processing = False

                    elif msg_type == "interrupt":
                        # Client-triggered interruption (barge-in)
                        await client_ws.send_json({"type": "interrupted"})

            except WebSocketDisconnect:
                logger.info(f"[GeminiLiveService] Client WebSocket disconnected for session #{self.session.id}")
            except Exception as e:
                logger.warning(f"[GeminiLiveService] Exception in client_to_gemini loop: {e}")

        async def gemini_to_client():
            if not self.gemini_ws:
                return

            try:
                async for raw_msg in self.gemini_ws:
                    resp = json.loads(raw_msg)
                    
                    # 1. Handle setupComplete lifecycle frame -> Send approved opening question
                    if "setupComplete" in resp:
                        logger.info(f"[GeminiLiveService] Setup complete for session #{self.session.id}")
                        await client_ws.send_json({"type": "setup_complete"})
                        
                        initial_q = self._get_current_or_initial_question()
                        if initial_q:
                            await client_ws.send_json({
                                "type": "question",
                                "text": initial_q,
                                "question_count": self.session.question_count or 1
                            })
                        if initial_q and self.gemini_ws:
                            init_turn = {
                                "clientContent": {
                                    "turns": [{
                                        "role": "user",
                                        "parts": [{"text": f"BACKEND_QUESTION: {initial_q}"}]
                                    }],
                                    "turnComplete": True
                                }
                            }
                            await self.gemini_ws.send(json.dumps(init_turn))
                        continue

                    # 2. Handle goAway frame (graceful termination signal)
                    if "goAway" in resp:
                        logger.info(f"[GeminiLiveService] Received goAway frame for session #{self.session.id}")
                        await client_ws.send_json({
                            "type": "go_away",
                            "time_to_go": resp.get("goAway", {}).get("timeToGo"),
                            "message": "Gemini Live session is closing gracefully."
                        })
                        break

                    # 3. Handle sessionResumptionUpdate
                    if "sessionResumptionUpdate" in resp:
                        await client_ws.send_json({
                            "type": "session_resumption",
                            "update": resp.get("sessionResumptionUpdate")
                        })
                        continue

                    # 4. Handle serverContent frame
                    server_content = resp.get("serverContent")
                    if server_content is None:
                        continue

                    # Check for Gemini Live interruption frame
                    if server_content.get("interrupted"):
                        await client_ws.send_json({"type": "interrupted"})
                        continue

                    # A. Handle interim user input transcription (UI subtitles only)
                    interim_trans = server_content.get("interimInputTranscription") or server_content.get("interim_input_transcription")
                    if interim_trans and interim_trans.get("text"):
                        interim_text = interim_trans["text"].strip()
                        if interim_text:
                            if self.last_user_spoken_text:
                                if interim_text.startswith(self.last_user_spoken_text):
                                    display_text = interim_text
                                else:
                                    display_text = f"{self.last_user_spoken_text} {interim_text}".strip()
                            else:
                                display_text = interim_text
                            await client_ws.send_json({
                                "type": "user_transcript",
                                "text": display_text,
                                "is_final": False
                            })

                    # B. Handle finalized user input transcription -> Accumulate full sentence!
                    final_trans = server_content.get("inputTranscription") or server_content.get("input_transcription")
                    if final_trans and final_trans.get("text"):
                        user_spoken_text = final_trans["text"].strip()
                        if user_spoken_text:
                            if not self.last_user_spoken_text:
                                self.last_user_spoken_text = user_spoken_text
                            elif user_spoken_text.startswith(self.last_user_spoken_text):
                                self.last_user_spoken_text = user_spoken_text
                            elif self.last_user_spoken_text.endswith(user_spoken_text):
                                pass
                            else:
                                self.last_user_spoken_text = f"{self.last_user_spoken_text} {user_spoken_text}".strip()

                            await client_ws.send_json({
                                "type": "user_transcript",
                                "text": self.last_user_spoken_text,
                                "is_final": True
                            })

                    # C. Handle Assistant Model Audio / Spoken Output
                    model_turn = server_content.get("modelTurn")
                    if model_turn:
                        parts = model_turn.get("parts", [])
                        for p in parts:
                            # Forward 24kHz PCM Audio chunk
                            inline_data = p.get("inlineData")
                            if inline_data and inline_data.get("data"):
                                await client_ws.send_json({
                                    "type": "audio",
                                    "pcm": inline_data["data"],
                                    "mimeType": inline_data.get("mimeType", "audio/pcm;rate=24000")
                                })

                            # Forward Text Transcript ONLY if NOT an internal thinking block
                            text_val = p.get("text")
                            if text_val and not p.get("thought"):
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "speaker": "ASSISTANT",
                                    "text": text_val
                                })

                    if server_content.get("turnComplete"):
                        await client_ws.send_json({"type": "turn_complete"})
                        # Spoken voice auto-advancement: if artisan spoke and completed turn, process the answer!
                        if self.last_user_spoken_text and len(self.last_user_spoken_text.strip()) >= 2 and not self.answer_processing:
                            spoken_text = self.last_user_spoken_text.strip()
                            self.last_user_spoken_text = ""
                            self.answer_processing = True
                            try:
                                await self._process_artisan_text_answer(client_ws, spoken_text)
                            finally:
                                self.answer_processing = False

            except Exception as e:
                logger.warning(f"[GeminiLiveService] Exception in gemini_to_client loop: {e}")

        try:
            await asyncio.gather(client_to_gemini(), gemini_to_client())
        finally:
            if self.gemini_ws:
                await self.gemini_ws.close()

    async def _process_artisan_text_answer(self, client_ws: WebSocket, answer_text: str):
        """
        Extracts facts, records turn in DB with row lock, enforces MAX_INTERVIEW_QUESTIONS = 4,
        transitions session status to FACTS_COMPLETE when done, and dispatches the backend-approved
        next question to Gemini Live to speak.
        """
        self.last_user_spoken_text = ""
        # 1. Acquire row lock on interview session for concurrency protection
        session = self.db.query(InterviewSession).filter(InterviewSession.id == self.session.id).with_for_update().first()
        if not session:
            logger.warning(f"[GeminiLiveService] Session #{self.session.id} not found in DB.")
            return

        if session.status != "ACTIVE":
            logger.info(f"[GeminiLiveService] Session #{self.session.id} is already in status '{session.status}'. Skipping answer processing.")
            return

        turns = self.db.query(InterviewTurn).filter(InterviewTurn.session_id == session.id).order_by(InterviewTurn.turn_number.asc()).all()
        history = [
            {
                "speaker": t.speaker,
                "question": t.question,
                "answer": t.answer,
                "extracted_facts": json.loads(t.extracted_facts) if t.extracted_facts else []
            }
            for t in turns
        ]

        current_facts = json.loads(session.product_facts) if session.product_facts else {}
        updated_facts, new_extracted, action, next_q, is_complete = await self.interviewer_service.process_artisan_answer(
            session_id=session.id,
            language=session.language,
            current_facts_raw=json.dumps(current_facts),
            turn_history_raw=history,
            current_question_count=session.question_count,
            latest_answer=answer_text,
            photo_url=session.photo_url
        )

        artisan_turn = InterviewTurn(
            session_id=session.id,
            turn_number=session.question_count,
            speaker="ARTISAN",
            answer=answer_text,
            extracted_facts=json.dumps(new_extracted)
        )
        self.db.add(artisan_turn)
        session.product_facts = json.dumps(updated_facts)

        if session.question_count >= MAX_INTERVIEW_QUESTIONS or is_complete or action == "DONE":
            session.status = "FACTS_COMPLETE"
            self.db.commit()
            self.db.refresh(session)
            self.session = session
            await client_ws.send_json({
                "type": "status_change",
                "status": "FACTS_COMPLETE",
                "extracted_facts": updated_facts,
                "message": "Verified product facts complete. Transitioning to Market Evidence Research."
            })
            # Have Gemini Live speak the completion message
            if self.gemini_ws:
                closing_msg = self._get_completion_message()
                await self.gemini_ws.send(json.dumps({
                    "clientContent": {
                        "turns": [{
                            "role": "user",
                            "parts": [{"text": f"BACKEND_QUESTION: {closing_msg}"}]
                        }],
                        "turnComplete": True
                    }
                }))
        else:
            session.question_count += 1
            assistant_turn = InterviewTurn(
                session_id=session.id,
                turn_number=session.question_count,
                speaker="ASSISTANT",
                question=next_q,
                extracted_facts=json.dumps([])
            )
            self.db.add(assistant_turn)
            self.db.commit()
            self.db.refresh(session)
            self.session = session
            await client_ws.send_json({
                "type": "facts_updated",
                "question_count": session.question_count,
                "extracted_facts": updated_facts,
                "next_question": next_q
            })
            # Dispatch backend-approved next question for Gemini Live to speak
            if self.gemini_ws and next_q:
                await self.gemini_ws.send(json.dumps({
                    "clientContent": {
                        "turns": [{
                            "role": "user",
                            "parts": [{"text": f"BACKEND_QUESTION: {next_q}"}]
                        }],
                        "turnComplete": True
                    }
                }))
