import json
import asyncio
import logging
from decimal import Decimal
from typing import Optional, List, Dict, Any, cast
from fastapi import APIRouter, Depends, HTTPException, status, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import InterviewSession, InterviewTurn, MarketEvidence, Product, User
from backend.app.schemas.artisan_interview import (
    InterviewStartRequest, InterviewAnswerRequest, ExpectedPriceRequest,
    FinalPriceRequest, PublishListingRequest, InterviewSessionResponse
)
from backend.app.schemas import ProductResponse
from backend.app.services.auth import get_current_user, decode_access_token
from backend.app.services.gemini_interviewer import AdaptiveInterviewerService, normalize_fact_entry
from backend.app.services.market_research import MarketResearchService
from backend.app.services.listing_generator import ListingGeneratorService
from backend.app.services.v2_pricing_engine import V2PricingEngine
from backend.app.services.gemini_live_service import GeminiLiveService

logger = logging.getLogger("artisan_ai")

router = APIRouter(prefix="/api/interview", tags=["V2 Artisan Adaptive Interview"])

def _build_session_response(session: InterviewSession) -> InterviewSessionResponse:
    facts = json.loads(session.product_facts) if session.product_facts else {}
    listing = json.loads(session.ai_generated_listing) if session.ai_generated_listing else None
    research = json.loads(session.market_research_result) if session.market_research_result else None
    reasoning = json.loads(session.pricing_explanation) if session.pricing_explanation else []

    current_q = None
    sorted_turns = sorted(session.turns, key=lambda t: (t.turn_number, t.id or 0)) if session.turns else []
    if sorted_turns:
        last_turn = sorted_turns[-1]
        if last_turn.speaker == "ASSISTANT":
            current_q = last_turn.question

    return InterviewSessionResponse(
        id=session.id,
        user_id=session.user_id,
        language=session.language,
        photo_url=session.photo_url,
        category_hint=session.category_hint,
        question_count=session.question_count,
        status=session.status,
        current_question=current_q,
        product_facts=facts,
        ai_generated_listing=listing,
        market_research_result=research,
        artisan_expected_price=float(session.artisan_expected_price) if session.artisan_expected_price is not None else None,
        recommended_price=float(session.recommended_price) if session.recommended_price is not None else None,
        pricing_explanation=reasoning,
        created_at=session.created_at
    )

