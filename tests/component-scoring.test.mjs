import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const mcqItems = [{ _shouldBeSelected: true }, { _shouldBeSelected: true }, { _shouldBeSelected: false }];
const matchingItems = [
    { text: 'Berlin', _options: [{ text: 'Deutschland', _isCorrect: true }, { text: 'Frankreich', _isCorrect: false }] },
    { text: 'Paris', _options: [{ text: 'Deutschland', _isCorrect: false }, { text: 'Frankreich', _isCorrect: true }] }
];
function model(attributes, runtime = {}) {
    return Object.assign({ attributes, get: key => attributes[key] }, runtime);
}

for (const root of ['../js', '../dist/js']) {
    const scoresURL = dataURL(await readFile(new URL(`${root}/assessmentScores.js`, import.meta.url), 'utf8'));
    const source = (await readFile(new URL(`${root}/adaptHelpers.js`, import.meta.url), 'utf8'))
        .replace("'./assessmentScores.js'", JSON.stringify(scoresURL))
        .replace("'./components.js'", JSON.stringify(dataURL('export function ResultsComponent() {}')));
    const { calculateComponentScore, collectDiagnosticScores } = await import(dataURL(source));

    test(`${root}: MCQ and graphic MCQ preserve zero/partial/full and penalties`, () => {
        for (const type of ['mcq', 'gmcq']) {
            for (const [answer, score] of [[[false, false, true], 0], [[true, false, false], 1], [[true, true, false], 2], [[true, true, true], 1]]) {
                assert.deepEqual(calculateComponentScore(model({ _component: type, _items: mcqItems, _userAnswer: answer })),
                    { questionScore: score, maxScore: 2 });
            }
            assert.deepEqual(calculateComponentScore(model({ _component: type, _items: mcqItems, _userAnswer: null })),
                { questionScore: 0, maxScore: 2 });
        }
    });

    test(`${root}: genuine Adapt flattened boolean Matching vector grades 0/50/100`, () => {
        for (const [answer, score] of [[[false, true, true, false], 0], [[true, false, true, false], 1], [[true, false, false, true], 2]]) {
            assert.deepEqual(calculateComponentScore(model({ _component: 'matching', _items: matchingItems, _userAnswer: answer })),
                { questionScore: score, maxScore: 2 });
        }
        // Numeric indices are NOT the current Adapt Matching storage contract.
        assert.deepEqual(calculateComponentScore(model({ _component: 'matching', _items: matchingItems, _userAnswer: [0, 1] })),
            { questionScore: 0, maxScore: 2 });
        assert.deepEqual(calculateComponentScore(model({ _component: 'matching', _items: matchingItems })),
            { questionScore: 0, maxScore: 2 });
    });

    test(`${root}: malformed/unanswered display inputs cannot throw or create a score`, () => {
        for (const type of ['mcq', 'gmcq', 'matching', 'infai-dragndrop', 'text']) {
            assert.deepEqual(calculateComponentScore(model({ _component: type, _items: null })), { questionScore: 0, maxScore: 0 });
        }
        assert.deepEqual(calculateComponentScore(model({ _component: 'matching', _items: [{}, null] })), { questionScore: 0, maxScore: 0 });
        assert.deepEqual(calculateComponentScore(model({ _component: 'mcq', _items: mcqItems, _userAnswer: ['true', 'false', 'false'] })),
            { questionScore: 0, maxScore: 2 });
    });

    test(`${root}: textinput and slider use actual Adapt grades including partial credit`, () => {
        for (const type of ['textinput', 'slider']) {
            for (const score of [0, 0.5, 1]) {
                const question = model({ _component: type, _score: score, _isSubmitted: true }, { maxScore: 1, score: 0 });
                assert.deepEqual(calculateComponentScore(question), { questionScore: score, maxScore: 1 });
            }
            assert.deepEqual(calculateComponentScore(model({ _component: type, _score: 1, _maxScore: 1, _isSubmitted: false })),
                { questionScore: 0, maxScore: 1 });
            assert.throws(() => calculateComponentScore(model({ _component: type, _score: Infinity, _maxScore: 1 })), /Ungültige Adapt-Bewertung/);
        }
        assert.throws(() => calculateComponentScore(model({ _component: 'future-question', _isQuestionType: true })), /Nicht unterstützte Testkomponente/);
    });

    test(`${root}: repeated model IDs count once, irrelevant and disabled blocks do not contribute`, () => {
        const question = model({ _id: 'q1', _parentId: 'b1', _component: 'mcq', _items: mcqItems, _userAnswer: [true, false, false] });
        const clone = model({ ...question.attributes });
        const display = model({ _id: 'result', _parentId: 'br', _component: 'text' });
        const absent = model({ ...question.attributes, _id: 'q2', _isAvailable: false });
        const irrelevant = model({ _id: 'q3', _parentId: 'ordinary', _component: 'future-question', _isQuestionType: true });
        const disabled = model({ ...question.attributes, _id: 'q4', _parentId: 'disabled' });
        const blocks = [
            model({ _id: 'b1', _assessment: { _quizBankID: 421 } }),
            model({ _id: 'br', _assessment: { _quizBankID: 1 } }),
            model({ _id: 'ordinary' }),
            model({ _id: 'disabled', _assessment: { _quizBankID: 421, _isEnabled: false } })
        ];
        assert.deepEqual(collectDiagnosticScores([question, question, clone, display, absent, irrelevant, disabled], blocks),
            { 421: { score: 1, maxScore: 2, questionCount: 1 } });
    });
}
