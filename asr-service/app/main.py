from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.audio import AudioValidationError, convert_audio_to_wav_bytes, convert_mp3_to_wav_bytes, split_wav_bytes, validate_wav_bytes
from app.config import MAX_STREAM_UPLOAD_BYTES, MAX_UPLOAD_BYTES
from app.model import NemoRecognizer, Recognizer

WAV_UPLOAD_TYPES = {"audio/wav", "audio/x-wav", "audio/wave"}
MP3_UPLOAD_TYPES = {"audio/mpeg", "audio/mp3"}
WEBM_UPLOAD_TYPES = {"audio/webm", "video/webm"}
TRANSCRIBE_CHUNK_SECONDS = 60.0
TRANSCRIBE_OVERLAP_SECONDS = 1.0
LOCAL_FRONTEND_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


def _upload_kind_from_metadata(filename: str, content_type: str) -> str | None:
    normalized_filename = filename.lower()
    if content_type in WAV_UPLOAD_TYPES or normalized_filename.endswith(".wav"):
        return "wav"
    if content_type in MP3_UPLOAD_TYPES or normalized_filename.endswith(".mp3"):
        return "mp3"
    if content_type in WEBM_UPLOAD_TYPES or normalized_filename.endswith(".webm"):
        return "webm"
    return None


def _upload_kind(file: UploadFile) -> str | None:
    return _upload_kind_from_metadata(file.filename or "", file.content_type or "")


def _clean_transcript_text(text: str) -> str:
    return " ".join(str(text or "").replace("<zh-CN>", " ").split())


def _transcribe_wav_data(active_recognizer: Recognizer, wav_data: bytes, info) -> dict:
    chunks = split_wav_bytes(
        wav_data,
        chunk_seconds=TRANSCRIBE_CHUNK_SECONDS,
        overlap_seconds=TRANSCRIBE_OVERLAP_SECONDS,
    )
    segments = []
    for chunk in chunks:
        result = active_recognizer.transcribe_wav(chunk.data)
        segments.append(
            {
                "startSeconds": round(chunk.start_seconds, 3),
                "endSeconds": round(chunk.end_seconds, 3),
                "text": _clean_transcript_text(result.text),
            }
        )
    return {
        "text": "\n\n".join(segment["text"] for segment in segments if segment["text"]),
        "language": "zh-CN",
        "durationSeconds": info.duration_seconds,
        "segments": segments,
    }


def _decode_upload(data: bytes, upload_kind: str) -> bytes:
    if upload_kind == "mp3":
        return convert_mp3_to_wav_bytes(data)
    if upload_kind == "webm":
        return convert_audio_to_wav_bytes(data, input_suffix=".webm", label="WebM")
    return data


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

    @app.post("/unload")
    def unload():
        active_recognizer.unload_model()
        return {"ok": True, "modelLoaded": active_recognizer.model_loaded}

    @app.post("/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        upload_kind = _upload_kind(file)
        if upload_kind is None:
            raise HTTPException(
                status_code=415,
                detail="Only WAV, MP3, and WebM uploads are supported.",
            )

        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded audio is too large.")

        try:
            wav_data = _decode_upload(data, upload_kind)
            info = validate_wav_bytes(wav_data)
        except AudioValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _transcribe_wav_data(active_recognizer, wav_data, info)

    @app.post("/transcribe-file")
    async def transcribe_file(request: Request):
        filename = request.headers.get("x-filename", "audio")
        content_type = request.headers.get("content-type", "")
        upload_kind = _upload_kind_from_metadata(filename, content_type)
        if upload_kind is None:
            raise HTTPException(
                status_code=415,
                detail="Only WAV, MP3, and WebM uploads are supported.",
            )

        total_bytes = 0
        data = bytearray()
        async for chunk in request.stream():
            total_bytes += len(chunk)
            if total_bytes > MAX_STREAM_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Uploaded audio is too large.")
            data.extend(chunk)

        try:
            wav_data = _decode_upload(bytes(data), upload_kind)
            info = validate_wav_bytes(wav_data)
        except AudioValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return _transcribe_wav_data(active_recognizer, wav_data, info)

    return app


app = create_app()
