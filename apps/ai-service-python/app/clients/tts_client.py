class TTSClient:
    """TTS wrapper placeholder. Replace with cloud TTS provider implementation later."""

    def synthesize(self, text: str, accent: str = "american", rate: float = 1.0) -> dict:
        return {
            "text": text,
            "accent": accent,
            "rate": rate,
            "audioUrl": "",
            "provider": "mock-tts",
        }

