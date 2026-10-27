import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sourceAt = relative => readFile(new URL(relative, import.meta.url), 'utf8');
const catalogue = () => ({ M0: {}, AILit: { courses: [{ id: '1', launchFile: 'index_lms.html' }, { id: '2', launchFile: 'course/start.html?lang=de#overview' }] }, Legacy: { courses: [{ id: '1' }] } });
const parentHref = 'https://example.test/lxp/index_lms.html';

async function appClass(root) {
    let source = await sourceAt(`${root}/app.js`);
    const stubs = {
        './adaptHelpers.js': 'export const ignored=true;',
        '../libraries/jquery-2.2.4.min.js': 'export const ignored=true;',
        './utils.js': 'export function timeIntToString(){}',
        './components.js': 'export function GlossaryDropdown(){} export function CoursePathway(){} export function Card(){} export function CollapsibleCard(){} export function CourseStats(){} export function XP(){}',
        './charts.js': 'export function pulseChart(){} export function radarChart(){}'
    };
    for (const name of ['scormBridge', 'corePersistence', 'courseProgress', 'scoLaunch']) stubs[`./${name}.js`] = await sourceAt(`${root}/${name}.js`);
    for (const [specifier, stub] of Object.entries(stubs)) source = source.replace(`'${specifier}'`, JSON.stringify(dataURL(stub)));
    return (await import(dataURL(source))).App;
}

