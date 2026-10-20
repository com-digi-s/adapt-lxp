import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function loadModule(path) {
    return import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64'));
}

for (const root of ['../js', '../dist/js']) {
    const helpers = await loadModule(`${root}/assessmentScores.js`);
    const { addQuizBankScore, aggregateQuizBankScores, assessmentPercentage } = helpers;
    test(`${root}: zero, half and full scores remain valid 0/50/100 percentages`, () => {
        for (const score of [0, 1, 2]) assert.equal(assessmentPercentage(score, 2), score * 50);
        assert.equal(assessmentPercentage(-1, 2), 0);
        assert.equal(assessmentPercentage(3, 2), 100);
    });

    test(`${root}: text/result blocks and invalid scores never create phantom banks`, () => {
        const banks = {};
        assert.equal(addQuizBankScore(banks, 1, 0, 0), false);
        for (const [score, max] of [[NaN, 1], [Infinity, 1], [1, Infinity], [1, -1], ['1', 1], [0, 0]]) {
            assert.equal(addQuizBankScore(banks, 421, score, max), false);
            assert.equal(assessmentPercentage(score, max), null);
        }
        for (const id of [undefined, null, {}, '__proto__', 'constructor', ' ']) assert.equal(addQuizBankScore(banks, id, 1, 1), false);
        assert.deepEqual(banks, {});
    });

    test(`${root}: all real questions including the first count once per update`, () => {
        const banks = {};
        addQuizBankScore(banks, 421, 1, 2);
        assert.equal(banks[421].questionCount, 1);
        addQuizBankScore(banks, '421', 2, 2);
        addQuizBankScore(banks, 1, 0, 0);
        assert.deepEqual(banks, { 421: { score: 3, maxScore: 4, questionCount: 2 } });
        const groups = aggregateQuizBankScores(banks, { M4: { label: 'Sicherheit' } });
        assert.deepEqual(groups.moduleScores, { 4: { score: 3, maxScore: 4 } });
        assert.deepEqual(groups.domainScores, { 1: { score: 3, maxScore: 4 } });
        assert.deepEqual(groups.unmappedQuizBanks, []);
    });

    test(`${root}: legacy contaminated banks cannot poison report totals`, () => {
        const groups = aggregateQuizBankScores({
            1: { score: 0, maxScore: 0 },
            421: { score: 1, maxScore: 2 },
            422: { score: 2, maxScore: 2 },
            431: { score: NaN, maxScore: 1 },
            432: { score: 0, maxScore: Infinity },
            garbage: null
        }, { M1: {}, M4: {} });
        assert.deepEqual(groups.moduleScores, { 4: { score: 3, maxScore: 4 } });
        assert.deepEqual(groups.domainScores, { 1: { score: 1, maxScore: 2 }, 2: { score: 2, maxScore: 2 } });
        assert.deepEqual(groups.unmappedQuizBanks, []);
    });

    test(`${root}: unknown/future identifiers require explicit mapping, not invented modules`, () => {
        const groups = aggregateQuizBankScores({
            'DigComp5.1': { score: 1, maxScore: 1 },
            AILit111: { score: 1, maxScore: 1 },
            611: { score: 1, maxScore: 1 }
        }, { M4: {} });
        assert.deepEqual(groups.moduleScores, {});
        assert.deepEqual(groups.domainScores, {});
        assert.deepEqual(new Set(groups.unmappedQuizBanks), new Set(['DigComp5.1', 'AILit111', '611']));
    });
}

test('shared source and delivered scoring helper are byte-identical', async () => {
    assert.equal(await readFile(new URL('../js/assessmentScores.js', import.meta.url), 'utf8'),
        await readFile(new URL('../dist/js/assessmentScores.js', import.meta.url), 'utf8'));
});

test('delivered React result report emits only genuine module/domain values, never NaN', async () => {
    const scoresSource = await readFile(new URL('../dist/js/assessmentScores.js', import.meta.url), 'utf8');
    const scoresURL = 'data:text/javascript;base64,' + Buffer.from(scoresSource).toString('base64');
    const componentSource = (await readFile(new URL('../dist/js/components.js', import.meta.url), 'utf8'))
        .replace("'./assessmentScores.js'", JSON.stringify(scoresURL));
    const old = { React: globalThis.React, window: globalThis.window, Image: globalThis.Image };
    const reports = [];
    globalThis.React = {
        Component: function Component(props) { this.props = props; },
        createElement: (...args) => args
    };
    globalThis.window = {
        CONF: { SCOS: { M1: { label: 'Must not appear' }, M4: { label: 'Sicherheit' } } },
        App: { SCORM_API: { data: { get: () => 'Test' } } },
        jspdf: { jsPDF: function PDF() {
            const texts = [];
            this.text = (value) => texts.push(value);
            this.setFontSize = this.rect = this.addImage = () => {};
            this.save = () => reports.push(texts);
        } }
    };
    globalThis.Image = class {
        width = 100;
        height = 100;
        set src(value) { this.onload(); }
    };
    try {
        const { ResultsComponent } = await import('data:text/javascript;base64,' + Buffer.from(componentSource).toString('base64'));
        for (const score of [0, 1, 2]) {
            const component = new ResultsComponent({ scoId: 'M0', scorePerQuizBank: {
                1: { score: 0, maxScore: 0 },
                421: { score, maxScore: 2 }
            } });
            component.componentDidMount();
            await new Promise(resolve => setImmediate(resolve));
            const texts = reports.at(-1);
            assert.ok(texts.includes(`${score * 50}.0%`));
            assert.ok(texts.includes('Modul 4'));
            assert.ok(!texts.includes('Modul 1'));
            assert.ok(!texts.join(' ').includes('NaN'));
        }
        const unknown = new ResultsComponent({ scorePerQuizBank: { 'future-format': { score: 1, maxScore: 1 } } });
        unknown.componentDidMount();
        assert.ok(JSON.stringify(unknown.render()).includes('Ergebnisbericht nicht verfügbar'));
        const empty = new ResultsComponent({ scorePerQuizBank: { 1: { score: 0, maxScore: 0 } } });
        empty.componentDidMount();
        assert.ok(JSON.stringify(empty.render()).includes('keine auswertbaren Testfragen'));
        assert.equal(reports.length, 3);
    } finally {
        Object.assign(globalThis, old);
    }
});
