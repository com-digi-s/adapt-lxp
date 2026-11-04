import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, loadModule } from './multi-fixture.mjs';

for (const root of ['../js', '../dist/js']) {
    const { MultiFrameworkApp } = await loadModule('multiFramework', root);
    const { validateContract } = await loadModule('multiContract', root);
    const { createState } = await loadModule('multiState', root);
    const { createBridge, scoRecord } = await loadModule('multiBridge', root);

    function application() {
        const contract = fixture(), events = [], app = Object.create(MultiFrameworkApp.prototype);
        Object.assign(app, {
            contract, catalog: validateContract(contract), state: createState(contract),
            contexts: new WeakMap(), controllers: new Map(), launchRecords: new Map(),
            courseArea: { hidden: false }, dashboardFrame: { hidden: true },
            transport: { get: () => '', finish: () => { events.push('outer-finish'); return true; } },
            save: () => { events.push('outer-save'); return true; },
            bindLearningLinks() {}, warn: message => { throw Error(message); }
        });
        const removeController = app.controllers.delete.bind(app.controllers);
        app.controllers.delete = launchId => { events.push('controller-delete:' + launchId); return removeController(launchId); };
        function launch(launchId) {
            const context = Object.freeze({ scoId: 'opaque-dig', frameworkId: 'fw-dig', role: 'learning', launchId });
            const listeners = {}, child = {
                location: { hash: '#/id/page-' + launchId },
                addEventListener: (name, callback) => { listeners[name] = callback; }
            };
            const frame = { contentWindow: child, isConnected: true };
            const Adapt = { windowTree: child };
            const controller = { Adapt, mode: 'spoor', save: () => events.push('native-save:' + launchId) };
            const record = scoRecord(app, context);
            app.launchRecords.set(launchId, record);
            app.contexts.set(child, context);
            app.controllers.set(launchId, controller);
            app.activeContext = context; app.SCO_FRAME = frame;
            app.state.frameworkBookmarks[context.frameworkId] = { scoId: context.scoId, contentId: 'page-' + launchId };
            app.launchHost = {
                remove() {
                    events.push('host-remove:' + launchId);
                    assert.equal(app.controllers.get(launchId), controller, 'Native unload still has its bound controller');
                    frame.isConnected = false;
                    listeners.beforeunload?.();
                }
            };
            app.bindChild(frame, context);
            return { context, child, frame, Adapt, controller, record, listeners, bridge: createBridge(app, context) };
        }
        return { app, events, launch };
    }

    test(root + ': closing flushes native state before host removal and releases only that controller afterward', () => {
        const { app, events, launch } = application(), active = launch('closing');
        const unrelated = { Adapt: { unrelated: true } };
        app.controllers.set('unrelated-launch', unrelated);
        app.learningSession = { scoId: active.context.scoId };
        app.closeCourse();
        assert.deepEqual(events, [
            'native-save:closing', 'outer-save', 'host-remove:closing',
            'native-save:closing', 'outer-save', 'controller-delete:closing'
        ]);
        assert.equal(app.controllers.has('closing'), false);
        assert.equal(app.controllers.get('unrelated-launch'), unrelated, 'Do not clear another launch while retiring this one');
        assert.equal(app.launchRecords.get('closing'), active.record, 'An immutable old bridge retains its own record');
        assert.equal(app.launchHost, null); assert.equal(app.SCO_FRAME, null); assert.equal(app.activeContext, null);
        assert.equal(app.learningSession, null); assert.equal(app.courseArea.hidden, true); assert.equal(app.dashboardFrame.hidden, false);
    });

    test(root + ': repeated page/course launches do not accumulate native Adapt/window controllers', () => {
        const { app, launch } = application();
        for (let index = 0; index < 64; index++) {
            const active = launch('visit-' + index);
            assert.equal(app.controllers.size, 1);
            assert.equal(app.controllers.get(active.context.launchId).Adapt, active.Adapt);
            app.closeCourse();
            assert.equal(app.controllers.size, 0, 'A retired native window is not kept by the root controller map');
            assert.equal(app.SCO_FRAME, null); assert.equal(app.launchHost, null);
            assert.equal(app.launchRecords.get(active.context.launchId), active.record);
        }
        assert.equal(app.launchRecords.size, 64, 'Do not trade controller cleanup for stale bridge identity corruption');
    });

    test(root + ': final application shutdown releases native references after unload and before one outer finish', () => {
        const { app, events, launch } = application();
        launch('finishing');
        assert.equal(app.stopApp(), true);
        assert.deepEqual(events, [
            'native-save:finishing', 'outer-save', 'host-remove:finishing',
            'native-save:finishing', 'outer-save', 'controller-delete:finishing', 'outer-finish'
        ]);
        assert.equal(app.closed, true); assert.equal(app.controllers.size, 0);
        assert.equal(app.SCO_FRAME, null); assert.equal(app.launchHost, null); assert.equal(app.activeContext, null);
        assert.equal(app.stopApp(), true); assert.equal(events.filter(event => event === 'outer-finish').length, 1);
    });

    test(root + ': late load callbacks from removed, superseded or closed frames cannot rebind controllers', () => {
        const { app, launch } = application(), old = launch('old-load');
        app.closeCourse();
        const active = launch('active-load');
        app.bindLearningLinks = () => { throw Error('A stale load reached course binding'); };
        app.bindChild(old.frame, old.context);
        app.bindChild(old.frame, active.context);
        active.frame.isConnected = false;
        app.bindChild(active.frame, active.context);
        active.frame.isConnected = true; app.closed = true;
        app.bindChild(active.frame, active.context);
        assert.equal(app.controllers.size, 1);
        assert.equal(app.controllers.get(active.context.launchId), active.controller);
        assert.equal(app.controllers.has(old.context.launchId), false);
        assert.equal(app.contexts.get(old.child), old.context, 'Never relabel a stale window as the active launch');
    });

    test(root + ': a stale native bootstrap cannot reuse its cached controller or attach to the latest window', () => {
        const { app, launch } = application(), old = launch('old-bootstrap');
        old.Adapt.__multiLXPController = old.controller;
        app.closeCourse();
        const active = launch('active-bootstrap');
        assert.equal(app.attachAdaptPersistence(old.Adapt, old.child), null);
        app.contexts.set(old.child, active.context);
        assert.equal(app.attachAdaptPersistence(old.Adapt, old.child), null, 'A mismatched child window is rejected even with the active context');
        active.frame.isConnected = false;
        assert.equal(app.attachAdaptPersistence(active.Adapt, active.child), null);
        active.frame.isConnected = true; app.closed = true;
        assert.equal(app.attachAdaptPersistence(active.Adapt, active.child), null);
        assert.equal(app.controllers.size, 1);
        assert.equal(app.controllers.get(active.context.launchId), active.controller);
        assert.throws(() => app.attachAdaptPersistence({}, {}), /unveränderlichen Startkontext/);
    });

    test(root + ': native late unload and its immutable bridge still update only the old attempt record', () => {
        const { app, launch } = application(), old = launch('old-attempt');
        old.bridge.LMSSetValue('cmi.suspend_data', 'saved old native answer');
        app.closeCourse();
        delete app.state.scoStates[old.context.scoId];
        const active = launch('new-attempt');
        active.bridge.LMSSetValue('cmi.suspend_data', 'new native answer');
        assert.notEqual(active.record, old.record);
        old.child.location.hash = '#/id/late-old-page';
        old.listeners.beforeunload();
        assert.equal(old.bridge.LMSSetValue('cmi.suspend_data', 'late old native unload'), 'true');
        assert.equal(old.bridge.LMSFinish(''), 'true');
        assert.equal(old.record.payload, 'late old native unload');
        assert.equal(old.record.contentId, 'late-old-page');
        assert.equal(active.record.payload, 'new native answer');
        assert.equal(app.state.scoStates[active.context.scoId], active.record);
        assert.equal(app.state.frameworkBookmarks[active.context.frameworkId].contentId, 'page-new-attempt');
        assert.equal(app.launchRecords.get(old.context.launchId), old.record);
        assert.equal(app.controllers.has(old.context.launchId), false);
        assert.equal(app.controllers.get(active.context.launchId), active.controller);
    });
}
