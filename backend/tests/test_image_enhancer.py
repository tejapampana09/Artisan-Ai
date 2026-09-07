import asyncio
import base64
import io
from PIL import Image
from backend.app.services.image_enhancer import enhance_studio_image, enhance_image_bytes

def test_image_enhancer_pipeline_success():
    """Verifies image enhancer pipeline converts raw image to studio lighting enhanced data URI."""
    # Create a small 100x100 test PIL image
    img = Image.new("RGB", (100, 100), color=(200, 100, 50))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    raw_bytes = buffer.getvalue()
    
    # 1. Direct bytes enhancement
    enhanced_bytes = enhance_image_bytes(raw_bytes, backdrop_id="royal_silk")
    assert isinstance(enhanced_bytes, bytes)
    assert len(enhanced_bytes) > 0
    
    # 2. Async data URI enhancement
    data_uri = f"data:image/jpeg;base64,{base64.b64encode(raw_bytes).decode('utf-8')}"
    res_uri, is_enh, msg = asyncio.run(enhance_studio_image(data_uri, backdrop_id="royal_silk"))
    
    assert is_enh is True
    assert res_uri.startswith("data:image/jpeg;base64,")
    assert "lighting normalization" in msg

def test_image_enhancer_honest_fallback_when_empty():
    """Verifies honest fallback when image is missing or invalid."""
    res_uri, is_enh, msg = asyncio.run(enhance_studio_image(""))
    assert is_enh is False
    assert "No input photo provided" in msg
