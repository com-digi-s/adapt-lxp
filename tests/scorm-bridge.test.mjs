import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

function appFixture() {
    const writes = [];
    const app = {
        DATA: { 'cmi.suspend_data': { bookmark: 'M0', adaptData: {}, customData: {} } },
        SCORM_API: { get: key => key === 'cmi.core.student_name' ? 'Testperson' : '', set: (...args) => writes.push(args), save: () => writes.push(['save']) }
    };
    return { app, writes };
}

for (const root of ['../js', '../dist/js']) {
    const source = await readFile(new URL(`${root}/scormBridge.js`, import.meta.url), 'utf8');
    const { createSCOBridge, installSCOBridge } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    test(`${root}: actual API writes return SCORM string success and preserve per-SCO state`, () => {
        const { app, writes } = appFixture();
        const first = createSCOBridge(app, 'M0');
        assert.equal(first.LMSInitialize(''), 'true');
        assert.equal(first.LMSSetValue('cmi.suspend_data', '{"q":"first"}'), 'true');
        assert.equal(first.LMSSetValue('cmi.core.lesson_status', 'completed'), 'true');
        assert.equal(first.LMSSetValue('cmi.core.score.raw', '50'), 'true');
        app.DATA['cmi.suspend_data'].bookmark = 'MX';
        const second = createSCOBridge(app, 'MX');
        assert.equal(second.LMSGetValue('cmi.core.lesson_status'), 'not attempted');
        assert.equal(second.LMSSetValue('cmi.suspend_data', '{"q":"second"}'), 'true');
        assert.equal(first.LMSSetValue('cmi.suspend_data', '{"q":"late-unload-first"}'), 'true');
        assert.equal(first.LMSGetValue('cmi.suspend_data'), '{"q":"late-unload-first"}');
        assert.equal(second.LMSGetValue('cmi.suspend_data'), '{"q":"second"}');
        assert.equal(first.LMSGetValue('cmi.core.lesson_status'), 'completed');
        assert.equal(first.LMSGetValue('cmi.core.score.raw'), '50');
        assert.equal(first.LMSGetValue('cmi.core.student_name'), 'Testperson');
        assert.equal(first.LMSSetValue('cmi.interactions.0.id', 'question'), 'true');
        assert.deepEqual(writes.at(-1), ['cmi.interactions.0.id', 'M0#question']);
        assert.equal(first.LMSCommit(''), 'true');
        assert.equal(first.LMSFinish(''), 'true');
        assert.equal(first.LMSGetLastError(), '0');
        assert.ok(!writes.some(([key]) => key === 'cmi.core.lesson_status'), 'child completion must not prematurely complete the whole LXP');
    });

    test(`${root}: opaque suspend encodings roundtrip and persistence errors return false`, () => {
        const { app } = appFixture();
        const bridge = createSCOBridge(app, 'M4.2');
        for (const value of ['opaque-binary-value', '', '0', 'null']) {
            assert.equal(bridge.LMSSetValue('cmi.suspend_data', value), 'true');
            assert.equal(bridge.LMSGetValue('cmi.suspend_data'), value);
        }
        app.SCORM_API.set = () => { throw new Error('disk full'); };
        assert.equal(bridge.LMSSetValue('cmi.core.lesson_status', 'completed'), 'false');
        assert.equal(bridge.LMSGetLastError(), '101');
    });

    test(`${root}: early parent bridge installs only on own window, preserves real external API`, () => {
        const { app } = appFixture();
        const external = { LMSInitialize: () => 'true' };
        const parent = { API: external };
        const own = { parent };
        const initial = installSCOBridge(app, 'M0', own);
        assert.equal(own.API, initial);
        const next = installSCOBridge(app, 'MX', own);
        assert.equal(own.API, next);
        assert.equal(parent.API, external);
        own.API = external;
        const uninstalled = installSCOBridge(app, 'M0', own);
        assert.equal(own.API, external);
        assert.notEqual(uninstalled, external);
    });
}
