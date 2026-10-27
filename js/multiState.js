import { clone } from './multiContract.js';

export function createState(contract) {
    return { stateVersion: 1, packageId: contract.package.id, contentRevision: contract.package.revision,
        activeFrameworkId: null, frameworkBookmarks: {}, scoStates: {}, assessmentAttempts: {}, migration: { applied: [], reports: [] } };
}
export function localStateKey(contract, profileId = 'shared-device', attemptId = 'default') {
    return ['adapt-lxp', 1, contract.package.id, profileId, attemptId].map(value => encodeURIComponent(String(value))).join(':');
}
export function fingerprint(sco) { return sco.source.componentFingerprint || sco.source.contentFingerprint || sco.source.buildSha256; }
function plainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function validScores(value, allowed) {
    return plainObject(value) && Object.keys(value).length === allowed.size && Object.entries(value).every(([id, score]) => allowed.has(id) && plainObject(score) && Number.isFinite(score.score) && Number.isFinite(score.maxScore) && score.maxScore > 0 && score.score >= 0 && score.score <= score.maxScore);
}
function validAttempt(attempt, id, test, contract) {
    let valid = !['__proto__', 'constructor', 'prototype'].includes(id) && plainObject(attempt) && id === attempt.attemptId && attempt.frameworkId === test.frameworkId && attempt.assessmentId === test.id && attempt.phase === test.phase && typeof attempt.completed === 'boolean';
    if (!valid || !attempt.completed) return valid;
    valid = Number.isFinite(attempt.score) && Number.isFinite(attempt.maxScore) && attempt.maxScore > 0 && attempt.score >= 0 && attempt.score <= attempt.maxScore && typeof attempt.completedAt === 'string' && Number.isFinite(Date.parse(attempt.completedAt)) &&
        validScores(attempt.banks, new Set(test.banks.map(bank => bank.id))) && validScores(attempt.courses, new Set(test.banks.map(bank => bank.targetCourseId))) && validScores(attempt.domains, new Set(test.banks.map(bank => bank.domainId))) && validScores(attempt.questions, new Set(test.banks.flatMap(bank => bank.questionIds)));
    if (!valid) return false;
    const equal = (a,b) => Math.abs(a-b) < 0.000001, groups = { banks: {}, courses: {}, domains: {} };
    let points = 0, maximum = 0;
    for (const bank of test.banks) {
        for (const questionId of bank.questionIds) {
            const question = contract.questions.find(q => q.id === questionId), value = attempt.questions[questionId];
            if (!question || !equal(value.maxScore, question.maxPoints)) return false;
            points += value.score; maximum += value.maxScore;
            for (const [kind, key] of [['banks', bank.id], ['courses', bank.targetCourseId], ['domains', bank.domainId]]) {
                if (!groups[kind][key]) groups[kind][key] = {score:0,maxScore:0};
                groups[kind][key].score += value.score; groups[kind][key].maxScore += value.maxScore;
            }
        }
    }
    return equal(points, attempt.score) && equal(maximum, attempt.maxScore) && Object.entries(groups).every(([kind, values]) => Object.entries(values).every(([key,value]) => equal(value.score, attempt[kind][key].score) && equal(value.maxScore, attempt[kind][key].maxScore)));
}
export function hydrateState(contract, input) {
    const state = createState(contract), warnings = [];
    if (!input) return { state, warnings };
    if (input.stateVersion !== 1 || input.packageId !== contract.package.id) throw new Error('Gespeicherter Zustand gehört zu einem anderen Paket oder Zustandsschema.');
    const source = clone(input), scos = new Map(contract.scos.map(sco => [sco.id, sco])), frameworks = new Set(contract.frameworks.map(fw => fw.id)), changedTests = new Set();
    if (source.activeFrameworkId && frameworks.has(source.activeFrameworkId)) state.activeFrameworkId = source.activeFrameworkId;
    else if (source.activeFrameworkId) warnings.push('Aktiver Kompetenzrahmen ist nicht mehr enthalten.');
    Object.entries(source.scoStates || {}).forEach(([id, record]) => {
        const sco = scos.get(id);
        if (sco && sco.role !== 'learning' && plainObject(record) && record.frameworkId === sco.frameworkId && record.fingerprint !== fingerprint(sco)) {
            changedTests.add(id);
            warnings.push(`Test „${sco.label}“ wurde aktualisiert. Bisherige Antworten werden nicht den neuen Fragen zugeordnet. Bitte den Test neu beginnen.`);
            return;
        }
        if (!sco || !plainObject(record) || record.fingerprint !== fingerprint(sco) || record.frameworkId !== sco.frameworkId || typeof record.payload !== 'string' || !plainObject(record.values) || !Object.values(record.values).every(value => typeof value === 'string') || (record.native !== null && record.native !== undefined && !plainObject(record.native))) {
            warnings.push(`Kurszustand nicht übernommen (entfernt oder inkompatibel): ${id}`); return;
        }
        state.scoStates[id] = record;
    });
    Object.entries(source.frameworkBookmarks || {}).forEach(([fw, bookmark]) => {
        const sco = bookmark && scos.get(bookmark.scoId);
        if (frameworks.has(fw) && sco && sco.frameworkId === fw && state.scoStates[sco.id]) state.frameworkBookmarks[fw] = bookmark;
        else if (!bookmark || !changedTests.has(bookmark.scoId)) warnings.push(`Lesezeichen nicht übernommen: ${fw}`);
    });
    Object.entries(source.assessmentAttempts || {}).forEach(([fw, tests]) => {
        if (!frameworks.has(fw) || !tests || typeof tests !== 'object') { warnings.push(`Testergebnisse nicht übernommen: ${fw}`); return; }
        Object.entries(tests).forEach(([testId, attempts]) => {
            const test = contract.assessments.find(as => as.id === testId && as.frameworkId === fw);
            if (test && changedTests.has(test.scoId)) return; // Already explained with the human-readable test label.
            if (!test || !state.scoStates[test.scoId] || !plainObject(attempts)) { warnings.push(`Testergebnis nicht übernommen: ${testId}`); return; }
            if (!state.assessmentAttempts[fw]) state.assessmentAttempts[fw] = {};
            state.assessmentAttempts[fw][testId] = {};
            Object.entries(attempts).forEach(([id, attempt]) => {
                if (validAttempt(attempt, id, test, contract)) state.assessmentAttempts[fw][testId][id] = attempt;
                else warnings.push(`Ungültiger Testversuch nicht übernommen: ${testId}/${id}`);
            });
        });
    });
    state.migration = source.migration && Array.isArray(source.migration.applied) && Array.isArray(source.migration.reports) ? source.migration : state.migration;
    if (source.contentRevision !== contract.package.revision) warnings.push('Paketrevision geändert: Abschluss wird anhand des aktuellen Pflichtumfangs neu berechnet.');
    return { state, warnings };
}
export function encodeState(state, environment = globalThis) {
    const json = JSON.stringify(state);
    if (environment.RawDeflate && environment.Base64) return 'LXP1Z:' + environment.Base64.toBase64(environment.RawDeflate.deflate(environment.Base64.utob(json)));
    return 'LXP1J:' + json;
}
export function decodeState(value, environment = globalThis) {
    if (!value) return null;
    if (value.startsWith('LXP1J:')) return JSON.parse(value.slice(6));
    if (value.startsWith('LXP1Z:') && environment.RawDeflate && environment.Base64) return JSON.parse(environment.Base64.btou(environment.RawDeflate.inflate(environment.Base64.fromBase64(value.slice(6)))));
    throw new Error('Unbekanntes oder beschädigtes Speicherformat. Kein automatischer Legacy-Import.');
}

