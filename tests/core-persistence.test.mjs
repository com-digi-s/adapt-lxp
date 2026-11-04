import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { loadModule } from './multi-fixture.mjs';

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
    const { attachCorePersistence, allowedAttemptState, nativeCourseProgress, allSelectedCoursesComplete } = await loadModule('corePersistence', root);
    const compatibility = (scoId = 'M0') => ({ version: 1, rule: 'markledge-generated-display-v1', proofs: [{
        previousFingerprint: 'b'.repeat(64), path: `presentation-compatibility/${scoId}/${'b'.repeat(64)}.json`, sha256: 'c'.repeat(64),
        componentDisplayTitles: [{ componentId: 'q1', previousDisplayTitle: 'Question', currentDisplayTitle: '' }]
    }] });

    test(`${root}: overall completion requires every enabled selected learning course, not visited diagnostics`, () => {
        const modules = { M0: { enabled: true }, MX: { enabled: true },
            M4: { enabled: true, courses: [{id:'1',disabled:true},{id:'2',enabled:true},{id:'3',enabled:true}] },
            M1: {disabled:true,courses:[{id:'1',enabled:true}]} };
        const seen=[];
        assert.equal(allSelectedCoursesComplete(modules,id=>{seen.push(id);return id==='M4.2';}),false);
        assert.deepEqual(seen,['M4.2','M4.3']);
        assert.equal(allSelectedCoursesComplete(modules,()=>true),true);
        assert.equal(allSelectedCoursesComplete(modules,()=>false),false);
        assert.equal(allSelectedCoursesComplete({},()=>true),false);
        assert.equal(allSelectedCoursesComplete({M0:{enabled:true},MX:{enabled:true}},()=>true),false);
        const legacy={M4:{disabled:false,enabled:false,courses:[{id:'1',disabled:false,enabled:false},{id:'2',disabled:true,enabled:true}]}};
        const legacyIds=[];
        assert.equal(allSelectedCoursesComplete(legacy,id=>{legacyIds.push(id);return true;}),true);
        assert.deepEqual(legacyIds,['M4.1'],'completion uses the same disabled-authoritative contract as the existing catalogue UI');
    });

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
        records.complete = true;
        assert.equal(nativeCourseProgress(app.DATA, 'M0', false), 1, 'all-optional courses respect actual Core course completion');
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
        // A second render must never replay the immutable old load's draft.
        restored.itemModels[0].toggleActive(false);
        restored.itemModels[1].toggleActive(true);
        restored.Adapt.__lxpCorePersistence.save();
        restored.Adapt.emit('componentView:postRender', { model: restored.model });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.deepEqual(restored.itemModels.map(item=>item.get('_isActive')), [false,true,false,false]);
        // Real page re-entry snapshots the latest verified draft before Core's
        // reset, then restores that newer choice, not the previous load's choice.
        restored.Adapt.emit('componentView:preRender', { model: restored.model });
        setTimeout(() => restored.itemModels.forEach(item => item.toggleActive(false)), 0);
        restored.Adapt.emit('componentView:postRender', { model: restored.model });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.deepEqual(restored.itemModels.map(item=>item.get('_isActive')), [false,true,false,false]);
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

    test(`${root}: proven generated text heading keeps real completion and rebases only on save`, () => {
        const app = appFixture(), first = fixture('text');
        first.model.attributes.displayTitle = 'Question';
        const initial = attachCorePersistence(app, first.Adapt, first.child, 'M0');
        first.model.attributes._isComplete = true;
        first.model.attributes._isVisited = true;
        initial.save();
        const original = structuredClone(app.DATA['cmi.suspend_data'].customData.nativeAdapt.M0);
        const restored = fixture('text'); restored.model.attributes.displayTitle = '';
        const controller = attachCorePersistence(app, restored.Adapt, restored.child, 'M0', compatibility());
        assert.equal(restored.model.get('_isComplete'), true);
        assert.equal(restored.model.get('_isVisited'), true);
        assert.equal(restored.model.get('_isSubmitted'), false);
        assert.equal(restored.model.get('displayTitle'), '');
        assert.deepEqual(app.DATA['cmi.suspend_data'].customData.nativeAdapt.M0, original, 'The accepted raw native record is not rewritten during restore');
        controller.save();
        const rebased = app.DATA['cmi.suspend_data'].customData.nativeAdapt.M0.components.q1;
        assert.notEqual(rebased.fingerprint, original.components.q1.fingerprint);
        const again = fixture('text'); again.model.attributes.displayTitle = '';
        attachCorePersistence(app, again.Adapt, again.child, 'M0');
        assert.equal(again.model.get('_isComplete'), true, 'The saved current fingerprint needs no old alias');
    });

    test(`${root}: text display aliases never admit another model, prompt, title or question state`, () => {
        for (const change of [
            undefined,
            value => { value.model.attributes._component = 'matching'; },
            value => { value.model.attributes._isQuestionType = true; },
            value => { value.model.attributes._id = 'another'; },
            value => { value.model.attributes.displayTitle = 'Different title'; },
            value => { value.model.attributes.body = 'Changed actual body'; },
            value => { value.model.attributes.instruction = 'Changed actual instruction'; },
            value => { value.model.attributes.title = 'Changed retained title'; },
            value => { value.model.attributes._items[0].text = 'Changed answer'; },
            value => { value.model.attributes._questionWeight = 2; }
        ]) {
            const app = appFixture(), first = fixture('text'); first.model.attributes.displayTitle = 'Question';
            const initial = attachCorePersistence(app, first.Adapt, first.child, 'M0');
            first.model.attributes._isComplete = true; initial.save();
            const restored = fixture('text'); restored.model.attributes.displayTitle = ''; if (change) change(restored);
            // The unchanged model is the default four-argument strict path.
            attachCorePersistence(app, restored.Adapt, restored.child, 'M0', change ? compatibility() : undefined);
            assert.equal(restored.model.get('_isComplete'), false);
        }
    });

    test(`${root}: malformed or foreign core display evidence fails before model or state changes`, () => {
        for (const mutate of [value => { value.rule = 'ignore-fingerprints'; }, value => { value.proofs[0].path = 'elsewhere.json'; },
            value => { value.proofs[0].componentDisplayTitles[0].currentDisplayTitle = 'new'; }, value => { value.proofs[0].extra = true; }]) {
            const app = appFixture(), current = fixture('text'), proof = compatibility(); mutate(proof);
            const before = structuredClone(app.DATA);
            assert.throws(() => attachCorePersistence(app, current.Adapt, current.child, 'M0', proof));
            assert.equal(current.Adapt.__lxpCorePersistence, undefined); assert.deepEqual(app.DATA, before);
        }
        const current = fixture('text');
        assert.throws(() => attachCorePersistence(appFixture(), current.Adapt, current.child, 'MX', compatibility()));
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
