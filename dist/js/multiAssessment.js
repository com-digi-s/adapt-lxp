// Diagnostic grading and reporting resolve native banks within one assessment.
// No numeric digit, route substring or current dashboard selection is an identity.
function attr(model, key) { return typeof model.get === 'function' ? model.get(key) : (model.attributes || model)[key]; }
function score(model) {
    const type = attr(model, '_component'), items = attr(model, '_items') || [], answers = attr(model, '_userAnswer') || [];
    const weightValue = attr(model, '_questionWeight'), weight = Number.isFinite(weightValue) && weightValue > 0 ? weightValue : 1;
    let maximum = 0, points = 0;
    if (type === 'mcq' || type === 'gmcq') {
        items.forEach((item, i) => { if (item._shouldBeSelected) maximum += weight; if (answers[i] === true) points += item._shouldBeSelected ? weight : -weight; });
    } else if (type === 'matching') {
        // Native MatchingModel sets _selectable = _items.length, and
        // setActiveOption deselects every other option in that same row.
        // Several _isCorrect options are ALTERNATIVES, not extra score slots.
        // See published Adapt 5.22.6 / MatchingModel (ComDigiS M3/3).
        if (!Array.isArray(items) || !items.length || !Array.isArray(answers)) throw new Error('Ungültige Matching-Antwort.');
        const optionCount = items.reduce((total, item) => total + (Array.isArray(item._options) ? item._options.length : 0), 0);
        if (answers.length !== optionCount && answers.length !== 0) throw new Error('Unvollständiger Matching-Antwortvektor.');
        if (!answers.every(value => typeof value === 'boolean')) throw new Error('Ungültiger Matching-Antwortvektor.');
        let offset = 0;
        maximum = items.length * weight;
        items.forEach(item => {
            const options = item._options;
            if (!Array.isArray(options) || !options.length || !options.some(option => option._isCorrect === true)) throw new Error('Matching-Zeile ohne gültige Zuordnung.');
            const selected = options.filter((option, index) => answers[offset + index] === true);
            offset += options.length;
            if (selected.length > 1) throw new Error('Mehrfachauswahl in einer Matching-Zeile ist nicht zulässig.');
            if (attr(model, '_isSubmitted') === true && selected.length !== 1) throw new Error('Abgegebene Matching-Antwort enthält eine unbeantwortete Zeile.');
            if (selected.length === 1 && selected[0]._isCorrect === true) points += weight;
        });
    } else if (type === 'infai-dragndrop') {
        let offset = 0, answerOffset = 0;
        items.forEach(item => {
            if (!Array.isArray(item.accepted)) throw new Error('Nicht normalisierte Drag-and-drop-Zuordnung.');
            const accepted = item.accepted.map(() => offset++); maximum += accepted.length * weight;
            // Native answers are flattened slots per drop group, not one answer
            // per item. Each accepted source index may earn points only once.
            const choices = new Set(answers.slice(answerOffset, answerOffset + accepted.length));
            points += accepted.filter(index => choices.has(index)).length * weight;
            answerOffset += accepted.length;
        });
    } else if (type === 'slider' || type === 'textinput') {
        maximum = Number.isFinite(model.maxScore) ? model.maxScore : attr(model, '_maxScore');
        points = Number.isFinite(attr(model, '_score')) ? attr(model, '_score') : model.score;
    } else throw new Error(`Nicht unterstützte Testkomponente: ${type}.`);
    if (attr(model, '_isSubmitted') === false) points = 0;
    if (!Number.isFinite(maximum) || maximum <= 0 || !Number.isFinite(points)) throw new Error(`Ungültige Bewertung: ${attr(model, '_id')}.`);
    return { score: Math.min(Math.max(points, 0), maximum), maxScore: maximum };
}
function add(target, id, points, max) {
    if (!target[id]) target[id] = { score: 0, maxScore: 0 };
    target[id].score += points; target[id].maxScore += max;
}
export function percentage(value) { return value && Number.isFinite(value.score) && Number.isFinite(value.maxScore) && value.maxScore > 0 ? value.score / value.maxScore * 100 : null; }
export function collectAssessment(contract, context, components, blocks) {
    const assessment = contract.assessments.find(as => as.id === context.assessmentId && as.scoId === context.scoId && as.frameworkId === context.frameworkId && as.phase === context.role);
    if (!assessment) throw new Error('Testkontext fehlt oder ist ungültig.');
    const banks = new Map(assessment.banks.map(bank => [String(bank.runtimeBankId), bank]));
    const questions = new Map(contract.questions.map(q => [q.id, q])), seen = new Set(), sourceSeen = new Set();
    const result = { frameworkId: context.frameworkId, assessmentId: assessment.id, phase: assessment.phase, score: 0, maxScore: 0, banks: {}, courses: {}, domains: {}, questions: {} };
    components.forEach(model => {
        if (attr(model, '_isAvailable') === false) return;
        const block = blocks.find(candidate => attr(candidate, '_id') === attr(model, '_parentId'));
        const nativeBank = block && attr(block, '_assessment');
        if (!nativeBank || nativeBank._isEnabled === false) return;
        const bank = banks.get(String(nativeBank._quizBankID));
        if (!bank) throw new Error(`Testbank nicht zugeordnet: ${nativeBank._quizBankID}.`);
        const question = bank.questionIds.map(id => questions.get(id)).find(q => (q.runtimeQuestionId || q.sourceComponentId) === attr(model, '_id'));
        if (!question) {
            if (attr(model, '_isQuestionType') || ['mcq','gmcq','matching','slider','textinput','infai-dragndrop'].includes(attr(model, '_component'))) throw new Error(`Testfrage nicht zugeordnet: ${attr(model, '_id')}.`);
            return;
        }
        const sourceIdentity = JSON.stringify([question.sourceCourseId, question.sourceComponentId]);
        if (question.component !== attr(model, '_component')) throw new Error(`Komponententyp stimmt nicht für ${question.id}.`);
        if (seen.has(question.id) || sourceSeen.has(sourceIdentity)) throw new Error('Doppelte Quellfrage im Test.');
        seen.add(question.id); sourceSeen.add(sourceIdentity);
        const value = score(model);
        if (Math.abs(value.maxScore - question.maxPoints) > 0.000001) throw new Error(`Maximalpunkte stimmen nicht für ${question.id}.`);
        result.questions[question.id] = value;
        add(result.banks, bank.id, value.score, value.maxScore); add(result.courses, bank.targetCourseId, value.score, value.maxScore); add(result.domains, bank.domainId, value.score, value.maxScore);
        result.score += value.score; result.maxScore += value.maxScore;
    });
    const expected = assessment.banks.flatMap(bank => bank.questionIds);
    if (expected.some(id => !seen.has(id)) || result.maxScore <= 0) throw new Error('Test ist unvollständig; erwartete Diagnosefragen fehlen.');
    return result;
}
export function reportData(contract, attempt) {
    const framework = contract.frameworks.find(fw => fw.id === attempt.frameworkId), assessment = contract.assessments.find(as => as.id === attempt.assessmentId && as.frameworkId === attempt.frameworkId);
    if (!framework || !assessment || attempt.phase !== assessment.phase || percentage(attempt) === null) throw new Error('Ungültiges Testergebnis.');
    const groups = [], modules = new Map(), expectedCourses = new Set(assessment.banks.map(bank => bank.targetCourseId)), expectedDomains = new Set(assessment.banks.map(bank => bank.domainId));
    const valid = value => value && Number.isFinite(value.score) && Number.isFinite(value.maxScore) && value.maxScore > 0 && value.score >= 0 && value.score <= value.maxScore;
    Object.entries(attempt.courses).forEach(([id, value]) => {
        const sco = contract.scos.find(course => course.id === id && course.frameworkId === framework.id);
        const module = sco && contract.modules.find(candidate => candidate.id === sco.moduleId && candidate.frameworkId === framework.id);
        if (!sco || sco.role !== 'learning' || !module || !expectedCourses.delete(id) || !valid(value)) throw new Error('Ungültige Kursgruppe im Bericht.');
        groups.push({ kind: 'Kurs', id, moduleId: module.id, number: sco.number, label: sco.label, ...value, percentage: percentage(value) });
        if (!modules.has(module.id)) modules.set(module.id, { kind: 'Modul', id: module.id, number: module.number, label: module.label, score: 0, maxScore: 0 });
        const summary = modules.get(module.id); summary.score += value.score; summary.maxScore += value.maxScore;
    });
    Object.entries(attempt.domains).forEach(([id, value]) => {
        const domain = contract.domains.find(candidate => candidate.id === id && candidate.frameworkId === framework.id);
        if (!domain || !expectedDomains.delete(id) || !valid(value)) throw new Error('Ungültige Domäne im Bericht.');
        groups.push({ kind: 'Didaktische Domäne', id, label: domain.label, ...value, percentage: percentage(value) });
    });
    const courses = groups.filter(group => group.kind === 'Kurs'), domains = groups.filter(group => group.kind === 'Didaktische Domäne');
    const domainOrder = new Map(contract.domains.filter(domain => domain.frameworkId === framework.id).map((domain, index) => [domain.id, index]));
    domains.sort((left, right) => domainOrder.get(left.id) - domainOrder.get(right.id));
    const totalsAgree = values => ['score', 'maxScore'].every(key => Math.abs(values.reduce((sum, value) => sum + value[key], 0) - attempt[key]) < 0.000001);
    if (!valid(attempt) || expectedCourses.size || expectedDomains.size || !totalsAgree(courses) || !totalsAgree(domains)) throw new Error('Unvollständige oder widersprüchliche Berichtsgruppen.');
    const moduleGroups = [...modules.values()].sort((a, b) => BigInt(a.number) < BigInt(b.number) ? -1 : BigInt(a.number) > BigInt(b.number) ? 1 : 0).map(value => ({ ...value, percentage: percentage(value) }));
    // A bounded assessment is not a score for every selected learning course.
    // Excluded areas carry labels only, never inferred zero-point results.
    const assessedCourses = new Set(courses.map(course => course.id)), assessedDomains = new Set(domains.map(domain => domain.id));
    const unassessed = {
        modules: contract.modules.filter(module => module.frameworkId === framework.id && !modules.has(module.id)).map(module => ({id:module.id, number:module.number, label:module.label})),
        courses: contract.scos.filter(course => course.frameworkId === framework.id && course.role === 'learning' && !assessedCourses.has(course.id)).map(course => ({id:course.id, moduleId:course.moduleId, number:course.number, label:course.label})),
        domains: contract.domains.filter(domain => domain.frameworkId === framework.id && !assessedDomains.has(domain.id)).map(domain => ({id:domain.id, label:domain.label}))
    };
    const safe = value => String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
    return { frameworkId: framework.id, frameworkPrefix: framework.prefix, framework: framework.label, version: framework.version, phase: assessment.phase, score: attempt.score, maxScore: attempt.maxScore, percentage: percentage(attempt), groups, modules: moduleGroups, courses, domains, unassessed,
        filename: `Ergebnis-${safe(framework.id)}-${safe(framework.version)}-${safe(assessment.phase)}-${safe(attempt.attemptId || 'attempt')}` };
}
