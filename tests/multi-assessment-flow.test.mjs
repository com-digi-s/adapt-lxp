import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture, loadModule} from './multi-fixture.mjs';

const tick = () => new Promise(resolve => setTimeout(resolve, 15));
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
}
