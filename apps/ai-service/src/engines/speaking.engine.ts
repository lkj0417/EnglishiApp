import { callLLM } from '../lib/openai-client.js';
import type { UserCapabilityLevel, SpeakingFeedbackReport } from '@englishi/shared-types';

interface SpeakingReportParams {
  ucl: UserCapabilityLevel;
  transcript: Array<{ speaker: 'examiner' | 'candidate'; text: string; tsStart: number; tsEnd: number }>;
  acousticData: {
    fillerWordCount: number;
    fillerWordsFound: string[];
    avgSpeechRateWpm: number;
    pauseFrequencyPerMinute: number;
  };
  sessionType: 'Part1' | 'Part2' | 'Part3' | 'Full_Test';
}

export async function generateSpeakingReport(params: SpeakingReportParams): Promise<SpeakingFeedbackReport> {
  const { ucl, transcript, acousticData, sessionType } = params;

  const candidateLines = transcript
    .filter(t => t.speaker === 'candidate')
    .map(t => t.text)
    .join(' ');

  const transcriptJson = JSON.stringify(transcript.slice(0, 30)); // 限制上下文长度

  const errorPatterns = ucl.errorPatterns
    .map(e => e.type).join(', ') || 'none';

  const systemPrompt = `You are an expert IELTS Speaking examiner providing post-session pedagogical feedback.

IELTS Speaking Band Descriptors — score each on 1-9 scale (0.5 increments):
- FC (Fluency & Coherence): Speech rate, filler words, logical sequencing, discourse markers
- LR (Lexical Resource): Vocabulary range, precision, collocations, idiomatic usage
- GRA (Grammatical Range & Accuracy): Sentence complexity, error frequency
- PR (Pronunciation): Phoneme accuracy, intonation, stress, intelligibility

Base ALL scores strictly on the official IELTS Speaking Band Descriptors.
Be honest — do NOT inflate scores.

Output ONLY valid JSON. No markdown.`;

  const userPrompt = `Generate a feedback report for an IELTS Speaking ${sessionType} session.

Candidate CEFR: ${ucl.dimensions.speaking.toFixed(1)}
Target IELTS Band: ${ucl.ieltsPrediction + 0.5}
Known error patterns: ${errorPatterns}

Acoustic Analysis:
- Filler word count: ${acousticData.fillerWordCount}
- Filler words: ${acousticData.fillerWordsFound.join(', ')}
- Average speech rate: ${acousticData.avgSpeechRateWpm} wpm
- Pause frequency: ${acousticData.pauseFrequencyPerMinute}/min

Full transcript (truncated):
${transcriptJson}

Candidate's full speech:
"${candidateLines.slice(0, 1500)}"

Required JSON schema:
{
  "overall_band": "float",
  "dimension_scores": {
    "FC": {"band": "float", "key_evidence": "string (specific quote)"},
    "LR": {"band": "float", "key_evidence": "string"},
    "GRA": {"band": "float", "key_evidence": "string"},
    "PR": {"band": "float", "key_evidence": "string"}
  },
  "highlights": [
    {"text": "string (exact quote)", "reason": "string (why it's good, max 20 words)"}
  ],
  "top_improvements": [
    {
      "priority": "integer (1=highest)",
      "dimension": "string (FC|LR|GRA|PR)",
      "issue": "string",
      "example_wrong": "string (exact quote)",
      "example_corrected": "string",
      "explanation": "string (max 40 words)",
      "linked_practice_type": "string"
    }
  ],
  "model_response_example": {
    "question": "string (one question from session)",
    "candidate_answer": "string",
    "model_answer_band75": "string",
    "changes_explained": ["string"]
  },
  "acoustic_summary": {
    "filler_assessment": "string (brief comment)",
    "pace_assessment": "string",
    "overall_delivery_note": "string"
  }
}`;

  const raw = await callLLM<any>({
    tier: 'high',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    taskLabel: 'SpeakingExaminer',
  });

  return {
    overallBand: parseFloat(raw.overall_band),
    dimensionScores: {
      overall: parseFloat(raw.overall_band),
      FC: parseFloat(raw.dimension_scores?.FC?.band ?? '5'),
      LR: parseFloat(raw.dimension_scores?.LR?.band ?? '5'),
      GRA: parseFloat(raw.dimension_scores?.GRA?.band ?? '5'),
      PR: parseFloat(raw.dimension_scores?.PR?.band ?? '5'),
    },
    highlights: raw.highlights ?? [],
    topImprovements: (raw.top_improvements ?? []).map((imp: any) => ({
      priority: imp.priority,
      dimension: imp.dimension,
      issue: imp.issue,
      exampleWrong: imp.example_wrong,
      exampleCorrected: imp.example_corrected,
      explanation: imp.explanation,
      linkedPracticeType: imp.linked_practice_type,
    })),
    modelResponseExample: {
      question: raw.model_response_example?.question ?? '',
      candidateAnswer: raw.model_response_example?.candidate_answer ?? '',
      modelAnswerBand75: raw.model_response_example?.model_answer_band75 ?? '',
      changesExplained: raw.model_response_example?.changes_explained ?? [],
    },
    acousticAnalysis: {
      fillerWordCount: acousticData.fillerWordCount,
      fillerWordsFound: acousticData.fillerWordsFound,
      avgSpeechRateWpm: acousticData.avgSpeechRateWpm,
      pauseFrequencyPerMinute: acousticData.pauseFrequencyPerMinute,
      pronunciationErrorFlags: [],
    },
  };
}

