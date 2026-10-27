import { fingerprint } from './multiState.js';
import { clone } from './multiContract.js';
export function scoRecord(app, context) {
    const sco = app.catalog.scos.get(context.scoId);
    if (!sco || sco.frameworkId !== context.frameworkId || sco.role !== context.role) throw new Error('Unbekannter Startkontext.');
    if (!app.state.scoStates[sco.id]) app.state.scoStates[sco.id] = { frameworkId: sco.frameworkId, fingerprint: fingerprint(sco), payload: '', values: {}, native: null };
    return app.state.scoStates[sco.id];
}
export function createBridge(app, launchContext) {
    const context = Object.freeze(clone(launchContext));
    const boundRecord = scoRecord(app, context);
    let lastError = '0', finished = false, finishResult = null;
    function record() { return boundRecord; }
    function persist() {
        if (app.save() === false) { lastError = '101'; return 'false'; }
        lastError = '0'; return 'true';
    }
    return {
        __adaptLXPBridge: true, __launchContext: context,
        LMSInitialize() { lastError = '0'; return 'true'; },
        LMSGetValue(parameter) {
            lastError = '0'; const values = record().values;
            if (parameter === 'cmi.suspend_data') return record().payload || '';
            if (Object.prototype.hasOwnProperty.call(values, parameter)) return values[parameter];
            if (parameter === 'cmi.core.lesson_status') return 'not attempted';
            if (parameter === 'cmi.core.entry') return record().payload || record().native ? 'resume' : 'ab-initio';
            if (parameter === 'cmi.interactions._count') return String(Object.keys(values).filter(key => /^cmi\.interactions\.\d+\.id$/.test(key)).length);
            if (/^cmi\.(core\.student_(id|name)|student_preference\.language)$/.test(parameter)) {
                try { return app.transport.get(parameter); } catch (error) { app.warn(error.message); lastError = '101'; return ''; }
            }
            return '';
        },
        LMSSetValue(parameter, value) {
            try {
                if (typeof parameter !== 'string' || !parameter.startsWith('cmi.') || /(?:__proto__|constructor|prototype)/.test(parameter)) throw new Error('Ungültiger SCORM-Parameter.');
                if (parameter === 'cmi.suspend_data') record().payload = String(value);
                else record().values[parameter] = String(value);
                if (parameter === 'cmi.core.lesson_location') app.recordLocation(context, String(value));
                return persist();
            } catch (error) { app.warn(error.message); lastError = '101'; return 'false'; }
        },
        LMSCommit() { return persist(); },
        LMSFinish() {
            if (finished) { lastError = finishResult === 'true' ? '0' : '101'; return finishResult; }
            finished = true; finishResult = persist(); return finishResult;
        },
        LMSGetLastError() { return lastError; },
        LMSGetErrorString(code) { return String(code) === '0' ? 'No error' : 'Could not persist SCO data'; },
        LMSGetDiagnostic() { return lastError === '0' ? 'No error' : app.transport.status.message; }
    };
}