// The caller supplies a proven legacy envelope, never global browser cmi.* data.
// Every populated legacy container requires explicit aliases and fingerprints.
export function migrateLegacy(contract, envelope, plan, current = createState(contract)) {
    if (!plan || !envelope || !plan.id || plan.targetPackageId !== contract.package.id || plan.sourcePackageId !== envelope.packageId || plan.sourceRevision !== envelope.revision || !envelope.packageId || !envelope.revision || plan.confirmed !== true) throw new Error('Migration braucht bestätigte Paketidentität, Revision und Alias-Tabelle.');
    const state = clone(current);
    if (state.migration.applied.includes(plan.id)) return { state, backup: null, report: { id: plan.id, alreadyApplied: true } };
    const backup = clone(envelope), data = envelope.data || {}, rejected = [], migrated = [];
    const aliases = plan.scoAliases || {}, tests = plan.assessmentAliases || {}, scos = new Map(contract.scos.map(sco => [sco.id, sco]));
    const targetAliases = Object.values(aliases).map(alias => alias && alias.scoId);
    if (new Set(targetAliases).size !== targetAliases.length) throw new Error('Migrationsalias-Kollision: mehrere alte Kurse haben dieselbe Ziel-ID.');
    const allIds = new Set([...Object.keys(data.adaptData || {}), ...Object.keys((data.customData || {}).nativeAdapt || {}), ...Object.keys((data.customData || {}).scoState || {})]);
    allIds.forEach(oldId => {
        const alias = aliases[oldId], sco = alias && scos.get(alias.scoId);
        if (!sco || !alias.sourceFingerprint || envelope.fingerprints && envelope.fingerprints[oldId] !== alias.sourceFingerprint || !envelope.fingerprints || alias.targetFingerprint !== fingerprint(sco) || alias.sourceFingerprint !== alias.targetFingerprint || alias.frameworkId !== sco.frameworkId) { rejected.push(oldId); return; }
        const payload = (data.adaptData || {})[oldId];
        state.scoStates[sco.id] = { frameworkId: sco.frameworkId, fingerprint: fingerprint(sco), payload: typeof payload === 'string' ? payload : payload === undefined ? '' : JSON.stringify(payload), values: clone(((data.customData || {}).scoState || {})[oldId] || {}), native: clone(((data.customData || {}).nativeAdapt || {})[oldId] || null) };
        migrated.push(oldId);
    });
    if (data.bookmark) {
        const alias = plan.bookmarkAliases && plan.bookmarkAliases[data.bookmark];
        const sco = alias && scos.get(alias.scoId);
        if (sco && state.scoStates[sco.id] && alias.frameworkId === sco.frameworkId) state.frameworkBookmarks[sco.frameworkId] = { scoId: sco.id, contentId: alias.contentId || null };
        else rejected.push(`bookmark:${data.bookmark}`);
    }
    Object.entries(data.assessmentAttempts || {}).forEach(([oldId, attempts]) => {
        const alias = tests[oldId], assessment = alias && contract.assessments.find(as => as.id === alias.assessmentId && as.frameworkId === alias.frameworkId);
        if (!assessment || !state.scoStates[assessment.scoId] || !alias.sourceFingerprint || !envelope.fingerprints || envelope.fingerprints[oldId] !== alias.sourceFingerprint || alias.sourceFingerprint !== alias.targetFingerprint || alias.targetFingerprint !== fingerprint(scos.get(assessment.scoId)) || !plainObject(attempts)) { rejected.push(`assessment:${oldId}`); return; }
        if (!state.assessmentAttempts[assessment.frameworkId]) state.assessmentAttempts[assessment.frameworkId] = {};
        if (!state.assessmentAttempts[assessment.frameworkId][assessment.id]) state.assessmentAttempts[assessment.frameworkId][assessment.id] = {};
        Object.entries(attempts).forEach(([id, attempt]) => {
            if (!plainObject(attempt) || attempt.frameworkId !== (alias.sourceFrameworkId || alias.frameworkId) || attempt.assessmentId !== (alias.sourceAssessmentId || oldId) || attempt.phase !== assessment.phase) { rejected.push(`assessment:${oldId}/${id}`); return; }
            const candidate = { ...clone(attempt), frameworkId: assessment.frameworkId, assessmentId: assessment.id };
            if (!validAttempt(candidate, id, assessment, contract)) { rejected.push(`assessment:${oldId}/${id}`); return; }
            if (Object.prototype.hasOwnProperty.call(state.assessmentAttempts[assessment.frameworkId][assessment.id], id)) { rejected.push(`assessment-collision:${oldId}/${id}`); return; }
            state.assessmentAttempts[assessment.frameworkId][assessment.id][id] = candidate;
        });
    });
    const knownCustom = new Set(['nativeAdapt', 'scoState']);
    Object.keys(data.customData || {}).filter(key => !knownCustom.has(key)).forEach(key => {
        // Opaque containers need explicit preservation, not inferred answer maps.
        if (!(plan.opaqueContainerAliases || {})[key]) rejected.push(`container:${key}`);
        else {
            if (!state.migration.opaque) state.migration.opaque = {};
            state.migration.opaque[plan.opaqueContainerAliases[key]] = clone(data.customData[key]);
        }
    });
    const report = { id: plan.id, sourcePackageId: envelope.packageId, sourceRevision: envelope.revision, migrated, rejected };
    state.migration.applied.push(plan.id); state.migration.reports.push(report);
    return { state, backup, report };
}