/** 生成 Part 1 题目集 */
export async function generatePart1Questions(params: {
  ucl: UserCapabilityLevel;
  recentTopics: string[];
}): Promise<{ topics: Array<{ topicName: string; questions: Array<{ qId: string; question: string; expectedLengthSeconds: number }> }> }> {
  const { ucl, recentTopics } = params;

  const prompt = `Generate an IELTS Speaking Part 1 question set.

Candidate CEFR: ${ucl.dimensions.speaking.toFixed(1)}
Avoid these recently-used topics: ${recentTopics.join(', ')}
Interest domain: ${ucl.dimensions.speaking > 4 ? 'abstract topics acceptable' : 'personal/concrete topics preferred'}

Select 3 topic areas appropriate for CEFR ${ucl.dimensions.speaking.toFixed(1)}.
For each topic: 1 opening question + 2 follow-ups.

Level calibration:
- B1 (3.0-3.9): Personal life, daily routines, preferences (concrete)
- B2 (4.0-4.9): Opinions, comparisons, mild reasoning
- C1 (5.0+): Abstraction, reasoning, cultural perspectives

Output JSON only:
{
  "topics": [
    {
      "topic_name": "string",
      "questions": [
        {"q_id": "string", "question": "string", "expected_length_seconds": "integer"}
      ]
    }
  ]
}`;

  const raw = await callLLM<any>({
    tier: 'fast',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    taskLabel: 'SpeakingPart1Generator',
  });

  return {
    topics: (raw.topics ?? []).map((t: any) => ({
      topicName: t.topic_name,
      questions: (t.questions ?? []).map((q: any) => ({
        qId: q.q_id ?? crypto.randomUUID().slice(0, 8),
        question: q.question,
        expectedLengthSeconds: q.expected_length_seconds ?? 30,
      })),
    })),
  };
}

/** 动态生成 Part 3 追问 */
export async function generatePart3FollowUp(params: {
  originalQuestion: string;
  candidateResponse: string;
  speakingCefr: number;
}): Promise<{ followUpQuestion: string; followUpType: string }> {
  const { originalQuestion, candidateResponse, speakingCefr } = params;

  const wordCount = candidateResponse.split(' ').length;
  const hasOpinion = /I think|I believe|In my opinion|I feel|I would say/i.test(candidateResponse);
  const hasEvidence = /for example|for instance|such as|like when|one case/i.test(candidateResponse);

  const prompt = `Generate a Part 3 follow-up question based on the candidate's response.

Original question: "${originalQuestion}"
Candidate's response: "${candidateResponse}"
Response stats: ${wordCount} words, has_opinion=${hasOpinion}, has_evidence=${hasEvidence}
Candidate CEFR: ${speakingCefr.toFixed(1)}

Decision logic:
- If response < 20 words → ask for elaboration
- If no opinion expressed → ask for their position
- If no evidence/example → ask "What makes you say that?"
- If response is inconsistent → gentle challenge
- If response is strong → extend to wider context

Output JSON only:
{"follow_up_question": "string", "follow_up_type": "string (elaboration|position|evidence|challenge|extension)"}`;

  const raw = await callLLM<any>({
    tier: 'fast',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    taskLabel: 'Part3FollowUp',
  });

  return {
    followUpQuestion: raw.follow_up_question ?? 'Could you tell me more about that?',
    followUpType: raw.follow_up_type ?? 'elaboration',
  };
}

