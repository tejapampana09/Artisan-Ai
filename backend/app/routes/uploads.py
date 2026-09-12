import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    """
    Uploads a craft image, saves it to local static directory, and returns its public URL.
    Replaces heavy base64 data URIs with lightweight static file paths.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg"  # Default fallback extension for canvas/camera captures

    filename = f"craft_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Image size exceeds 10MB limit")
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        public_url = f"/uploads/{filename}"
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "url": public_url,
                "filename": filename,
                "size_bytes": len(contents)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded image: {str(e)}")
