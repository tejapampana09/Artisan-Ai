import logging
import httpx
from fastapi import APIRouter, Query, Response, HTTPException, Request
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

router = APIRouter(prefix="/api/tts", tags=["Text to Speech Proxy"])

logger = logging.getLogger("artisan_ai")

@router.get("")
async def text_to_speech(request: Request, text: str = Query(...), lang: str = Query("te")):
    """Streams high-quality text-to-speech audio in Telugu, Hindi, Tamil, Bengali, English."""
    rate_limiter.check_rate_limit(
        f"tts:{get_client_identifier(request)}",
        max_requests=30,
        window_seconds=60,
    )
    clean_text = text.strip()[:300]
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text parameter is required")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://translate.google.com/"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "https://translate.google.com/translate_tts",
                params={
                    "ie": "UTF-8",
                    "q": clean_text,
                    "tl": lang,
                    "client": "tw-ob"
                },
                headers=headers
            )
            if res.status_code == 200 and len(res.content) > 0:
                return Response(content=res.content, media_type="audio/mpeg")
            else:
                logger.warning("Google TTS status %s for lang %s", res.status_code, lang)
                raise HTTPException(status_code=503, detail="TTS audio stream temporarily unavailable. Please try again shortly.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("TTS generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="TTS audio stream temporarily unavailable. Please try again shortly.")

