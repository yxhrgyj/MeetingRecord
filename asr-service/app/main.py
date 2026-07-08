from fastapi import FastAPI, File, HTTPException, UploadFile

from app.audio import AudioValidationError, convert_mp3_to_wav_bytes, validate_wav_bytes
from app.config import MAX_UPLOAD_BYTES
from app.model import NemoRecognizer, Recognizer

WAV_UPLOAD_TYPES = {"audio/wav", "audio/x-wav", "audio/wave"}
MP3_UPLOAD_TYPES = {"audio/mpeg", "audio/mp3"}


def _upload_kind(file: UploadFile) -> str | None:
    filename = file.filename.lower() if file.filename else ""
    if file.content_type in WAV_UPLOAD_TYPES or filename.endswith(".wav"):
        return "wav"
    if file.content_type in MP3_UPLOAD_TYPES or filename.endswith(".mp3"):
        return "mp3"
    return None


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

        result = active_recognizer.transcribe_wav(wav_data)
        return {
            "text": result.text,
            "language": result.language,
            "durationSeconds": info.duration_seconds,
        }

    return app


app = create_app()
