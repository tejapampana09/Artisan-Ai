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
from backend.app.services.gemini_interviewer import AdaptiveInterviewerService

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
    Handles 16kHz PCM audio input from browser, 24kHz PCM audio output from Gemini Live,
    barge-in interruption signals, lifecycle frames (setupComplete, goAway, sessionResumptionUpdate),
    fact extraction, and state machine transitions.
    """

    def __init__(self, db: Session, session: InterviewSession):
        self.db = db
        self.session = session
        self.interviewer_service = AdaptiveInterviewerService()
        self.gemini_ws: Optional[websockets.WebSocketClientProtocol] = None

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
You are "Ananya" (కళా మిత్ర / Craft Companion), a warm, empathetic, and encouraging AI craft counselor speaking live with a traditional Indian artisan in {lang_label}.
The artisan is sharing details about their creation: "{category_hint}".

YOUR MANDATE:
1. Speak exclusively in {lang_label} with polite honorifics ("అండి" in Telugu, "జీ" in Hindi).
2. Talk like a real, caring friend. Keep answers brief (1-2 sentences maximum per turn) so the artisan can talk naturally.
3. Express genuine appreciation for their craftsmanship, then ask gentle follow-up questions about craft materials, creation time, dimensions, and craft story.
4. Keep the conversation focused on understanding their craft for marketplace pricing.
""".strip()

    async def connect_to_gemini(self) -> bool:
        if not GEMINI_API_KEY:
            logger.warning("[GeminiLiveService] No GEMINI_API_KEY configured. WSS proxy will run in simulated mode.")
            return False

        ws_url = f"{GEMINI_LIVE_WSS_URL}?key={GEMINI_API_KEY}"
        try:
            self.gemini_ws = await websockets.connect(ws_url, timeout=10)
            
            # Formulate initial Gemini Live setup frame
            setup_frame = {
                "setup": {
                    "model": GEMINI_LIVE_MODEL,
                    "generationConfig": {
                        "responseModalities": ["AUDIO", "TEXT"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Puck"
                                }
                            }
                        }
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
        2. gemini_to_client: forwards 24kHz PCM audio, transcripts & interruption signals to browser.
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
            "model": GEMINI_LIVE_MODEL
        })

        async def client_to_gemini():
            try:
                while True:
                    data = await client_ws.receive_text()
                    msg = json.loads(data)
                    msg_type = msg.get("type")

                    if msg_type == "audio" and msg.get("pcm"):
                        # Send 16kHz PCM audio chunk to Gemini Live
                        if self.gemini_ws:
                            realtime_frame = {
                                "realtimeInput": {
                                    "mediaChunks": [
                                        {
                                            "mimeType": "audio/pcm;rate=16000",
                                            "data": msg["pcm"]
                                        }
                                    ]
                                }
                            }
                            await self.gemini_ws.send(json.dumps(realtime_frame))

                    elif msg_type == "answer_text" and msg.get("text"):
                        # Process text answer and trigger backend fact extraction & question count check
                        user_text = msg["text"].strip()
                        await self._process_artisan_text_answer(client_ws, user_text)
                        
                        if self.gemini_ws:
                            client_turn = {
                                "clientContent": {
                                    "turns": [
                                        {
                                            "role": "user",
                                            "parts": [{"text": user_text}]
                                        }
                                    ],
                                    "turnComplete": True
                                }
                            }
                            await self.gemini_ws.send(json.dumps(client_turn))

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
                    
                    # 1. Handle setupComplete lifecycle frame
                    if resp.get("setupComplete"):
                        await client_ws.send_json({"type": "setup_complete"})
                        continue

                    # 2. Handle goAway frame (graceful termination signal)
                    if resp.get("goAway"):
                        logger.info(f"[GeminiLiveService] Received goAway frame for session #{self.session.id}")
                        await client_ws.send_json({
                            "type": "go_away",
                            "time_to_go": resp.get("goAway", {}).get("timeToGo"),
                            "message": "Gemini Live session is closing gracefully."
                        })
                        break

                    # 3. Handle sessionResumptionUpdate
                    if resp.get("sessionResumptionUpdate"):
                        await client_ws.send_json({
                            "type": "session_resumption",
                            "update": resp.get("sessionResumptionUpdate")
                        })
                        continue

                    # 4. Handle serverContent frame
                    server_content = resp.get("serverContent")
                    if not server_content:
                        continue

                    # Check for Gemini Live interruption frame
                    if server_content.get("interrupted"):
                        await client_ws.send_json({"type": "interrupted"})
                        continue

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

                            # Forward Text Transcript
                            text_val = p.get("text")
                            if text_val:
                                await client_ws.send_json({
                                    "type": "transcript",
                                    "speaker": "ASSISTANT",
                                    "text": text_val
                                })

                    if server_content.get("turnComplete"):
                        await client_ws.send_json({"type": "turn_complete"})

            except Exception as e:
                logger.warning(f"[GeminiLiveService] Exception in gemini_to_client loop: {e}")

        try:
            await asyncio.gather(client_to_gemini(), gemini_to_client())
        finally:
            if self.gemini_ws:
                await self.gemini_ws.close()

    async def _process_artisan_text_answer(self, client_ws: WebSocket, answer_text: str):
        """
        Extracts facts, records turn in DB, enforces MAX_INTERVIEW_QUESTIONS = 4,
        and transitions session status to FACTS_COMPLETE when done.
        """
        turns = self.db.query(InterviewTurn).filter(InterviewTurn.session_id == self.session.id).order_by(InterviewTurn.turn_number.asc()).all()
        history = [
            {
                "speaker": t.speaker,
                "question": t.question,
                "answer": t.answer,
                "extracted_facts": json.loads(t.extracted_facts) if t.extracted_facts else []
            }
            for t in turns
        ]

        current_facts = json.loads(self.session.product_facts) if self.session.product_facts else {}
        updated_facts, new_extracted, action, next_q, is_complete = await self.interviewer_service.process_artisan_answer(
            session_id=self.session.id,
            language=self.session.language,
            current_facts_raw=json.dumps(current_facts),
            turn_history_raw=history,
            current_question_count=self.session.question_count,
            latest_answer=answer_text,
            photo_url=self.session.photo_url
        )

        artisan_turn = InterviewTurn(
            session_id=self.session.id,
            turn_number=self.session.question_count,
            speaker="ARTISAN",
            answer=answer_text,
            extracted_facts=json.dumps(new_extracted)
        )
        self.db.add(artisan_turn)
        self.session.product_facts = json.dumps(updated_facts)

        if self.session.question_count >= MAX_INTERVIEW_QUESTIONS or is_complete or action == "DONE":
            self.session.status = "FACTS_COMPLETE"
            self.db.commit()
            self.db.refresh(self.session)
            await client_ws.send_json({
                "type": "status_change",
                "status": "FACTS_COMPLETE",
                "extracted_facts": updated_facts,
                "message": "Verified product facts complete. Transitioning to Market Evidence Research."
            })
        else:
            self.session.question_count += 1
            assistant_turn = InterviewTurn(
                session_id=self.session.id,
                turn_number=self.session.question_count,
                speaker="ASSISTANT",
                question=next_q,
                extracted_facts=json.dumps([])
            )
            self.db.add(assistant_turn)
            self.db.commit()
            self.db.refresh(self.session)
            await client_ws.send_json({
                "type": "facts_updated",
                "question_count": self.session.question_count,
                "extracted_facts": updated_facts,
                "next_question": next_q
            })
