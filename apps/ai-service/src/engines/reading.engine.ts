import { callLLM } from '../lib/openai-client.js';
import type { UserCapabilityLevel, ReadingArticle } from '@englishi/shared-types';
import { calcTargetWordCount } from '@englishi/cefr-utils';

interface GenerateReadingParams {
  ucl: UserCapabilityLevel;
  interestDomain: string;
  topic?: string;
}

export async function generateReadingArticle(params: GenerateReadingParams): Promise<ReadingArticle> {
  const { ucl, interestDomain, topic } = params;
  const targetWords = calcTargetWordCount(ucl.overallCefr);
  const currentCefrStr = ucl.overallCefr.toFixed(1);
  const vocabCeiling = (ucl.overallCefr + 1.0).toFixed(1);
  const grammarForbidden = ucl.notYetGrammar.slice(0, 8).join(', ');
  const grammarAllowed = ucl.masteredGrammar.slice(0, 12).join(', ');
  const recentTopics = (ucl as any).recentTopics?.join(', ') ?? 'none';
  const newWordCount = Math.round(targetWords * 0.06);

  const systemPrompt = `You are an expert EFL content creator specializing in graded readers for adult learners.
Your task is to generate a reading passage that is pedagogically precise: engaging, educational, and exactly calibrated to the learner's current proficiency level.

CRITICAL CONSTRAINTS (non-negotiable):
- Vocabulary: 92-96% of words must be CEFR ${currentCefrStr} or below. The remaining 4-8% are i+1 target words at exactly CEFR ${vocabCeiling}.
- NEVER use vocabulary above CEFR ${vocabCeiling}.
- Grammar: ONLY use structures from: [${grammarAllowed}].
- FORBIDDEN grammar structures: [${grammarForbidden}].
- All factual claims must be commonly accepted truths. NO specific statistics unless unambiguous.
- Tone: engaging, informative, not condescending. No political bias. No moral preaching.

Output ONLY a valid JSON object. No markdown, no preamble.`;

  const userPrompt = `Generate a reading passage about "${topic ?? interestDomain}" for an EFL learner.

Learner CEFR: ${currentCefrStr}
Word count target: ${targetWords} words (±10%)
Interest domain: ${interestDomain}
Topics recently covered (DO NOT repeat): ${recentTopics}
Include exactly ${newWordCount} i+1 target vocabulary words at CEFR ${vocabCeiling}.
Generate 4 comprehension questions: 1 detail, 1 inference, 1 vocabulary_in_context, 1 main_idea.

Required JSON schema:
{
  "title": "string",
  "body": "string",
  "word_count": "integer",
  "topic": "string",
  "genre": "string (informational/narrative/argumentative)",
  "target_vocabulary": [
    {
      "word": "string",
      "cefr_level": "string",
      "definition_en": "string (max 10 words)",
      "definition_zh": "string",
      "sentence_in_article": "string",
      "phonetic": "string (IPA)",
      "part_of_speech": "string",
      "collocations": ["string"],
      "word_family": {"noun": "string|null", "verb": "string|null", "adjective": "string|null", "adverb": "string|null"},
      "memory_aid": "string|null"
    }
  ],
  "grammar_structures_used": ["string"],
  "questions": [
    {
      "id": "integer",
      "type": "string",
      "question": "string",
      "options": ["A: string", "B: string", "C: string", "D: string"],
      "correct_answer": "string (A/B/C/D)",
      "explanation": "string (max 40 words)",
      "paragraph_reference": "integer"
    }
  ]
}`;

  const raw = await callLLM<any>({
    tier: 'fast',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.75,
    taskLabel: 'ReadingEngine',
  });

  // 映射到 ReadingArticle 类型
  return {
    id: crypto.randomUUID(),
    title: raw.title,
    body: raw.body,
    wordCount: raw.word_count,
    topic: raw.topic,
    genre: raw.genre,
    cefrLevel: ucl.overallCefr,
    targetVocabulary: (raw.target_vocabulary ?? []).map((v: any) => ({
      word: v.word,
      phonetic: v.phonetic ?? '',
      cefrLevel: parseFloat(v.cefr_level) || ucl.overallCefr + 1,
      partOfSpeech: v.part_of_speech ?? 'word',
      definitionEn: v.definition_en,
      definitionZh: v.definition_zh,
      exampleSentences: [{ sentence: v.sentence_in_article, domain: interestDomain, targetWordPosition: 0, contextClues: '' }],
      wordFamily: v.word_family ?? {},
      commonCollocations: v.collocations ?? [],
      commonErrors: [],
      memoryAid: v.memory_aid ?? undefined,
    })),
    grammarStructuresUsed: raw.grammar_structures_used ?? [],
    questions: (raw.questions ?? []).map((q: any) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      paragraphReference: q.paragraph_reference,
    })),
  };
}

