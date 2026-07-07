from fastapi import FastAPI, File, HTTPException, UploadFile

from app.audio import AudioValidationError, validate_wav_bytes
from app.config import MAX_UPLOAD_BYTES
from app.model import NemoRecognizer, Recognizer


def create_app(recognizer: Recognizer | None = None) -> FastAPI:
    app = FastAPI(title="MeetingRecord Local ASR Service")
    active_recognizer = recognizer or NemoRecognizer()

    @app.get("/health")
    def health():
        return {
            "ok": True,
            "device": active_recognizer.device,
            "modelLoaded": active_recognizer.model_loaded,
        }

    @app.post("/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        if file.content_type not in {"audio/wav", "audio/x-wav", "audio/wave"}:
            raise HTTPException(
                status_code=415,
                detail="Only WAV uploads are supported in the first cut.",
            )

        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded audio is too large.")

        try:
            info = validate_wav_bytes(data)
        except AudioValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        result = active_recognizer.transcribe_wav(data)
        return {
            "text": result.text,
            "language": result.language,
            "durationSeconds": info.duration_seconds,
        }

    return app


app = create_app()
