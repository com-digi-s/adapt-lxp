import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

function fixture(kind = 'matching', body = 'Original prompt') {
    const itemModels = [0, 1, 2, 3].map(index => {
        const item = new EventEmitter();
        item.attributes = { _index: index, _isActive: false };
        item.get = key => item.attributes[key];
        item.toggleActive = value => { item.attributes._isActive = value; items.emit('change'); };
        return item;
    });
    const items = new EventEmitter();
    items.models = itemModels;
    const model = new EventEmitter();
    model.attributes = { _id: 'q1', _component: kind, title: 'Question', body, _isSubmitted: false, _isComplete: false,
        _items: [{ text: 'Berlin', _options: [{ text: 'DE', _isCorrect: true }, { text: 'FR', _isCorrect: false }] },
            { text: 'Paris', _options: [{ text: 'DE', _isCorrect: false }, { text: 'FR', _isCorrect: true }] }] };
    model.get = key => model.attributes[key];
    model.getChildren = () => items;
    model.getAttemptObject = () => ({ ...model.attributes });
    model.setAttemptObject = (state, silent) => { assert.equal(silent, false); Object.assign(model.attributes, state); };
    model.restoreCount = 0;
    model.restoreUserAnswers = () => { model.restoreCount++; };
    const Adapt = new EventEmitter();
    Adapt.components = { models: [model] };
    const child = new EventEmitter();
    child.addEventListener = child.on.bind(child);
    child.document = new EventEmitter();
    child.document.addEventListener = child.document.on.bind(child.document);
    child.require = { defined: () => false };
    return { Adapt, model, items, itemModels, child };
}

function appFixture() {
    const writes = [];
    return { DATA: { 'cmi.suspend_data': { customData: {}, adaptData: {}, bookmark: 'M0' } }, SCORM_API: { set: (...args) => writes.push(args) }, writes };
}

