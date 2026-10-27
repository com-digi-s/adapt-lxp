import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sourceAt = relative => readFile(new URL(relative, import.meta.url), 'utf8');

// Fixtures follow the actual ComponentSerializer.serialize() layouts shipped
// by Adapt Spoor: identity pair, three response metadata booleans, attempt state.
// No model/API mutations are used to turn incomplete work into complete work.
const withResponses = [
    [[0, 0], [false, false, false], [[], [true, false], [[]]]], // complete display component
    [[0, 1], [true, true, false], [[0, 0], [true, true, true, false], [[false, true]]]], // submitted wrong answer
    [[1, 0], [true, true, false], [[1, 0], [true, true, true, true], [[true, false]]]],
    [[1, 1], [false, false, false], [[0, 1], [false, true, true, true], [[]]]]
];
const withoutResponses = [[[0, 0], [true]], [[0, 1], [false]], [[1, 0], [true]], [[1, 1], [false]]];

async function codec() {
    const context = { console, setTimeout, clearTimeout, atob, btoa };
    context.window = context;
    context.LZMAFactory = () => context.LZMA;
    for (const name of ['underscore.js', 'lzma_worker-min.js', 'SCORMSuspendData.js']) runInNewContext(await sourceAt(`../dist/libraries/${name}`), context);
    return { converter: context.SCORMSuspendData, lzma: context.LZMA };
}
const { converter, lzma } = await codec();
const encoded = converter.serialize(withResponses);
const compact = '#' + btoa(lzma.compress(JSON.stringify(withResponses), 1).map(value => String.fromCharCode(value + 128)).join('')).replace(/=/g, '');

for (const root of ['../js', '../dist/js']) {
    const { spoorCourseProgress } = await import(dataURL(await sourceAt(`${root}/courseProgress.js`)));

    test(`${root}: native Spoor completion counts only isComplete, never correctness or submission`, () => {
        assert.equal(spoorCourseProgress({ q: encoded }, value => converter.deserialize(value), false), 0.75);
        assert.equal(spoorCourseProgress({ q: encoded }, value => converter.deserialize(value), true), 3);
        assert.equal(spoorCourseProgress({ q: converter.serialize(withoutResponses) }, value => converter.deserialize(value), false), 0.5);
        const allComplete = withResponses.map(state => { const next = structuredClone(state); next[2][1][0] = true; return next; });
        assert.equal(spoorCourseProgress({ q: converter.serialize(allComplete) }, value => converter.deserialize(value), false), 1);
    });

    test(`${root}: actual LZMA-compressed Spoor payload uses the same native completion contract`, () => {
        assert.equal(spoorCourseProgress({ q: compact }, value => converter.deserialize(value), false), 0.75);
        assert.equal(spoorCourseProgress({ q: compact }, value => converter.deserialize(value), true), 3);
    });

    test(`${root}: malformed, unsupported, opaque and duplicate states never produce guessed progress`, () => {
        for (const suspendData of [undefined, null, '', 'opaque-binary', {}, {q:''}, {q:12}]) assert.equal(spoorCourseProgress(suspendData, () => withResponses, false), 0);
        for (const states of [[], {}, null, [null], [[1, [true]]], [[[0, 0], [true], [[], [true], [[]]]]],
            [withResponses[0], withoutResponses[0]], [withResponses[0], withResponses[0]],
            [[[0, 0], [true, true, false], [[], [1], [[]]]]], [[[0, 0], [true], [[], [true], [[]]]]]]) {
            assert.equal(spoorCourseProgress({ q: 'fixture' }, () => states, false), 0);
        }
        assert.equal(spoorCourseProgress({ q: 'unsupported' }, () => { throw new Error('Unknown encoding'); }, false), 0);
    });
}

test('source and delivered Spoor decoder are byte-identical', async () => {
    const decoder = source => source.match(/export function spoorCourseProgress[\s\S]*?\n}\n/)[0];
    assert.equal(decoder(await sourceAt('../js/courseProgress.js')), decoder(await sourceAt('../dist/js/courseProgress.js')));
});
