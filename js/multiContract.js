// Product contract v1. Identifiers are opaque references, never taxonomy syntax.
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SHA256 = /^[a-f0-9]{64}$/i;
export function clone(value) { return JSON.parse(JSON.stringify(value)); }
function requireThat(value, message) { if (!value) throw new Error(message); }
function text(value) { return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value); }
function identifier(value) { return text(value) && !BAD_KEYS.has(value); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function number(value) { return typeof value === 'string' && /^[1-9]\d*$/.test(value); }
function index(items, name) {
    requireThat(Array.isArray(items), `${name}: Liste fehlt.`);
    const result = new Map();
    items.forEach(item => {
        requireThat(object(item) && identifier(item.id) && !result.has(item.id), `${name}: ungültige oder doppelte ID.`);
        result.set(item.id, item);
    });
    return result;
}
function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(deepFreeze); Object.freeze(value);
    }
    return value;
}
export function validateCapabilities(capability) {
    requireThat(object(capability) && capability.capability === 'multi-framework' && capability.version === 1 && capability.packageContract === 'adapt-lxp-multi-framework@1' && capability.persistenceContract === 1 && capability.launchContext === 'explicit-sco-id', 'Wrapper unterstützt den benötigten Multi-Framework-/Persistenzvertrag nicht.');
    requireThat(object(capability.implementationFiles) && SHA256.test(capability.implementationSha256 || ''), 'Geprüfter Wrapperbuild fehlt.');
    ['js/multiContract.js', 'js/multiState.js', 'js/multiBridge.js', 'js/multiAssessment.js', 'js/multiFramework.js', 'js/corePersistence.js', 'index.html'].forEach(file => requireThat(SHA256.test(capability.implementationFiles[file] || ''), 'Unvollständiger Multi-Framework-Wrapperbuild.'));
    Object.entries(capability.implementationFiles).forEach(([path, sha]) => { safeRelativePath(path); requireThat(SHA256.test(sha), 'Ungültige Wrapper-Buildprüfsumme.'); });
    return capability;
}

