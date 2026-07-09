from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.audio import AudioValidationError, convert_mp3_to_wav_bytes, split_wav_bytes, validate_wav_bytes
from app.config import MAX_UPLOAD_BYTES
from app.model import NemoRecognizer, Recognizer

WAV_UPLOAD_TYPES = {"audio/wav", "audio/x-wav", "audio/wave"}
MP3_UPLOAD_TYPES = {"audio/mpeg", "audio/mp3"}
TRANSCRIBE_CHUNK_SECONDS = 60.0
TRANSCRIBE_OVERLAP_SECONDS = 1.0
LOCAL_FRONTEND_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


def _upload_kind(file: UploadFile) -> str | None:
    filename = file.filename.lower() if file.filename else ""
    if file.content_type in WAV_UPLOAD_TYPES or filename.endswith(".wav"):
        return "wav"
    if file.content_type in MP3_UPLOAD_TYPES or filename.endswith(".mp3"):
        return "mp3"
    return None


def _clean_transcript_text(text: str) -> str:
    return " ".join(str(text or "").replace("<zh-CN>", " ").split())


def create_app(recognizer: Recognizer | None = None) -> FastAPI:
    app = FastAPI(title="MeetingRecord Local ASR Service")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(LOCAL_FRONTEND_ORIGINS),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    active_recognizer = recognizer or NemoRecognizer()

    @app.get("/")
    def root():
        return {
            "service": "MeetingRecord Local ASR Service",
            "endpoints": {
                "/health": "GET service and model status",
                "/transcribe": "POST WAV or MP3 file upload",
                "/docs": "OpenAPI documentation",
            },
        }

    @app.get("/health")
    def health():
        return {
            "ok": True,
            "device": active_recognizer.device,
            "modelLoaded": active_recognizer.model_loaded,
        }

    @app.post("/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        upload_kind = _upload_kind(file)
        if upload_kind is None:
            raise HTTPException(
                status_code=415,
                detail="Only WAV and MP3 uploads are supported.",
            )

        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded audio is too large.")

        try:
            wav_data = convert_mp3_to_wav_bytes(data) if upload_kind == "mp3" else data
            info = validate_wav_bytes(wav_data)
        except AudioValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        chunks = split_wav_bytes(
            wav_data,
            chunk_seconds=TRANSCRIBE_CHUNK_SECONDS,
            overlap_seconds=TRANSCRIBE_OVERLAP_SECONDS,
        )
        segments = []
        try:
            for chunk in chunks:
                result = active_recognizer.transcribe_wav(chunk.data)
                segments.append(
                    {
                        "startSeconds": round(chunk.start_seconds, 3),
                        "endSeconds": round(chunk.end_seconds, 3),
                        "text": _clean_transcript_text(result.text),
                    }
                )
        finally:
            active_recognizer.unload_model()

        return {
            "text": "\n\n".join(segment["text"] for segment in segments if segment["text"]),
            "language": "zh-CN",
            "durationSeconds": info.duration_seconds,
            "segments": segments,
        }

    return app


app = create_app()
