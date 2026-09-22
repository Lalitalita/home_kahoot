import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


async def save_upload(file: UploadFile, subdir: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format d'image non supporté")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 8 Mo)")

    target_dir = os.path.join(settings.upload_dir, subdir)
    os.makedirs(target_dir, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(target_dir, filename)
    with open(path, "wb") as f:
        f.write(contents)

    return f"/uploads/{subdir}/{filename}"