for (const root of ['../js', '../dist/js']) {
    const { scoLaunchPath, scoIdForLaunch, validatedLaunchFile } = await import(dataURL(await sourceAt(`${root}/scoLaunch.js`)));

    test(`${root}: manifest-derived native LMS entry and legacy index remain distinct`, () => {
        assert.equal(scoLaunchPath(catalogue(), 'AILit.1'), 'scos/AILit/1/index_lms.html');
        assert.equal(scoLaunchPath(catalogue(), 'Legacy.1'), 'scos/Legacy/1/index.html');
        assert.equal(scoLaunchPath(catalogue(), 'M0'), 'scos/M0/index.html');
        assert.equal(scoLaunchPath(catalogue(), 'AILit.2'), 'scos/AILit/2/course/start.html?lang=de#overview');
        assert.equal(scoLaunchPath(catalogue(), 'AILit.2', '/id/page1'), 'scos/AILit/2/course/start.html?lang=de#/id/page1');
        assert.equal(scoLaunchPath(catalogue(), 'AILit.2', '#/id/page2'), 'scos/AILit/2/course/start.html?lang=de#/id/page2');
    });

    test(`${root}: launch files cannot escape the SCO package or navigate to another origin`, () => {
        for (const value of ['', null, 7, '../index.html', 'a/../index.html', './index.html', '/index.html', '//evil.test/x', 'https://evil.test/x', 'javascript:alert(1)', 'file:///tmp/x', 'a\\index.html', 'a/%2e%2e/index.html', '%2findex.html', '%5cindex.html', '%252e%252e/index.html', 'index.html\n', '%', '?lang=de']) {
            assert.throws(() => validatedLaunchFile(value), /Invalid SCO launchFile/, String(value));
        }
        assert.equal(validatedLaunchFile('nested/start.html?lang=de#overview'), 'nested/start.html?lang=de#overview');
        assert.throws(() => scoLaunchPath(catalogue(), '../AILit.1'), /Invalid SCO identity/);
        assert.throws(() => scoLaunchPath(catalogue(), 'AILit.999'), /Unknown SCO identity/);
    });

    test(`${root}: immutable context follows exact configured launch URL, never bookmark or basename`, () => {
        assert.equal(scoIdForLaunch(catalogue(), 'https://example.test/lxp/scos/AILit/2/course/start.html?lang=de#/id/page2', parentHref), 'AILit.2');
        assert.equal(scoIdForLaunch(catalogue(), 'https://example.test/lxp/scos/Legacy/1/index.html#/id/page1', parentHref), 'Legacy.1');
        assert.throws(() => scoIdForLaunch(catalogue(), 'https://evil.test/lxp/scos/AILit/1/index_lms.html', parentHref), /Cannot identify/);
        assert.throws(() => scoIdForLaunch(catalogue(), 'https://example.test/lxp/scos/AILit/1/index.html', parentHref), /Cannot identify/);
        assert.throws(() => scoIdForLaunch(catalogue(), 'https://example.test/lxp/scos/AILit/2/course/start.html?lang=en', parentHref), /Cannot identify/);
    });

    // App source contains JSX; browser delivery is the compiled dist module.
    if (root !== '../dist/js') continue;
    const App = await appClass(root);

    test(`${root}: bridge is installed before navigating to manifest entry; external API is preserved`, () => {
        const previousWindow = globalThis.window;
        const calls = [];
        globalThis.window = { CONF: { SCOS: catalogue() }, location: { href: parentHref } };
        const app = Object.create(App.prototype);
        app.DATA = { 'cmi.suspend_data': { bookmark: 'M0', adaptData: {}, customData: {} } };
        app.SCORM_API = { get: () => 0, set: () => {}, save: () => {} };
        app.SCO_FRAME = { setAttribute: (name, value) => {
            assert.ok(window.API, 'an API must exist before native Spoor initializes');
            calls.push([name, value]);
        } };
        try {
            app.launchSCO('AILit.1', '/id/page1');
            assert.equal(window.API.__adaptLXPBridge, true);
            assert.deepEqual(calls.at(-1), ['src', 'scos/AILit/1/index_lms.html#/id/page1']);
            const external = { LMSInitialize: () => 'true' };
            window.API = external;
            app.launchSCO('Legacy.1');
            assert.equal(window.API, external);
            assert.deepEqual(calls.at(-1), ['src', 'scos/Legacy/1/index.html']);
            window.CONF.SCOS.AILit.courses[0].launchFile = '../escape.html';
            const bookmark = app.DATA['cmi.suspend_data'].bookmark;
            assert.throws(() => app.launchSCO('AILit.1'), /Invalid SCO launchFile/);
            assert.equal(app.DATA['cmi.suspend_data'].bookmark, bookmark);
            assert.equal(calls.length, 2, 'invalid launch must not navigate');
        } finally { globalThis.window = previousWindow; }
    });

    test(`${root}: alternate entry keeps Core-only state isolated after bookmark changes; Spoor owns native restore`, () => {
        const previousWindow = globalThis.window;
        globalThis.window = { CONF: { SCOS: catalogue() }, location: { href: parentHref } };
        const app = Object.create(App.prototype);
        app.DATA = { 'cmi.suspend_data': { bookmark: 'AILit.1', adaptData: {}, customData: {} } };
        app.SCORM_API = { set: () => {} };
        const model = new EventEmitter();
        const attributes = { _id: 'text1', _component: 'text', _isComplete: true, _items: [] };
        model.get = key => attributes[key];
        model.getAttemptObject = () => attributes;
        model.setAttemptObject = () => { throw Error('No saved state exists'); };
        const Adapt = new EventEmitter();
        Adapt.components = { models: [model] };
        const child = new EventEmitter();
        child.location = { href: 'https://example.test/lxp/scos/AILit/2/course/start.html?lang=de#/id/page1' };
        child.addEventListener = child.on.bind(child);
        child.document = new EventEmitter();
        child.document.addEventListener = child.document.on.bind(child.document);
        child.require = { defined: () => false };
        try {
            const core = app.attachAdaptPersistence(Adapt, child);
            assert.equal(core.mode, 'core-local');
            app.DATA['cmi.suspend_data'].bookmark = 'AILit.1';
            core.save();
            assert.equal(app.DATA['cmi.suspend_data'].customData.nativeAdapt['AILit.2'].components.text1.state._isComplete, true);
            assert.equal(app.DATA['cmi.suspend_data'].customData.nativeAdapt['AILit.1'], undefined);
            const native = new EventEmitter();
            native.components = { models: [model] };
            child.require = { defined: name => name === 'extensions/adapt-contrib-spoor/js/scorm/wrapper' };
            assert.equal(app.attachAdaptPersistence(native, child).mode, 'spoor');
        } finally { globalThis.window = previousWindow; }
    });
}
