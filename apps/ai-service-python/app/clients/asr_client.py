class ASRClient:
    """ASR wrapper placeholder. Replace with cloud ASR provider implementation later."""

    def transcribe(self, audio_url: str | None, fallback_text: str) -> dict:
        if fallback_text:
            return {"text": fallback_text, "confidence": 1.0, "provider": "text-fallback"}
        return {"text": "", "confidence": 0.0, "provider": "mock-asr", "audioUrl": audio_url or ""}

