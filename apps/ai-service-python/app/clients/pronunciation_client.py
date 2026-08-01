class PronunciationClient:
    """Pronunciation assessment wrapper placeholder."""

    def evaluate(self, transcript: str, reference_text: str | None = None) -> dict:
        word_count = len(transcript.split())
        base = 78 if word_count >= 5 else 65
        return {
            "overallScore": base,
            "accuracyScore": max(0, base - 3),
            "fluencyScore": base,
            "completenessScore": min(100, base + 5),
            "prosodyScore": max(0, base - 5),
            "referenceText": reference_text or "",
            "provider": "mock-pronunciation",
        }