// Decode exactly once. Encoded separators, double encodings and URL aliases are
// rejected rather than interpreted differently by ZIP, browser and manifest.
export function safeRelativePath(value, allowSuffix = false) {
    requireThat(text(value) && !/[\\\s]/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('/'), 'Unsicherer Startpfad.');
    const match = /^([^?#]+)(\?[^#]*)?(#.*)?$/.exec(value);
    requireThat(match && (allowSuffix || (!match[2] && !match[3])), 'Ungültiger Startpfad.');
    let decoded;
    try { decoded = decodeURIComponent(match[1]); } catch (_) { throw new Error('Ungültige Pfadkodierung.'); }
    requireThat(!/[%\\?#:\u0000-\u0020\u007f]/.test(decoded) && !decoded.startsWith('/') && !/%(?:2f|5c)/i.test(match[1]), 'Mehrdeutiger Startpfad.');
    requireThat(decoded.split('/').every(part => part && part !== '.' && part !== '..'), 'Pfad verlässt den Paketbereich.');
    if (match[2] || match[3]) {
        let suffix;
        try { suffix = decodeURIComponent((match[2] || '') + (match[3] || '')); } catch (_) { throw new Error('Ungültiger URL-Zusatz.'); }
        requireThat(!/[\\\u0000-\u001f\u007f]/.test(suffix) && !/%[a-f0-9]{2}/i.test(suffix), 'Unsicherer URL-Zusatz.');
    }
    return decoded + (match[2] || '') + (match[3] || '');
}
export function launchPath(sco, contentId) {
    const root = safeRelativePath(sco.launch.root);
    const entry = safeRelativePath(sco.launch.entry, true);
    const path = safeRelativePath(root + '/' + entry, true);
    requireThat(path.startsWith(root + '/'), 'Startpfad verlässt den Kursbereich.');
    if (contentId === undefined || contentId === null || contentId === '') return path;
    requireThat(text(contentId) && !/[\\\u0000-\u001f\u007f]/.test(contentId), 'Ungültiges Inhaltslesezeichen.');
    return path.split('#')[0] + '#/id/' + encodeURIComponent(contentId);
}

export function validateContract(input) {
    requireThat(object(input) && input.format === 'adapt-lxp-multi-framework' && input.version === 1 && input.exampleOnly === false, 'Nicht unterstützter Multi-Framework-Produktvertrag (Version 1 erforderlich).');
    const contract = clone(input), pkg = contract.package;
    requireThat(object(pkg) && identifier(pkg.id) && text(pkg.revision) && text(pkg.title) && text(pkg.catalogueRevision) && text(pkg.targetProfileId) && pkg.outerScorm === '1.2', 'Paketidentität, Katalogstand oder SCORM-1.2-Zielprofil fehlt.');
    requireThat(!pkg.manifestLaunch || safeRelativePath(pkg.manifestLaunch, true), 'Ungültiger äußerer Einstieg.');
    const frameworks = index(contract.frameworks, 'Kompetenzrahmen');
    requireThat(frameworks.size > 0, 'Kein Kompetenzrahmen enthalten.');
    const prefixes = new Set();
    frameworks.forEach(fw => {
        requireThat(text(fw.prefix) && text(fw.version) && text(fw.label) && !prefixes.has(fw.prefix), 'Rahmenfassung fehlt oder mehrere Fassungen desselben Rahmens.');
        prefixes.add(fw.prefix);
    });
    const modules = index(contract.modules, 'Module'), scos = index(contract.scos, 'Kurse');
    const assessments = index(contract.assessments, 'Tests'), questions = index(contract.questions, 'Fragen');
    const pathways = index(contract.pathways, 'Lernpfade'), glossary = index(contract.glossary, 'Glossar');
    requireThat(Array.isArray(contract.domains), 'Domänenliste fehlt.');
    const domains = new Map(), slots = new Set(), roots = [];
    contract.domains.forEach(domain => {
        const key = JSON.stringify([domain.frameworkId, domain.id]);
        requireThat(frameworks.has(domain.frameworkId) && identifier(domain.id) && text(domain.label) && !domains.has(key), 'Ungültige oder doppelte didaktische Domäne.');
        domains.set(key, domain);
    });
    modules.forEach(mod => {
        const slot = JSON.stringify([mod.frameworkId, mod.number]);
        requireThat(frameworks.has(mod.frameworkId) && number(mod.number) && text(mod.label) && !slots.has(slot), 'Ungültiger oder doppelter Modulplatz.'); slots.add(slot);
    });
    slots.clear();
    scos.forEach(sco => {
        requireThat(frameworks.has(sco.frameworkId) && ['learning', 'entry', 'final'].includes(sco.role) && text(sco.label) && typeof sco.requiredForCompletion === 'boolean', 'Ungültige Kursrolle oder Rahmenreferenz.');
        if (sco.role === 'learning') {
            const mod = modules.get(sco.moduleId), slot = JSON.stringify([sco.frameworkId, sco.moduleId, sco.number]);
            requireThat(mod && mod.frameworkId === sco.frameworkId && number(sco.number) && !slots.has(slot), 'Ungültiger oder doppelter Kursplatz.'); slots.add(slot);
        } else requireThat(sco.requiredForCompletion === false, 'Diagnostik ist keine Pflicht-Lerneinheit.');
        requireThat(object(sco.launch) && text(sco.launch.manifestHref), 'Manifesttreuer Kurseinstieg fehlt.');
        const root = safeRelativePath(sco.launch.root); launchPath(sco);
        requireThat(safeRelativePath(sco.launch.entry, true) === safeRelativePath(sco.launch.manifestHref, true), 'Kurseinstieg stimmt nicht mit der gewählten Manifestressource überein.');
        requireThat(!roots.some(other => root === other || root.startsWith(other + '/') || other.startsWith(root + '/')), 'Kursverzeichnisse kollidieren oder überlappen.'); roots.push(root);
        const src = sco.source;
        requireThat(object(src) && SHA256.test(src.buildSha256 || '') && SHA256.test(src.catalogueSha256 || ''), 'Echter Quellbuild-/Katalogfingerabdruck fehlt.');
        requireThat((src.componentFingerprint === undefined || SHA256.test(src.componentFingerprint)) && (src.contentFingerprint === undefined || SHA256.test(src.contentFingerprint)), 'Ungültiger Inhalts-/Komponentenfingerabdruck.');
        if (sco.role === 'learning') {
            requireThat(['aat-published', 'native-registered'].includes(src.kind) && text(src.originId) && text(src.courseId) && text(src.title) && src.title === src.publishedTitle && text(src.language), 'Ungültige Veröffentlichung: Bitte Kurs erneut veröffentlichen.');
            requireThat(object(src.manifest) && SHA256.test(src.manifest.sha256 || '') && text(src.manifest.resourceId) && src.manifest.href === sco.launch.manifestHref, 'Nachweis des gewählten Manifest-Einstiegs fehlt.');
        } else {
            requireThat(src.kind === 'generated-assessment' && identifier(src.assessmentId) && SHA256.test(src.generatorSha256 || '') && SHA256.test(src.templateSha256 || '') && Array.isArray(src.questions) && src.questions.length > 0 && object(src.manifest) && SHA256.test(src.manifest.sha256 || '') && text(src.manifest.resourceId) && src.manifest.href === sco.launch.manifestHref, 'Generatorprovenienz des Tests fehlt.');
        }
    });
    questions.forEach(q => {
        const course = scos.get(q.sourceCourseId);
        requireThat(course && course.role === 'learning' && identifier(q.sourceComponentId) && identifier(q.runtimeQuestionId || q.sourceComponentId) && ['mcq', 'gmcq', 'matching', 'slider', 'textinput', 'infai-dragndrop'].includes(q.component) && q.available === true && q.selfAssessment === false && Number.isFinite(q.maxPoints) && q.maxPoints > 0 && Array.isArray(q.tags), 'Ungültige oder nicht unterstützte Diagnosefrage.');
    });
    const assessmentScos = new Set(), phases = new Set(), globalBankIds = new Set();
    assessments.forEach(as => {
        const sco = scos.get(as.scoId), phaseKey = JSON.stringify([as.frameworkId, as.phase]);
        requireThat(frameworks.has(as.frameworkId) && sco && sco.frameworkId === as.frameworkId && sco.role === as.phase && ['entry', 'final'].includes(as.phase) && !assessmentScos.has(as.scoId) && !phases.has(phaseKey) && Array.isArray(as.banks) && as.banks.length > 0, 'Ungültige oder doppelte Testzuordnung.');
        assessmentScos.add(as.scoId); phases.add(phaseKey);
        const bankIds = new Set(), runtimeIds = new Set(), sourceQuestions = new Set();
        as.banks.forEach(bank => {
            const course = scos.get(bank.targetCourseId);
            requireThat(identifier(bank.id) && !bankIds.has(bank.id) && !globalBankIds.has(bank.id) && Number.isInteger(bank.runtimeBankId) && bank.runtimeBankId > 0 && !runtimeIds.has(bank.runtimeBankId) && course && course.role === 'learning' && course.frameworkId === as.frameworkId && domains.has(JSON.stringify([as.frameworkId, bank.domainId])) && Array.isArray(bank.questionIds) && bank.questionIds.length > 0, 'Ungültige Testbank oder rahmenfremde Referenz.');
            bankIds.add(bank.id); globalBankIds.add(bank.id); runtimeIds.add(bank.runtimeBankId);
            let max = 0;
            bank.questionIds.forEach(id => {
                const q = questions.get(id), sourceKey = q && JSON.stringify([q.sourceCourseId, q.sourceComponentId]);
                requireThat(q && q.sourceCourseId === bank.targetCourseId && q.tags.includes(as.phase === 'entry' ? 'et' : 'at') && !sourceQuestions.has(sourceKey), 'Fehlende, doppelte oder phasenfremde Quellfrage.');
                sourceQuestions.add(sourceKey); max += q.maxPoints;
            });
            requireThat(Number.isFinite(bank.maxPoints) && bank.maxPoints > 0 && Math.abs(max - bank.maxPoints) < 0.000001, 'Maximalpunkte der Testbank stimmen nicht.');
        });
        const expectedQuestions = new Set(as.banks.flatMap(bank => bank.questionIds));
        requireThat(sco.source.assessmentId === as.id && sco.source.questions.length === expectedQuestions.size && sco.source.questions.every(ref => {
            if (!object(ref) || !expectedQuestions.has(ref.questionId)) return false;
            const question = questions.get(ref.questionId); expectedQuestions.delete(ref.questionId);
            return question && ref.sourceCourseId === question.sourceCourseId && ref.sourceComponentId === question.sourceComponentId;
        }) && expectedQuestions.size === 0, 'Generatorprovenienz und tatsächliche Testfragen stimmen nicht überein.');
    });
    scos.forEach(sco => requireThat(sco.role === 'learning' || assessmentScos.has(sco.id), 'Test-SCO ohne Testauftrag.'));
    frameworks.forEach(fw => ['entry', 'final'].forEach(phase => {
        const diagnostic = fw.diagnostics && fw.diagnostics[phase], exists = phases.has(JSON.stringify([fw.id, phase]));
        requireThat(object(diagnostic) && ['omit', 'ifAvailable', 'require'].includes(diagnostic.intent) && ['provided', 'notProvided'].includes(diagnostic.status), 'Testverfügbarkeit fehlt.');
        requireThat(exists === (diagnostic.status === 'provided') && (exists ? diagnostic.reason === null && diagnostic.intent !== 'omit' : (diagnostic.intent === 'omit' && diagnostic.reason === 'not-requested') || (diagnostic.intent === 'ifAvailable' && diagnostic.reason === 'no-assigned-questions')), 'Widersprüchliche Testverfügbarkeit; benötigter Test fehlt.');
    }));
    pathways.forEach(path => requireThat(frameworks.has(path.frameworkId) && text(path.label) && Array.isArray(path.courseIds) && path.courseIds.length > 0 && path.courseIds.every(id => scos.has(id) && scos.get(id).role === 'learning' && scos.get(id).frameworkId === path.frameworkId), 'Ungültiger oder rahmenfremder Lernpfad.'));
    glossary.forEach(term => requireThat(frameworks.has(term.frameworkId) && text(term.term) && Array.isArray(term.targets) && term.targets.length > 0 && term.targets.every(target => scos.has(target.scoId) && scos.get(target.scoId).frameworkId === term.frameworkId && scos.get(target.scoId).role === 'learning' && identifier(target.contentId)), 'Ungültiges oder rahmenfremdes Glossarziel.'));
    requireThat(object(contract.completion) && contract.completion.policy === 'all-required-learning-courses' && contract.completion.outerScorePolicy === 'no-cross-framework-score' && contract.scos.some(sco => sco.role === 'learning' && sco.requiredForCompletion), 'Leerer Pflichtumfang oder nicht unterstützte Abschlussregel.');
    return { contract: deepFreeze(contract), frameworks, modules, scos, assessments, questions, domains, pathways, glossary };
}

export function courseComplete(record) {
    if (!record) return false;
    if (record.values && ['completed', 'passed'].includes(record.values['cmi.core.lesson_status'])) return true;
    const native = record.native;
    if (!native || native.format !== 1) return false;
    if (native.complete === true) return true;
    const required = Object.values(native.components || {}).filter(component => component && component.required !== false);
    return required.length > 0 && required.every(component => component.state && component.state._isComplete === true);
}
export function progress(contract, state, frameworkId) {
    const courses = contract.scos.filter(sco => sco.role === 'learning' && sco.requiredForCompletion && (!frameworkId || sco.frameworkId === frameworkId));
    const completed = courses.filter(sco => courseComplete(state.scoStates[sco.id])).length;
    return { required: courses.length, completed, fraction: courses.length ? completed / courses.length : null, complete: courses.length > 0 && completed === courses.length };
}
