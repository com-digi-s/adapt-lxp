import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture, loadModule} from './multi-fixture.mjs';

const tick = () => new Promise(resolve => setTimeout(resolve, 15));
function launchDocument() {
    const doc = { documentElement: { lang: 'de', style: {} }, body: { style: {}, append() {} } };
    doc.createElement = tag => {
        const element = { tagName: tag, attributes: {}, style: {}, children: [], listeners: {}, setAttribute(key, value) { this.attributes[key] = String(value); }, addEventListener(type, action) { this.listeners[type] = action; }, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } };
        if (tag === 'iframe') { element.contentDocument = launchDocument(); element.contentWindow = { document: element.contentDocument }; }
        return element;
    };
    return doc;
}
for (const root of ['../js', '../dist/js']) {
    const {MultiFrameworkApp} = await loadModule('multiFramework', root);
    function appFixture() {
        const app = Object.create(MultiFrameworkApp.prototype), calls = [];
        const context = Object.freeze({launchId:'actual-launch', scoId:'test-dig', frameworkId:'fw-dig', assessmentId:'as-dig', attemptId:'attempt-1', role:'entry'});
        const result = {attemptId:'attempt-1', completed:true, score:0, maxScore:1};
        app.activeContext = context; app.controllers = new Map([[context.launchId, {save:()=>calls.push('native-save')}]]);
        app.calculateResult = () => { calls.push('calculate'); return result; };
        app.showResult = value => calls.push(['report', value]);
        app.warn = message => calls.push(['warning', message]);
        return {app, context, result, calls};
    }
    test(root+': submitted test opens its report after native flush, without another user action', async () => {
        const {app, context, result, calls} = appFixture();
        app.scheduleAssessmentResult({}, context); app.scheduleAssessmentResult({}, context);
        assert.deepEqual(calls, [], 'The native SubmitAll event stack is not interrupted');
        await tick();
        assert.deepEqual(calls, ['native-save', 'calculate', ['report', result]]);
        assert.equal(app.pendingAssessmentResult, null);
    });
    test(root+': late or abandoned test completion cannot replace another framework view', async () => {
        const {app, context, calls} = appFixture();
        app.scheduleAssessmentResult({}, context); app.activeContext = {...context, launchId:'different-course', frameworkId:'fw-ai'};
        await tick(); assert.deepEqual(calls, []);
        app.scheduleAssessmentResult({}, context); await tick(); assert.deepEqual(calls, []);
        app.activeContext = context; app.scheduleAssessmentResult({}, context); app.closed = true;
        await tick(); assert.deepEqual(calls, []);
    });
    test(root+': invalid native completion remains an error, never a fabricated report', async () => {
        const {app, context, calls} = appFixture();
        app.calculateResult = () => { throw Error('Required native answer missing'); };
        app.scheduleAssessmentResult({}, context); await tick();
        assert.deepEqual(calls, ['native-save', ['warning', 'Required native answer missing']]);
    });
    test(root+': reopening the completed active attempt shows its existing result without restarting the SCO', () => {
        const contract = fixture(), sco = {...contract.scos[0], id:'test-dig', role:'entry'};
        const app = Object.create(MultiFrameworkApp.prototype), result = {attemptId:'actual-attempt', frameworkId:sco.frameworkId, completed:true, score:0, maxScore:2}, seen = [];
        app.catalog = {scos:new Map([[sco.id, sco]])};
        app.contract = {assessments:[{id:'as-dig', frameworkId:sco.frameworkId, scoId:sco.id}]};
        app.state = {scoStates:{[sco.id]:{activeAttemptId:result.attemptId}}, frameworkBookmarks:{}, assessmentAttempts:{[sco.frameworkId]:{'as-dig':{[result.attemptId]:result}}}};
        app.showResult = value => seen.push(value); app.closeCourse = () => { throw Error('Fresh native launch'); };
        assert.equal(app.launchSCO(sco.id), null); assert.deepEqual(seen, [result]);
        assert.throws(()=>app.launchSCO(sco.id, null, {newAttempt:true}), /Fresh native launch/);
        assert.deepEqual(seen, [result], 'A deliberate new attempt is not replaced by an old result');
        assert.equal(app.state.scoStates[sco.id].activeAttemptId, result.attemptId);
    });
    test(root+': explicit answer review launches only the existing completed attempt and returns to that report', () => {
        const contract = fixture(), sco = {...contract.scos[0], id:'test-dig', role:'entry'}, app = Object.create(MultiFrameworkApp.prototype), seen = [];
        const result = {attemptId:'actual-attempt', frameworkId:sco.frameworkId, completed:true, score:0, maxScore:2};
        const record = {frameworkId:sco.frameworkId, activeAttemptId:result.attemptId, payload:'actual-native-suspend-data', values:{}, native:null};
        app.catalog = {scos:new Map([[sco.id, sco]])};app.contract = {assessments:[{id:'as-dig', frameworkId:sco.frameworkId, scoId:sco.id}]};
        app.state = {scoStates:{[sco.id]:record}, frameworkBookmarks:{}, assessmentAttempts:{[sco.frameworkId]:{'as-dig':{[result.attemptId]:result}}}};
        app.showResult = value => seen.push(value);app.closeCourse = ()=>{};app.resetContent = ()=>{};app.updateNavigation = ()=>{};app.save = ()=>true;app.contexts = new WeakMap();app.launchRecords = new Map();
        const previous = globalThis.document, doc = launchDocument();globalThis.document = doc;
        try {
            app.content = doc.createElement('section');app.courseArea = doc.createElement('section');app.dashboardFrame = doc.createElement('iframe');
            const context = app.launchSCO(sco.id, undefined, {review:true});
            assert.equal(context.review, true);assert.equal(context.attemptId, result.attemptId);assert.ok(Object.isFrozen(context));assert.deepEqual(seen, []);
            assert.equal(app.state.scoStates[sco.id], record);assert.equal(record.payload, 'actual-native-suspend-data');assert.equal(app.state.assessmentAttempts[sco.frameworkId]['as-dig'][result.attemptId], result);
            const toolbar = app.courseArea.children[0], control = toolbar.children[0];assert.equal(control.attributes['data-action'], 'review-result');assert.equal(control.textContent, 'Zurück zum Ergebnisbericht');control.listeners.click();assert.deepEqual(seen, [result]);
            assert.throws(()=>app.launchSCO(sco.id, undefined, {review:true, newAttempt:true}), /zuletzt abgeschlossenen Testversuch/);
            result.completed = false;assert.throws(()=>app.launchSCO(sco.id, undefined, {review:true}), /zuletzt abgeschlossenen Testversuch/);
        } finally { globalThis.document = previous; }
    });
    test(root+': reviewing submitted native answers never recalculates or automatically redirects', async () => {
        const contract = fixture(), sco = {...contract.scos[0], id:'test-dig', role:'entry'}, app = Object.create(MultiFrameworkApp.prototype), calls = [];
        const context = Object.freeze({scoId:sco.id, frameworkId:sco.frameworkId, role:'entry', assessmentId:'as-dig', launchId:'review-launch', attemptId:'actual-attempt', review:true});
        const child = {require:Object.assign(()=>{}, {defined:()=>true})}, courseListeners = {}, Adapt = {on(){}, course:{get:()=>true, on:(event, listener)=>{courseListeners[event]=listener;}}, components:{models:[{}]}};
        app.catalog={scos:new Map([[sco.id,sco]])};app.state={scoStates:{[sco.id]:{frameworkId:sco.frameworkId, payload:'submitted-native-payload', values:{}, native:null}}};app.contexts=new WeakMap([[child,context]]);app.controllers=new Map();app.activeContext=context;app.save=()=>{calls.push('save');return true;};app.calculateResult=()=>{calls.push('calculate');throw Error('Unexpected regrading');};app.showResult=()=>calls.push('report');app.warn=message=>calls.push(message);
        app.attachAdaptPersistence(Adapt, child);courseListeners['change:_isComplete']();app.scheduleAssessmentResult(Adapt, context);await tick();
        assert.deepEqual(calls,['save','save']);assert.equal(app.pendingAssessmentResult,undefined);assert.equal(app.state.scoStates[sco.id].payload,'submitted-native-payload');
    });
}