export function findLMS(startWindow) {
    const visited = new Set(); let cursor = startWindow;
    for (let depth = 0; cursor && depth < 20 && !visited.has(cursor); depth++) {
        visited.add(cursor);
        try {
            if (cursor.API && !cursor.API.__adaptLXPBridge && typeof cursor.API.LMSInitialize === 'function') return cursor.API;
            if (cursor.parent && cursor.parent !== cursor) { cursor = cursor.parent; continue; }
            cursor = cursor.opener;
        } catch (_) { return null; }
    }
    return null;
}
function success(value) { return value === true || value === 'true'; }
export class StateTransport {
    constructor({ contract, api = null, storage = null, profileId, attemptId, environment = globalThis, onStatus = () => {} }) {
        this.contract = contract; this.api = api; this.storage = storage; this.environment = environment;
        this.key = localStateKey(contract, profileId, attemptId); this.onStatus = onStatus; this.finished = false;
        this.connected = false; this.startedAt = Date.now(); this.status = { kind: 'local', message: 'Nur lokale Sicherung; keine LMS-Wiederaufnahme nachgewiesen.' };
        if (api) {
            try { this.connected = success(api.LMSInitialize('')); if (!this.connected) throw new Error(this.diagnostic('Initialisierung abgewiesen')); }
            catch (error) { this.fail(error.message); }
        }
        this.initializationFailed = !!api && !this.connected;
        if (!this.connected) this.onStatus(this.status);
    }
    diagnostic(message) {
        const code = this.api && this.api.LMSGetLastError ? String(this.api.LMSGetLastError()) : '101';
        return `${message} (LMS ${code}).`;
    }
    fail(message) { this.status = { kind: 'error', message: `${message} LMS-Freigabe gesperrt. Lokale Sicherung herunterladen.` }; this.onStatus(this.status); return false; }
    get(key) {
        if (!this.connected) return '';
        const value = this.api.LMSGetValue(key), error = this.api.LMSGetLastError ? String(this.api.LMSGetLastError()) : '0';
        if (error !== '0') throw new Error(this.diagnostic(`Lesen von ${key} fehlgeschlagen`));
        return value == null ? '' : String(value);
    }
    load() {
        if (this.initializationFailed) throw new Error('LMS-Initialisierung fehlgeschlagen. Lokaler Fremdzustand wird nicht anstelle des LMS-Kontexts geladen.');
        if (this.connected) {
            try { this.rawLoaded = this.get('cmi.suspend_data'); return decodeState(this.rawLoaded, this.environment); }
            catch (error) { this.fail(error.message); throw error; }
        }
        try { this.rawLoaded = this.storage && this.storage.getItem(this.key); return decodeState(this.rawLoaded, this.environment); }
        catch (error) { this.fail(error.message); throw error; }
    }
    save(state, complete) {
        let encoded, localError = null;
        try {
            encoded = encodeState(state, this.environment); this.lastBackup = JSON.stringify(state, null, 2);
        } catch (error) { return this.fail(`Zustand konnte nicht serialisiert werden: ${error.message}`); }
        try {
            if (!this.storage) throw new Error('Browser-Speicher nicht verfügbar');
            this.storage.setItem(this.key, encoded);
        } catch (error) { localError = error; }
        if (this.initializationFailed) return this.fail('LMS-Initialisierung fehlgeschlagen. Nur eine lokale Sicherung ist möglich.');
        if (!this.connected) {
            if (localError) return this.fail(`Lokale Sicherung fehlgeschlagen: ${localError.message}. Unveränderte Sicherung bleibt im Arbeitsspeicher herunterladbar.`);
            this.status = { kind: 'local', size: encoded.length, overBudget: encoded.length > 4096, message: `Lokal gesichert (${encoded.length} Zeichen). Kein LMS-Speichererfolg.${encoded.length > 4096 ? ' 4096-Zeichen-LMS-Budget überschritten; LMS-Freigabe gesperrt.' : ' Ziel-LMS-Abnahme offen.'} Auf gemeinsam genutzten Geräten ist ein getrenntes Profil erforderlich.` }; this.onStatus(this.status); return true;
        }
        if (encoded.length > 4096) return this.fail(`Speicherbudget überschritten: ${encoded.length}/4096 Zeichen.`);
        try {
            for (const [key, value] of [['cmi.suspend_data', encoded], ['cmi.core.lesson_status', complete ? 'completed' : 'incomplete']]) {
                if (!success(this.api.LMSSetValue(key, value))) throw new Error(this.diagnostic(`Schreiben von ${key} fehlgeschlagen`));
            }
            if (!success(this.api.LMSCommit(''))) throw new Error(this.diagnostic('Commit abgewiesen'));
            if (this.get('cmi.suspend_data') !== encoded) throw new Error('LMS-Rückgabe ist abgeschnitten oder verändert.');
            this.status = { kind: 'lms', size: encoded.length, localBackupFailed: !!localError, message: `Im LMS gespeichert und zurückgelesen (${encoded.length}/4096 Zeichen). Ziel-LMS-Abnahme bleibt separat.${localError ? ' Achtung: lokale Browser-Sicherung fehlgeschlagen; Sicherung im Arbeitsspeicher herunterladen.' : ''}` };
            this.onStatus(this.status); return true;
        } catch (error) { return this.fail(error.message); }
    }
    finish(state, complete) {
        if (this.finished) return this.finishResult;
        this.finished = true;
        const saved = this.save(state, complete);
        if (!this.connected) return (this.finishResult = saved);
        try {
            const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
            const duration = `${String(Math.floor(seconds / 3600)).padStart(4, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            // Suspend the single outer SCO so a subsequent launch resumes this
            // learner/attempt payload rather than starting an unbound attempt.
            if (!success(this.api.LMSSetValue('cmi.core.exit', 'suspend'))) throw new Error(this.diagnostic('Wiederaufnahme-Status abgewiesen'));
            if (!success(this.api.LMSSetValue('cmi.core.session_time', duration))) throw new Error(this.diagnostic('Sitzungszeit abgewiesen'));
            if (!success(this.api.LMSCommit('')) || !success(this.api.LMSFinish(''))) throw new Error(this.diagnostic('Finalisierung abgewiesen'));
            return (this.finishResult = saved);
        } catch (error) { return (this.finishResult = this.fail(error.message)); }
    }
}
