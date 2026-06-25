import { callLLM } from '../lib/openai-client.js';
import type { UserCapabilityLevel, WritingCritiqueReport } from '@englishi/shared-types';

interface WritingCritiqueParams {
  ucl: UserCapabilityLevel;
  taskType: string;
  taskPrompt: string;
  submissionText: string;
}

export async function critiqueWriting(params: WritingCritiqueParams): Promise<WritingCritiqueReport> {
  const { ucl, taskType, taskPrompt, submissionText } = params;

  const errorPatternsSummary = ucl.errorPatterns
    .map(e => `${e.type} (seen ${e.frequency}x)`)
    .join(', ') || 'none identified yet';

  const writingCefrStr = ucl.dimensions.writing.toFixed(1);
  const targetModelLevel = (ucl.dimensions.writing + 1.0).toFixed(1);
  const targetBand = ucl.ieltsPrediction + 0.5;

  const systemPrompt = `You are an expert IELTS Writing examiner and English writing coach for adult EFL learners.

Your feedback philosophy:
1. PRECISION over GENERALITY: Every comment must point to a specific sentence or phrase. "Your vocabulary could be improved" is FORBIDDEN.
2. PRIORITIZED: Identify the single highest-impact improvement (not 3, not 5 — ONE).
3. GROWTH-ORIENTED: Acknowledge genuine strengths before improvements.
4. ACTIONABLE: Every improvement suggestion must include a corrected version.
5. CALIBRATED: Model rewrites must not exceed CEFR ${targetModelLevel}. Match the rewrite to the learner's level.

IELTS Writing Band Descriptors:
- TR (Task Response): Does the response address ALL parts of the task?
- CC (Coherence & Cohesion): Clear central idea per paragraph? Logical sequence? Cohesive devices accurate?
- LR (Lexical Resource): Vocabulary precise? Variety? Collocations correct?
- GRA (Grammatical Range & Accuracy): Range of structures? Error frequency?

Score on IELTS 1-9 band scale (0.5 increments).
Output ONLY valid JSON. No markdown, no preamble.`;

  const userPrompt = `Critique this IELTS writing submission.

Writer's CEFR: ${writingCefrStr}
IELTS target band: ${ucl.ieltsPrediction + 0.5}
Task type: ${taskType}
Persistent error patterns to check: ${errorPatternsSummary}
Target model rewrite level: CEFR ${targetModelLevel}

TASK PROMPT:
"${taskPrompt}"

STUDENT SUBMISSION:
"${submissionText}"

Required JSON schema:
{
  "overall": {
    "predicted_band": "float",
    "TR": "float", "CC": "float", "LR": "float", "GRA": "float",
    "word_count": "integer",
    "word_count_note": "string|null"
  },
  "paragraph_analysis": [
    {
      "paragraph_index": "integer",
      "paragraph_text": "string",
      "role_detected": "string",
      "main_idea_clear": "boolean",
      "paragraph_level_comment": "string (max 30 words, specific)"
    }
  ],
  "sentence_annotations": [
    {
      "sentence_index": "integer",
      "original_sentence": "string",
      "annotations": [
        {
          "type": "string (GRA_error|LR_upgrade|CC_issue|TR_issue|highlight)",
          "span": "string",
          "issue": "string",
          "correction": "string",
          "explanation": "string (max 25 words)",
          "severity": "string (critical|moderate|minor|positive)"
        }
      ]
    }
  ],
  "top_priority_improvement": {
    "dimension": "string (TR|CC|LR|GRA)",
    "issue_summary": "string (one sentence)",
    "occurrence_count": "integer",
    "example_original": "string",
    "example_fixed": "string",
    "fix_explanation": "string (max 50 words)",
    "linked_grammar_point": "string|null",
    "quick_practice_available": "boolean"
  },
  "persistent_errors_check": [
    {
      "error_type": "string",
      "appeared_in_this_essay": "boolean",
      "instances": ["string"],
      "improvement_note": "string|null"
    }
  ],
  "highlights": [
    {"original_text": "string", "reason": "string (max 20 words)"}
  ],
  "model_rewrite": {
    "scope": "string (full_essay|key_paragraph)",
    "target_band": "float",
    "rewritten_text": "string",
    "changes_made": [
      {"original": "string", "rewritten": "string", "dimension": "string", "explanation": "string (max 20 words)"}
    ]
  }
}`;

  const raw = await callLLM<any>({
    tier: 'high',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3, // 低温度确保批改一致性
    taskLabel: 'WritingCritic',
  });

  // 映射到 WritingCritiqueReport 类型
  return {
    overall: {
      overall: parseFloat(raw.overall.predicted_band),
      TR: parseFloat(raw.overall.TR),
      CC: parseFloat(raw.overall.CC),
      LR: parseFloat(raw.overall.LR),
      GRA: parseFloat(raw.overall.GRA),
      wordCount: raw.overall.word_count,
      wordCountNote: raw.overall.word_count_note,
    },
    paragraphAnalysis: raw.paragraph_analysis ?? [],
    sentenceAnnotations: (raw.sentence_annotations ?? []).map((sa: any) => ({
      sentenceIndex: sa.sentence_index,
      originalSentence: sa.original_sentence,
      annotations: sa.annotations ?? [],
    })),
    topPriorityImprovement: {
      dimension: raw.top_priority_improvement?.dimension ?? 'GRA',
      issueSummary: raw.top_priority_improvement?.issue_summary ?? '',
      occurrenceCount: raw.top_priority_improvement?.occurrence_count ?? 1,
      exampleOriginal: raw.top_priority_improvement?.example_original ?? '',
      exampleFixed: raw.top_priority_improvement?.example_fixed ?? '',
      fixExplanation: raw.top_priority_improvement?.fix_explanation ?? '',
      linkedGrammarPoint: raw.top_priority_improvement?.linked_grammar_point,
      quickPracticeAvailable: raw.top_priority_improvement?.quick_practice_available ?? false,
    },
    persistentErrorsCheck: raw.persistent_errors_check ?? [],
    highlights: raw.highlights ?? [],
    modelRewrite: {
      scope: raw.model_rewrite?.scope ?? 'key_paragraph',
      targetBand: parseFloat(raw.model_rewrite?.target_band ?? targetBand.toString()),
      rewrittenText: raw.model_rewrite?.rewritten_text ?? '',
      changesMade: raw.model_rewrite?.changes_made ?? [],
    },
  };
}

