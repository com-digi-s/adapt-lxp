import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
function model(attributes) { return { attributes, get: key => attributes[key] }; }

for (const root of ['../js', '../dist/js']) {
    const scoresURL = dataURL(await readFile(new URL(`${root}/assessmentScores.js`, import.meta.url), 'utf8'));
    const source = (await readFile(new URL(`${root}/adaptHelpers.js`, import.meta.url), 'utf8'))
        .replace("'./assessmentScores.js'", JSON.stringify(scoresURL))
        .replace("'./components.js'", JSON.stringify(dataURL('export function ResultsComponent() {}')));
    const { getDiagnosticResults } = await import(dataURL(source));

    test(`${root}: completion observer is idempotent and completed/restored tests report immediately`, () => {
        const old = { window: globalThis.window, document: globalThis.document, React: globalThis.React, ReactDOM: globalThis.ReactDOM };
        const listeners = new Set();
        const renders = [];
        const roots = [];
        const course = model({ _isComplete: false });
        const unrelatedObserver = () => {};
        listeners.add(unrelatedObserver);
        const question = model({ _id: 'q1', _parentId: 'b1', _component: 'matching', _userAnswer: [true, false, true, false], _items: [
            { _options: [{ _isCorrect: true }, { _isCorrect: false }] },
            { _options: [{ _isCorrect: false }, { _isCorrect: true }] }
        ] });
        const Adapt = {
            course,
            components: { models: [question] },
            blocks: { models: [model({ _id: 'b1', _assessment: { _quizBankID: 421 } })] },
            listenTo: (_model, event, listener) => { assert.equal(event, 'change:_isComplete'); listeners.add(listener); },
            stopListening: (_model, event, listener) => { assert.equal(event, 'change:_isComplete'); listeners.delete(listener); }
        };
        const frame = { contentWindow: { require: () => Adapt }, src: 'https://example.test/lxp/scos/M0/index.html', getAttribute: () => 'scos/M0/index.html' };
        globalThis.window = { App: { SCO_FRAME: frame, templates: {}, renderView: (...args) => renders.push(args) } };
        globalThis.document = { getElementById: () => frame };
        globalThis.React = { createElement: (type, props, ...children) => ({ type, props, children }) };
        globalThis.ReactDOM = { createRoot: () => ({ render: element => roots.push(element) }) };
        try {
            getDiagnosticResults();
            getDiagnosticResults();
            assert.equal(listeners.size, 2, 'one diagnostic listener plus an unrelated observer');
            for (const listener of listeners) listener();
            assert.equal(renders.length, 0, 'reset/incomplete states must never report');
            course.attributes._isComplete = true;
            for (const listener of [...listeners]) listener();
            assert.equal(renders.length, 1);
            window.App.templates.template_results({});
            assert.deepEqual(roots.at(-1).props.scorePerQuizBank, { 421: { score: 1, maxScore: 2, questionCount: 1 } });
            assert.equal(roots.at(-1).props.scoId, 'M0');
            getDiagnosticResults();
            assert.equal(renders.length, 2, 'an already completed test reports without waiting for an impossible transition');
            assert.equal(listeners.size, 2);
            assert.ok(listeners.has(unrelatedObserver));
            course.attributes._isComplete = false;
            for (const listener of listeners) listener();
            assert.equal(renders.length, 2);

            question.attributes._component = 'future-question';
            question.attributes._isQuestionType = true;
            course.attributes._isComplete = true;
            getDiagnosticResults();
            window.App.templates.template_results({});
            assert.ok(JSON.stringify(roots.at(-1)).includes('Nicht unterstützte Testkomponente'));
            assert.ok(JSON.stringify(roots.at(-1)).includes('alert'));
        } finally {
            Object.assign(globalThis, old);
        }
    });
}
