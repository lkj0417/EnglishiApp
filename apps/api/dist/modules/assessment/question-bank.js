"use strict";
/**
 * CAT 题库（入门测评用）
 * 每道题包含：id, skill, type, question, options, correctAnswer, difficulty（CEFR数值）, discrimination
 *
 * 正式生产版本应从数据库加载 (generated_content 表)
 * 此处内嵌约 60 道核心题目覆盖 A1-C1 范围
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUESTION_BANK = void 0;
exports.QUESTION_BANK = [
    // ─── 词汇 A1-A2 ───────────────────────────
    {
        id: 'v_a1_01',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'What is the opposite of "hot"?',
        options: ['A: warm', 'B: cold', 'C: cool', 'D: nice'],
        correctAnswer: 'B',
        difficulty: 1.0,
        discrimination: 0.8,
    },
    {
        id: 'v_a1_02',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'She goes to work by ___.',
        options: ['A: foot', 'B: car', 'C: both A and B are correct', 'D: swim'],
        correctAnswer: 'C',
        difficulty: 1.2,
        discrimination: 0.9,
    },
    {
        id: 'v_a2_01',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'The movie was very ___. I almost fell asleep.',
        options: ['A: exciting', 'B: boring', 'C: funny', 'D: scary'],
        correctAnswer: 'B',
        difficulty: 2.0,
        discrimination: 1.0,
    },
    {
        id: 'v_a2_02',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'I need to ___ my passport before traveling abroad.',
        options: ['A: renew', 'B: review', 'C: remove', 'D: replace'],
        correctAnswer: 'A',
        difficulty: 2.3,
        discrimination: 1.1,
    },
    // ─── 词汇 B1-B2 ───────────────────────────
    {
        id: 'v_b1_01',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'The new policy will significantly ___ the company\'s profits.',
        options: ['A: affect', 'B: effect', 'C: infect', 'D: defect'],
        correctAnswer: 'A',
        difficulty: 3.0,
        discrimination: 1.2,
    },
    {
        id: 'v_b1_02',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'She was ___ by the complexity of the problem and didn\'t know where to begin.',
        options: ['A: overwhelmed', 'B: overlooked', 'C: overheard', 'D: overturned'],
        correctAnswer: 'A',
        difficulty: 3.3,
        discrimination: 1.2,
    },
    {
        id: 'v_b2_01',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'Despite the ___ evidence against him, the defendant maintained his innocence.',
        options: ['A: overwhelming', 'B: overcoming', 'C: overlapping', 'D: overreaching'],
        correctAnswer: 'A',
        difficulty: 4.0,
        discrimination: 1.3,
    },
    {
        id: 'v_b2_02',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'The government\'s ___ approach to the economic crisis drew widespread criticism.',
        options: ['A: pragmatic', 'B: dramatic', 'C: diplomatic', 'D: systematic'],
        correctAnswer: 'A',
        difficulty: 4.3,
        discrimination: 1.4,
    },
    // ─── 词汇 C1 ───────────────────────────
    {
        id: 'v_c1_01',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'The researcher\'s findings ___ the widely held assumption that stress always hinders performance.',
        options: ['A: refuted', 'B: refused', 'C: confuted', 'D: rebutted'],
        correctAnswer: 'A',
        difficulty: 5.0,
        discrimination: 1.5,
    },
    {
        id: 'v_c1_02',
        skill: 'vocabulary',
        type: 'multiple_choice',
        question: 'The senator\'s speech was notable for its ___, leaving many questions deliberately unanswered.',
        options: ['A: equivocation', 'B: exaggeration', 'C: elaboration', 'D: evaluation'],
        correctAnswer: 'A',
        difficulty: 5.3,
        discrimination: 1.6,
    },
    // ─── 语法 A1-A2 ───────────────────────────
    {
        id: 'g_a1_01',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'She ___ to school every day.',
        options: ['A: go', 'B: goes', 'C: going', 'D: gone'],
        correctAnswer: 'B',
        difficulty: 1.0,
        discrimination: 0.9,
    },
    {
        id: 'g_a1_02',
        skill: 'grammar',
        type: 'multiple_choice',
        question: '___ you like some coffee?',
        options: ['A: Do', 'B: Are', 'C: Would', 'D: Have'],
        correctAnswer: 'C',
        difficulty: 1.5,
        discrimination: 1.0,
    },
    {
        id: 'g_a2_01',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'I have lived in Beijing ___ ten years.',
        options: ['A: since', 'B: for', 'C: during', 'D: from'],
        correctAnswer: 'B',
        difficulty: 2.0,
        discrimination: 1.1,
    },
    {
        id: 'g_a2_02',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'The book ___ by millions of readers worldwide.',
        options: ['A: has read', 'B: has been read', 'C: was reading', 'D: read'],
        correctAnswer: 'B',
        difficulty: 2.5,
        discrimination: 1.2,
    },
    // ─── 语法 B1-B2 ───────────────────────────
    {
        id: 'g_b1_01',
        skill: 'grammar',
        type: 'error_correction',
        question: 'Find the error: "Neither the manager nor the employees was informed about the change."',
        options: ['A: Neither...nor (should be either...or)', 'B: was (should be were)', 'C: informed (should be informing)', 'D: No error'],
        correctAnswer: 'B',
        difficulty: 3.2,
        discrimination: 1.3,
        explanation: 'With "neither...nor", the verb agrees with the nearest subject "employees" (plural), so "was" should be "were".',
    },
    {
        id: 'g_b1_02',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'If I ___ more time, I would study another language.',
        options: ['A: have', 'B: had', 'C: will have', 'D: would have'],
        correctAnswer: 'B',
        difficulty: 3.5,
        discrimination: 1.3,
    },
    {
        id: 'g_b2_01',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'By the time she arrived, everyone ___.',
        options: ['A: left', 'B: has left', 'C: had left', 'D: was leaving'],
        correctAnswer: 'C',
        difficulty: 4.0,
        discrimination: 1.4,
    },
    {
        id: 'g_b2_02',
        skill: 'grammar',
        type: 'error_correction',
        question: 'Find the error: "The research was conducting by a team of scientists at Harvard University."',
        options: ['A: was conducting (should be was conducted)', 'B: a team (should be the team)', 'C: at (should be in)', 'D: No error'],
        correctAnswer: 'A',
        difficulty: 4.2,
        discrimination: 1.4,
    },
    // ─── 语法 C1 ───────────────────────────
    {
        id: 'g_c1_01',
        skill: 'grammar',
        type: 'multiple_choice',
        question: 'Choose the most natural-sounding sentence for formal writing:',
        options: [
            'A: Not only did the study confirm our hypothesis, but it also revealed unexpected findings.',
            'B: The study not only confirmed our hypothesis, but also it revealed unexpected findings.',
            'C: The study confirmed our hypothesis, and also revealed not only unexpected findings.',
            'D: Only not did the study confirm our hypothesis, it also revealed unexpected findings.',
        ],
        correctAnswer: 'A',
        difficulty: 5.0,
        discrimination: 1.5,
        explanation: 'Option A correctly uses inverted word order after "Not only" at the start of a sentence.',
    },
    // ─── 阅读 A2 ───────────────────────────
    {
        id: 'r_a2_01',
        skill: 'reading',
        type: 'multiple_choice',
        question: `Read the text and answer:
    
"The library opens at 9 am on weekdays and at 10 am on weekends. It closes at 6 pm every day except Friday, when it stays open until 9 pm."

What time does the library close on Friday?`,
        options: ['A: 6:00 pm', 'B: 9:00 pm', 'C: 10:00 pm', 'D: 9:00 am'],
        correctAnswer: 'B',
        difficulty: 2.0,
        discrimination: 1.0,
    },
    // ─── 阅读 B1 ───────────────────────────
    {
        id: 'r_b1_01',
        skill: 'reading',
        type: 'multiple_choice',
        question: `Read the text and answer:

"While social media platforms have undeniably connected people across the globe, critics argue that the quality of these connections is often superficial. Users tend to present idealized versions of themselves, leading to unrealistic comparisons and, consequently, feelings of inadequacy among those who perceive others' lives as more fulfilling than their own."

What does the author suggest about social media connections?`,
        options: [
            'A: They are entirely negative and should be avoided.',
            'B: They are generally deep and meaningful.',
            'C: They connect people but may lack depth and cause negative comparisons.',
            'D: They cause people to be more honest about their lives.',
        ],
        correctAnswer: 'C',
        difficulty: 3.0,
        discrimination: 1.2,
    },
    // ─── 阅读 B2 ───────────────────────────
    {
        id: 'r_b2_01',
        skill: 'reading',
        type: 'multiple_choice',
        question: `Read the text and answer:

"The concept of 'nudge theory', popularized by Thaler and Sunstein, proposes that subtle environmental cues can guide individuals towards better decisions without restricting their freedom of choice. Unlike traditional policy interventions, nudges operate by redesigning the context in which decisions are made. For instance, placing healthier food options at eye level in cafeterias has been shown to increase their consumption without banning less healthy alternatives."

What is the key difference between nudges and traditional policy interventions?`,
        options: [
            'A: Nudges are more expensive to implement.',
            'B: Nudges guide behavior without limiting choice, while traditional interventions often restrict options.',
            'C: Traditional interventions focus on environmental cues.',
            'D: Nudges are only effective in cafeteria settings.',
        ],
        correctAnswer: 'B',
        difficulty: 4.0,
        discrimination: 1.4,
    },
    // ─── 阅读 C1 ───────────────────────────
    {
        id: 'r_c1_01',
        skill: 'reading',
        type: 'multiple_choice',
        question: `Read the text and infer:

"Recent scholarship has challenged the long-held assumption that language acquisition is primarily a function of explicit instruction. Proponents of implicit learning theories contend that exposure to authentic linguistic input, particularly when embedded in meaningful communicative contexts, yields more durable and flexible language competence than rule-based pedagogy alone."

What can be inferred about the author's position on language teaching?`,
        options: [
            'A: The author believes explicit grammar instruction is completely ineffective.',
            'B: The author suggests meaningful input may be more important than grammar rules alone.',
            'C: The author argues that all language learning should be implicit.',
            'D: The author supports a purely rule-based approach to teaching.',
        ],
        correctAnswer: 'B',
        difficulty: 5.0,
        discrimination: 1.5,
    },
    // ─── 听力模拟（文字呈现形式，正式版应含音频）───
    {
        id: 'l_a2_01',
        skill: 'listening',
        type: 'multiple_choice',
        question: `[Listen to the conversation transcript]

Man: "Excuse me, what time does the next train to London leave?"
Woman: "The 3:45 has just left. The next one is at 4:20."
Man: "And how long does it take?"
Woman: "About two hours."

When does the next train leave?`,
        options: ['A: 3:45', 'B: 4:00', 'C: 4:20', 'D: 4:25'],
        correctAnswer: 'C',
        difficulty: 2.0,
        discrimination: 1.0,
    },
    {
        id: 'l_b1_01',
        skill: 'listening',
        type: 'multiple_choice',
        question: `[Listen to the conversation transcript]

Interviewer: "Why did you leave your previous job?"
Candidate: "Well, I learned a great deal there, and I'm genuinely grateful for the opportunities I had. But after five years, I felt I had reached a ceiling in terms of professional growth. I was looking for a role that would challenge me more and allow me to develop new skills in a larger organization."

What is the main reason the candidate left their previous job?`,
        options: [
            'A: They had a conflict with their manager.',
            'B: They felt there was no more room for professional development.',
            'C: The salary was too low.',
            'D: They wanted to work in a smaller company.',
        ],
        correctAnswer: 'B',
        difficulty: 3.2,
        discrimination: 1.3,
    },
    {
        id: 'l_b2_01',
        skill: 'listening',
        type: 'multiple_choice',
        question: `[Academic lecture transcript excerpt]

"...and this brings us to the central paradox of economic growth. While GDP expansion has historically correlated with improvements in living standards, mounting evidence suggests that beyond a certain threshold—typically around $75,000 annual income in developed economies—additional wealth contributes marginally to subjective well-being. This phenomenon, often referred to as the Easterlin Paradox, challenges the fundamental assumption that more is always better..."

What is the Easterlin Paradox as described in the lecture?`,
        options: [
            'A: GDP growth always improves happiness.',
            'B: Beyond a certain income level, more wealth has diminishing returns on well-being.',
            'C: People in developing economies are happier than those in developed ones.',
            'D: Economic growth and GDP are not related.',
        ],
        correctAnswer: 'B',
        difficulty: 4.2,
        discrimination: 1.4,
    },
];
//# sourceMappingURL=question-bank.js.map