@router.post("/start", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_interview_session(
    req: InterviewStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Starts a persistent V2 Multilingual Adaptive Interview Session.
    Formulates initial opening question and stores primary + secondary photo references.
    """
    interviewer = AdaptiveInterviewerService()
    initial_q = await interviewer.get_dynamic_initial_question(
        language=req.language,
        category_hint=req.category_hint,
        photo_url=req.photo_url
    )
    
    initial_facts = {}
    if req.category_hint:
        initial_facts["category"] = normalize_fact_entry(req.category_hint, source="ARTISAN_CONFIRMED")
    if req.secondary_images:
        initial_facts["secondary_photos"] = req.secondary_images if isinstance(req.secondary_images, list) else [str(req.secondary_images)]

    session = InterviewSession(
        user_id=current_user.id,
        language=req.language,
        photo_url=req.photo_url,
        category_hint=req.category_hint,
        question_count=1,
        status="ACTIVE",
        product_facts=json.dumps(initial_facts)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Record initial assistant turn
    turn = InterviewTurn(
        session_id=session.id,
        turn_number=1,
        speaker="ASSISTANT",
        question=initial_q,
        extracted_facts=json.dumps([])
    )
    db.add(turn)
    db.commit()
    db.refresh(session)

    return _build_session_response(session)

@router.post("/{session_id}/answer", response_model=InterviewSessionResponse)
async def process_interview_answer(
    session_id: int,
    req: InterviewAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits artisan answer using SELECT FOR UPDATE row-level locking.
    Extracts facts with provenance, updates session state, and returns next question or FACTS_COMPLETE.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit answer in session status '{session.status}'. Session status must be 'ACTIVE'."
        )

    history = [
        {"speaker": t.speaker, "question": t.question, "answer": t.answer}
        for t in session.turns
    ]
    
    interviewer = AdaptiveInterviewerService()
    updated_facts, new_extracted, action, next_q, is_complete = await interviewer.process_artisan_answer(
        session_id=session.id,
        language=session.language,
        current_facts_raw=session.product_facts,
        turn_history_raw=history,
        current_question_count=session.question_count,
        latest_answer=req.answer.strip(),
        photo_url=session.photo_url
    )

    artisan_turn = InterviewTurn(
        session_id=session.id,
        turn_number=session.question_count,
        speaker="ARTISAN",
        answer=req.answer.strip(),
        extracted_facts=json.dumps(new_extracted)
    )
    db.add(artisan_turn)
    session.product_facts = json.dumps(updated_facts)

    if is_complete or action == "DONE":
        session.status = "FACTS_COMPLETE"
    else:
        session.question_count += 1
        assistant_turn = InterviewTurn(
            session_id=session.id,
            turn_number=session.question_count,
            speaker="ASSISTANT",
            question=next_q,
            extracted_facts=json.dumps([])
        )
        db.add(assistant_turn)

    db.commit()
    db.refresh(session)
    return _build_session_response(session)

@router.get("/{session_id}", response_model=InterviewSessionResponse)
def get_interview_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    return _build_session_response(session)

@router.post("/{session_id}/market-research", response_model=InterviewSessionResponse)
async def run_market_research(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Executes evidence-based market research on verified product facts.
    Enforces strict state machine sequence: session MUST be in FACTS_COMPLETE status.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "FACTS_COMPLETE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot execute market research in session status '{session.status}'. Must be in FACTS_COMPLETE status."
        )

    facts = json.loads(session.product_facts) if session.product_facts else {}
    service = MarketResearchService()
    research_result = await service.execute_market_research(db, session.id, facts)

    session.market_research_result = json.dumps(research_result)
    session.status = "MARKET_RESEARCH_COMPLETE"
    db.commit()
    db.refresh(session)

    return _build_session_response(session)

@router.post("/{session_id}/expected-price", response_model=InterviewSessionResponse)
def record_expected_price(
    session_id: int,
    req: ExpectedPriceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Records artisan expected selling price after reviewing market evidence.
    Enforces strict state machine sequence: session MUST be in MARKET_RESEARCH_COMPLETE status.
    Transitions session status to PRICE_PENDING.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "MARKET_RESEARCH_COMPLETE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit expected price in session status '{session.status}'. Must be in MARKET_RESEARCH_COMPLETE status."
        )

    session.artisan_expected_price = Decimal(str(req.expected_price)).quantize(Decimal("0.01"))
    session.status = "PRICE_PENDING"
    db.commit()
    db.refresh(session)

    return _build_session_response(session)

@router.post("/{session_id}/generate-listing", response_model=InterviewSessionResponse)
async def generate_listing_prose(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates AI product listing prose based strictly on verified facts.
    Sub-operation inside PRICE_PENDING status.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "PRICE_PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate listing in session status '{session.status}'. Must be in PRICE_PENDING status."
        )

    facts = json.loads(session.product_facts) if session.product_facts else {}
    research = json.loads(session.market_research_result) if session.market_research_result else {}

    service = ListingGeneratorService()
    listing = await service.generate_listing(
        language=session.language,
        product_facts=facts,
        artisan_story=facts.get("story", {}).get("value") if isinstance(facts.get("story"), dict) else facts.get("story"),
        market_context=research
    )

    session.ai_generated_listing = json.dumps(listing)
    db.commit()
    db.refresh(session)

    return _build_session_response(session)

@router.post("/{session_id}/final-price", response_model=InterviewSessionResponse)
def calculate_final_price(
    session_id: int,
    req: FinalPriceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates V2 Dynamic Pricing Engine:
    Combines Market Evidence + Cost Basis Floor + Artisan Expected Price + Option B Safety Caps.
    Enforces strict state machine sequence: session MUST be in PRICE_PENDING status.
    Transitions session status to READY_FOR_REVIEW.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "PRICE_PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot calculate final price in session status '{session.status}'. Must be in PRICE_PENDING status."
        )

    facts = json.loads(session.product_facts) if session.product_facts else {}
    research = json.loads(session.market_research_result) if session.market_research_result else {}

    engine = V2PricingEngine()
    pricing_res = engine.calculate_v2_recommendation(
        material_cost=req.material_cost,
        labour_cost=req.labour_cost,
        packaging_cost=req.packaging_cost,
        other_cost=req.other_cost,
        market_research_result=research,
        artisan_expected_price=session.artisan_expected_price
    )

    rec_price = pricing_res.get("recommended_price")
    session.recommended_price = Decimal(str(rec_price)).quantize(Decimal("0.01")) if rec_price else None
    session.pricing_explanation = json.dumps(pricing_res.get("reasoning", []))
    session.status = "READY_FOR_REVIEW"
    db.commit()
    db.refresh(session)

    return _build_session_response(session)

@router.post("/{session_id}/publish", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def publish_interview_product(
    session_id: int,
    req: PublishListingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Final Publishing Operation:
    Enforces state machine sequence: session status MUST be in READY_FOR_REVIEW status.
    Transitions session status to PUBLISHED.
    """
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Permission denied")

    if session.status != "READY_FOR_REVIEW":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish product when interview session is in status '{session.status}'. Must be in READY_FOR_REVIEW status."
        )

    ai_draft = json.loads(session.ai_generated_listing) if session.ai_generated_listing else {}
    
    # Audit provenance: AI draft vs Artisan final approved listing
    audit_provenance = {
        "ai_draft_title": ai_draft.get("title"),
        "published_title": req.title,
        "ai_recommended_price": float(session.recommended_price) if session.recommended_price else None,
        "published_price": float(req.price),
        "artisan_edited_title": req.title != ai_draft.get("title"),
        "artisan_edited_price": session.recommended_price is not None and Decimal(str(req.price)) != session.recommended_price,
        "provenance": "ARTISAN_REVIEWED_AND_APPROVED"
    }

    product = Product(
        title=req.title,
        category=req.category,
        materials=req.materials,
        description=req.description,
        craft_story=req.craft_story,
        title_en=req.title_en or req.title,
        description_en=req.description_en or req.description,
        craft_story_en=req.craft_story_en or req.craft_story,
        translations=req.translations,
        price=req.price.quantize(Decimal("0.01")),
        stock=req.stock,
        material_cost=req.material_cost.quantize(Decimal("0.01")) if req.material_cost is not None else Decimal("0.00"),
        labour_cost=req.labour_cost.quantize(Decimal("0.01")) if req.labour_cost is not None else Decimal("0.00"),
        packaging_cost=req.packaging_cost.quantize(Decimal("0.01")) if req.packaging_cost is not None else Decimal("0.00"),
        other_cost=req.other_cost.quantize(Decimal("0.01")) if req.other_cost is not None else Decimal("0.00"),
        image_url=req.image_url or session.photo_url,
        enhanced_image_url=req.enhanced_image_url,
        status="PUBLISHED",
        seller_id=current_user.id
    )
    db.add(product)
    
    session.status = "PUBLISHED"
    # Store audit provenance in session facts
    facts = json.loads(session.product_facts) if session.product_facts else {}
    facts["publish_audit"] = audit_provenance
    session.product_facts = json.dumps(facts)

    db.commit()
    db.refresh(product)
    return product

@router.websocket("/{session_id}/live-ws")
async def interview_live_websocket(
    session_id: int,
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    Bidirectional WebSocket endpoint for live Gemini audio interview.
    Requires first message to be an auth packet: { "type": "auth", "token": "JWT..." }.
    Avoids passing auth tokens in URL or query params.
    """
    await websocket.accept()

    try:
        # Wait up to 5.0s for first message auth packet
        raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        msg = json.loads(raw_msg)

        if msg.get("type") != "auth" or not msg.get("token"):
            await websocket.send_json({"type": "error", "message": "First message must be auth packet with token."})
            await websocket.close(code=1008)
            return

        token = msg["token"]
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            await websocket.send_json({"type": "error", "message": "Invalid or expired authentication token."})
            await websocket.close(code=1008)
            return

        user_id = int(payload["sub"])
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.send_json({"type": "error", "message": "User account not found."})
            await websocket.close(code=1008)
            return

        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            await websocket.send_json({"type": "error", "message": "Interview session not found."})
            await websocket.close(code=1008)
            return

        if session.user_id != user.id and user.role != "ADMIN":
            await websocket.send_json({"type": "error", "message": "Permission denied."})
            await websocket.close(code=1008)
            return

        if session.status != "ACTIVE":
            await websocket.send_json({"type": "error", "message": f"Session status is '{session.status}'. Must be in ACTIVE status."})
            await websocket.close(code=1008)
            return

        # Start Gemini Live bidirectional proxy loop
        live_service = GeminiLiveService(db, session)
        await live_service.start_proxy_loop(websocket)

    except asyncio.TimeoutError:
        try:
            await websocket.send_json({"type": "error", "message": "Authentication timeout."})
            await websocket.close(code=1008)
        except Exception:
            pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[interview_live_websocket] Error: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