for (const root of ['../js', '../dist/js']) {
    const source = await readFile(new URL(`${root}/corePersistence.js`, import.meta.url), 'utf8');
    const { attachCorePersistence, allowedAttemptState, nativeCourseProgress } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

    test(`${root}: native dashboard progress is finite 0/50/100 and ignores optional/unavailable content`, () => {
        const app = appFixture();
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), null);
        const records = { format: 1, components: {
            a: { required: true, state: { _isComplete: false } },
            b: { required: true, state: { _isComplete: false } },
            hiddenQuestions: { required: false, state: { _isComplete: false } }
        } };
        app.DATA['cmi.suspend_data'].customData.nativeAdapt = { M0: records };
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), 0);
        records.components.a.state._isComplete = true;
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), 0.5);
        assert.equal(nativeCourseProgress(app.DATA, 'M0', true), 1);
        records.components.b.state._isComplete = true;
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), 1);
        assert.equal(nativeCourseProgress(app.DATA, 'M0', true), 2);
        records.components = {};
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), 0);
    });

    test(`${root}: partial real-model choice state roundtrips per SCO, without grading/submitting`, () => {
        const app = appFixture();
        const first = fixture();
        const controller = attachCorePersistence(app, first.Adapt, first.child, 'M0');
        first.itemModels[0].toggleActive(true);
        first.itemModels[2].toggleActive(true);
        controller.save();
        const saved = app.DATA['cmi.suspend_data'].customData.nativeAdapt.M0;
        assert.equal(saved.format, 1);
        assert.deepEqual(saved.components.q1.active, [true, false, true, false]);
        assert.equal(saved.components.q1.state._isSubmitted, false);
        app.DATA['cmi.suspend_data'].bookmark = 'MX';
        const restored = fixture();
        attachCorePersistence(app, restored.Adapt, restored.child, 'M0');
        assert.deepEqual(restored.itemModels.map(item => item.get('_isActive')), [true, false, true, false]);
        assert.equal(restored.model.get('_isSubmitted'), false);
        assert.equal(restored.model.restoreCount, 0);
        const otherSCO = fixture();
        attachCorePersistence(app, otherSCO.Adapt, otherSCO.child, 'MX');
        assert.deepEqual(otherSCO.itemModels.map(item => item.get('_isActive')), [false, false, false, false]);
        restored.child.emit('beforeunload');
        assert.ok(app.DATA['cmi.suspend_data'].customData.nativeAdapt.M0);
        assert.equal(app.DATA['cmi.suspend_data'].customData.nativeAdapt.MX, undefined);
    });

    test(`${root}: submitted state uses native restore API and never restores changed-course answers`, () => {
        const app = appFixture();
        const first = fixture();
        const controller = attachCorePersistence(app, first.Adapt, first.child, 'M0');
        Object.assign(first.model.attributes, { _isSubmitted: true, _isComplete: true, _score: 0.5, _isCorrect: false, _userAnswer: [true, false, true, false] });
        controller.save();
        const restored = fixture();
        const same = attachCorePersistence(app, restored.Adapt, restored.child, 'M0');
        assert.equal(restored.model.restoreCount, 1);
        assert.equal(restored.model.get('_isSubmitted'), true);
        assert.equal(restored.model.get('_score'), 0.5);
        assert.deepEqual(restored.model.get('_userAnswer'), [true, false, true, false]);
        assert.equal(attachCorePersistence(app, restored.Adapt, restored.child, 'M0'), same);
        assert.equal(restored.model.restoreCount, 1);
        const changed = fixture('matching', 'Republished different prompt');
        attachCorePersistence(app, changed.Adapt, changed.child, 'M0');
        assert.equal(changed.model.get('_isSubmitted'), false);
        assert.equal(changed.model.restoreCount, 0);
    });

    test(`${root}: partial choices survive native QuestionView deferred unsubmitted-reset lifecycle`, async () => {
        const app = appFixture();
        const first = fixture();
        const controller = attachCorePersistence(app, first.Adapt, first.child, 'M0');
        first.itemModels[0].toggleActive(true);
        controller.save();
        const restored = fixture();
        attachCorePersistence(app, restored.Adapt, restored.child, 'M0');
        // Actual Core QuestionView.ensureLegacyLifecycleState defers a reset
        // after preRender. The post-render restoration must happen after it.
        setTimeout(() => restored.itemModels.forEach(item => item.toggleActive(false)), 0);
        restored.Adapt.emit('componentView:postRender', { model: restored.model });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.deepEqual(restored.itemModels.map(item=>item.get('_isActive')), [true,false,false,false]);
        assert.equal(restored.model.get('_isSubmitted'), false);
        assert.equal(restored.model.restoreCount, 0);
    });

    test(`${root}: instruction/display-title prompts and scale changes invalidate old attempts`, () => {
        for (const field of ['instruction', 'displayTitle', '_scaleStart', '_scaleEnd', '_scaleStep', '_step']) {
            const app = appFixture();
            const first = fixture('matching', '');
            first.model.attributes[field] = 'original';
            const controller = attachCorePersistence(app, first.Adapt, first.child, 'M0');
            Object.assign(first.model.attributes, { _isSubmitted: true, _isComplete: true, _score: 1 });
            controller.save();
            const changed = fixture('matching', '');
            changed.model.attributes[field] = 'changed';
            attachCorePersistence(app, changed.Adapt, changed.child, 'M0');
            assert.equal(changed.model.get('_isSubmitted'), false, field);
            assert.equal(changed.model.restoreCount, 0, field);
        }
    });

    test(`${root}: only allowlisted, finite native state can be restored`, () => {
        assert.deepEqual(allowedAttemptState({ _id: 'malicious', body: '<script>', _isSubmitted: 'true', _score: Infinity,
            _isComplete: true, _isCorrect: false, _attemptsLeft: 0, _userAnswer: [{ dangerous: true }] }),
            { _isComplete: true, _isCorrect: false, _attemptsLeft: 0 });
        assert.deepEqual(allowedAttemptState({ _userAnswer: [true, null, 'answer', 0.5], _score: 0 }),
            { _score: 0, _userAnswer: [true, null, 'answer', 0.5] });
    });

    test(`${root}: early registration waits for app:dataReady and actual Spoor takes precedence`, () => {
        const app = appFixture();
        const initial = fixture();
        initial.Adapt.components.models = [];
        const controller = attachCorePersistence(app, initial.Adapt, initial.child, 'M0');
        assert.equal(controller.mode, 'waiting');
        initial.Adapt.components.models.push(initial.model);
        initial.Adapt.emit('app:dataReady');
        assert.equal(controller.mode, 'core-local');
        const spoor = fixture();
        spoor.child.require.defined = id => id === 'extensions/adapt-contrib-spoor/js/scorm/wrapper';
        assert.equal(attachCorePersistence(app, spoor.Adapt, spoor.child, 'MX').mode, 'spoor');
        assert.equal(spoor.child.listenerCount('beforeunload'), 0);
    });
}
