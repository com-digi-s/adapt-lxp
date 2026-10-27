// Presentation adapter for the ORIGINAL LXP dashboard. The contract/runtime
// remains authoritative; neither this view nor its controls parse identities.
import { progress, courseComplete } from './multiContract.js';
import { percentage } from './multiAssessment.js';
import { spoorCourseProgress } from './courseProgress.js';

const ASSETS = 'views/dashboard/';
const QUOTES = [
    ['Das Internet ist nur ein Hype', 'Bill Gates, 1997'],
    ['Das Internet ist für uns alle Neuland', 'Angela Merkel, 2013'],
    ['Im Internet finden Sie nur, was Sie suchen. Das aber verengt den Blickwinkel doch sehr', 'Frank A. Meyer'],
    ['Ins Internet bin ich, glaube ich, einmal oder zweimal bisher gegangen', 'Hans-Christian Ströbele'],
    ['In zehn Jahren ist Google tot', 'Christian DuMont Schütte, 2007'],
    ['In zwei Jahren wird das Spam-Problem gelöst sein', 'Bill Gates, 2004'],
    ['Digitalfotografie wird den Film nicht verdrängen', 'George M. Fisher, 1997'],
    ['Es gibt keinen Grund, warum jeder einen Computer zu Hause haben sollte', 'Ken Olsen, 1977'],
    ['Ich denke, dass es weltweit einen Markt für vielleicht fünf Computer gibt', 'Thomas Watson, 1943'],
    ['Daten sind das Öl des 21. Jahrhunderts, und Datenanalyse der Verbrennungsmotor', 'Peter Sondergaard'],
    ['Die Welt ist ein einziges Datenproblem', 'Andrew McAfee'],
    ['Es gibt Daten ohne Information, aber keine Information ohne Daten', 'Daniel Keys Moran'],
    ['Wir glauben an Gott. Alle anderen müssen Daten zeigen!', 'W. Edwards Deming']
];

function numericOrder(a, b) { const left = BigInt(a.number), right = BigInt(b.number); return left < right ? -1 : left > right ? 1 : 0; }
function fraction(value) { return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null; }
function phaseLabel(phase) { return phase === 'entry' ? 'Einstiegstest' : 'Abschlusstest'; }

export function courseProgressValue(record, environment = globalThis) {
    if (!record) return 0; // A selected, genuinely unstarted learning course.
    if (courseComplete(record)) return 1;
    if (record.native && record.native.format === 1 && record.native.components) {
        const required = Object.values(record.native.components).filter(component => component && component.required !== false);
        if (!required.length) return 0;
        if (!required.every(component => component.state && typeof component.state._isComplete === 'boolean')) return null;
        return required.filter(component => component.state._isComplete === true).length / required.length;
    }
    if (!record.payload) return 0;
    let payload;
    try { payload = typeof record.payload === 'string' ? JSON.parse(record.payload) : record.payload; } catch (_) { return null; }
    const serializer = environment.SCORMSuspendData;
    if (!payload || typeof payload.q !== 'string' || !serializer || typeof serializer.deserialize !== 'function') return null;
    let states;
    try { states = serializer.deserialize(payload.q); } catch (_) { return null; }
    // Opaque/unknown encodings remain unknown, not a fabricated zero grade.
    if (!Array.isArray(states) || !states.length || !states.every(state => {
        if (!Array.isArray(state) || !Array.isArray(state[0]) || state[0].length !== 2 || !state[0].every(value => Number.isInteger(value) && value >= 0)) return false;
        const flags = state.length === 2 ? state[1] : state.length === 3 && state[2] && state[2][1];
        return Array.isArray(flags) && flags.length > 0 && flags.every(value => typeof value === 'boolean');
    })) return null;
    return fraction(spoorCourseProgress(payload, () => states, false));
}

function activityRows(app, frameworkId) {
    const rows = typeof app.getLearningActivity === 'function' ? app.getLearningActivity(frameworkId) : [];
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row && typeof row.date === 'string' && Number.isFinite(row.minutes) && row.minutes >= 0)
        .map(row => ({date: row.date, minutes: row.minutes, ...(Number.isFinite(row.xp) && row.xp >= 0 ? {xp: row.xp} : {})}));
}

export function buildDashboardModel(app, frameworkId) {
    const contract = app.contract, state = app.state;
    const framework = contract.frameworks.find(candidate => candidate.id === frameworkId);
    if (!framework) throw new Error('Unbekannter Kompetenzrahmen für das Dashboard.');
    const bookmark = state.frameworkBookmarks[frameworkId] || null;
    const environment = app.content && app.content.ownerDocument && app.content.ownerDocument.defaultView || globalThis;
    const courses = new Map();
    const modules = contract.modules.filter(module => module.frameworkId === frameworkId).sort(numericOrder).map(module => {
        const selected = contract.scos.filter(sco => sco.role === 'learning' && sco.frameworkId === frameworkId && sco.moduleId === module.id).sort(numericOrder).map(sco => {
            const record = state.scoStates[sco.id];
            const value = typeof app.getCourseProgress === 'function' ? fraction(app.getCourseProgress(sco.id)) : courseProgressValue(record, environment);
            const view = { id: sco.id, frameworkId, moduleId: module.id, number: sco.number, label: sco.label, requiredForCompletion: sco.requiredForCompletion, progress: value,
                complete: courseComplete(record), bookmarked: Boolean(bookmark && bookmark.scoId === sco.id) };
            courses.set(view.id, view); return view;
        });
        return { id: module.id, frameworkId, number: module.number, label: module.label, courses: selected,
            progress: selected.length && selected.every(course => course.progress !== null) ? selected.reduce((sum, course) => sum + course.progress, 0) / selected.length : null,
            completed: selected.filter(course => course.complete).length };
    });
    const diagnostics = {};
    ['entry', 'final'].forEach(phase => {
        const availability = framework.diagnostics[phase], assessment = contract.assessments.find(candidate => candidate.frameworkId === frameworkId && candidate.phase === phase) || null;
        const stored = assessment ? (typeof app.attempts === 'function' ? app.attempts(assessment) : (state.assessmentAttempts[frameworkId] || {})[assessment.id]) : {};
        const attempts = Object.values(stored || {}).filter(attempt => attempt && attempt.completed === true && attempt.frameworkId === frameworkId && assessment && attempt.assessmentId === assessment.id && percentage(attempt) !== null)
            .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
        diagnostics[phase] = { phase, label: phaseLabel(phase), intent: availability.intent, status: availability.status, reason: availability.reason, scoId: assessment ? assessment.scoId : null, assessment, attempts };
    });
    const xp = typeof app.getExperiencePoints === 'function' ? app.getExperiencePoints(frameworkId) : null;
    return {framework: {id: framework.id, label: framework.label, version: framework.version, prefix: framework.prefix}, progress: progress(contract, state, frameworkId), bookmark, modules, diagnostics,
        pathways: contract.pathways.filter(path => path.frameworkId === frameworkId).map(path => ({id: path.id, label: path.label, courses: path.courseIds.map(id => {
            if (!courses.has(id)) throw new Error('Rahmenfremder Kurs im Lernpfad.'); return courses.get(id);
        })})), activity: activityRows(app, frameworkId), xp: Number.isFinite(xp) && xp >= 0 ? xp : null};
}

function element(doc, tag, text, attributes = {}) {
    const node = doc.createElement(tag);
    if (text !== null && text !== undefined) node.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
}
function action(doc, label, handler, attributes = {}) {
    const control = element(doc, 'button', label, {type: 'button', ...attributes});
    control.addEventListener('click', handler); return control;
}
function safely(app, operation) {
    return event => {
        if (event && event.preventDefault) event.preventDefault();
        try { return operation(); } catch (error) { if (app.warn) app.warn(error.message); else throw error; }
    };
}
function progressBar(doc, value, attributes = {}) {
    const outer = element(doc, 'span', null, {class: 'progress mb-n1 mr-3 progress-custom'});
    const inner = element(doc, 'span', null, {class: 'progress-bar bg-success', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, ...attributes});
    inner.style.width = (value === null ? 0 : value * 100) + '%';
    if (value !== null) inner.setAttribute('aria-valuenow', String(value * 100));
    else { inner.setAttribute('aria-label', 'Bearbeitungsfortschritt derzeit nicht auswertbar'); outer.setAttribute('title', 'Bearbeitungsfortschritt derzeit nicht auswertbar'); }
    outer.append(inner); return outer;
}
function infoModal(doc, owner, title, description, extra) {
    const id = 'infoModal' + owner;
    const icon = element(doc, 'i', null, {class: 'fas fa-info-circle ml-2', role: 'button', tabindex: 0, 'aria-label': 'Informationen: ' + title, 'aria-controls': id}); icon.style.cursor = 'pointer';
    const modal = element(doc, 'div', null, {class: 'modal fade', id, tabindex: -1, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + 'Label', 'aria-hidden': 'true'});
    const dialog = element(doc, 'div', null, {class: 'modal-dialog', role: 'document'}), content = element(doc, 'div', null, {class: 'modal-content'}), header = element(doc, 'div', null, {class: 'modal-header'});
    header.append(element(doc, 'h5', title, {class: 'modal-title', id: id + 'Label'}));
    const close = action(doc, '×', () => hide(), {class: 'close', 'aria-label': 'Schließen'}); header.append(close);
    const body = element(doc, 'div', description, {class: 'modal-body'}); content.append(header, body);
    if (extra) { const footer = element(doc, 'div', null, {class: 'modal-footer'}); footer.append(extra); content.append(footer); }
    dialog.append(content); modal.append(dialog); let backdrop = null, opened = false, previousFocus = null;
    function focusable() {
        return [...modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(control => !control.disabled && !control.hidden && control.getAttribute('tabindex') !== '-1' && control.getAttribute('aria-hidden') !== 'true' && (!control.getClientRects || control.getClientRects().length > 0));
    }
    function keepFocus(event) { if (opened && !modal.contains(event.target)) close.focus(); }
    function keyboard(event) {
        if (!opened) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); return; }
        if (event.key !== 'Tab') return;
        const controls = focusable(), first = controls[0] || close, last = controls[controls.length - 1] || close;
        if (!modal.contains(doc.activeElement) || event.shiftKey && doc.activeElement === first || !event.shiftKey && doc.activeElement === last) {
            event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
    }
    function detach() { if (doc.removeEventListener) { doc.removeEventListener('keydown', keyboard, true); doc.removeEventListener('focusin', keepFocus, true); } }
    function hide(returnFocus = true) {
        if (!opened) return; opened = false; detach(); modal.style.display = 'none'; modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); doc.body.classList.remove('modal-open'); if (backdrop) backdrop.remove(); backdrop = null;
        if (returnFocus) { const target = previousFocus && previousFocus.focus && previousFocus.isConnected !== false ? previousFocus : icon; target.focus(); }
    }
    function show(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); } if (opened) return;
        previousFocus = doc.activeElement; opened = true; modal.style.display = 'block'; modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false'); doc.body.classList.add('modal-open'); backdrop = element(doc, 'div', null, {class: 'modal-backdrop fade show'}); doc.body.append(backdrop);
        doc.addEventListener('keydown', keyboard, true); doc.addEventListener('focusin', keepFocus, true); close.focus();
    }
    icon.addEventListener('click', show); icon.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') show(event); });
    modal.addEventListener('click', event => { if (event.target === modal) hide(); });
    return {icon, modal, destroy: () => hide(false)};
}
function section(doc, app, id, title, description, templateId, modalOwner, modalExtra) {
    const outer = element(doc, 'section', null, {id, class: 'mx-3 my-3'}), row = element(doc, 'div', null, {class: 'row'}), column = element(doc, 'div', null, {class: 'col'});
    const card = element(doc, 'div', null, {class: id === 'competences' ? 'card' : 'card border-0'}), header = element(doc, 'div', null, {class: 'card-header bg-light text-muted border-0 d-flex align-items-center'});
    const heading = element(doc, 'h6', title, {class: 'mb-0'}); heading.style.marginRight = '0.5rem'; header.append(heading);
    const info = infoModal(doc, modalOwner, title, description, modalExtra); header.append(info.icon);
    const body = element(doc, 'div', null, {class: 'card-body'}), template = element(doc, 'div', null, {id: templateId}); body.append(template); card.append(header, body); column.append(card); row.append(column); outer.append(row);
    return {outer, template, modal: info.modal, destroy: info.destroy};
}

function renderDiagnostic(doc, app, view, target) {
    const card = element(doc, 'div', null, {class: 'card border-0'}), body = element(doc, 'div', null, {class: 'card-body p-2'});
    if (view.status !== 'provided' || !view.scoId) {
        body.append(element(doc, 'p', 'Für diesen Kompetenzrahmen ist derzeit kein ' + view.label + ' verfügbar.', {class: 'mt-2 mb-1 text-muted', 'data-diagnostic-status': 'notProvided'}));
    } else {
        body.append(element(doc, 'p', view.phase === 'entry' ? 'Wie fit sind Sie in diesen Themen?' : 'Was haben Sie dazugelernt?', {class: 'mt-2 mb-1 text-muted'}));
        body.append(action(doc, 'Zum Test', safely(app, () => app.launchSCO(view.scoId)), {class: 'btn btn-success px-3', 'data-launch-sco': view.scoId, 'aria-label': view.label + ' starten'}));
        view.attempts.forEach(attempt => {
            const row = element(doc, 'p', null, {class: 'mt-2 mb-1 text-muted'});
            row.append(element(doc, 'span', `${attempt.score}/${attempt.maxScore} Punkte · ${percentage(attempt).toFixed(1)} % `));
            const link = element(doc, 'a', 'Ergebnisbericht', {href: '#', 'data-result-attempt': attempt.attemptId}); link.addEventListener('click', safely(app, () => app.showResult(attempt))); row.append(link); body.append(row);
        });
        if (view.attempts.length) body.append(action(doc, 'Neuen Versuch beginnen', safely(app, () => app.launchSCO(view.scoId, null, {newAttempt: true})), {class: 'btn btn-link text-muted', 'data-new-attempt': view.scoId}));
    }
    card.append(body); target.append(card);
}
function courseCard(doc, app, course) {
    const node = element(doc, 'div', null, {class: 'course ' + (course.bookmarked ? 'border border-success' : 'border-0'), role: 'button', tabindex: 0, 'data-launch-sco': course.id, 'aria-label': course.number + '. ' + course.label});
    const launch = safely(app, () => app.launchSCO(course.id)); node.addEventListener('click', launch); node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') launch(event); });
    node.append(element(doc, 'a', course.number + '. ' + course.label, {class: 'course-label text-muted'}));
    const state = element(doc, 'span', course.requiredForCompletion ? '' : ' · optional', {class: 'small text-muted'}); node.append(state);
    const meter = element(doc, 'div', null, {class: 'pt-2'}); meter.style.width = '90%'; meter.append(progressBar(doc, course.progress, {'data-progress-sco': course.id})); node.append(meter);
    return node;
}
function moduleCard(doc, app, module, open = false) {
    const node = element(doc, 'div', null, {class: 'collapsible-card', 'data-module-id': module.id});
    const contentId = 'dashboard-module-' + encodeURIComponent(module.id);
    const header = element(doc, 'div', null, {class: 'card-header', role: 'button', tabindex: 0, 'aria-expanded': String(open), 'aria-controls': contentId});
    const title = element(doc, 'h6', null, {class: 'card-title font-weight-bold mb-0'}), label = element(doc, 'div', module.label); label.style.cssFloat = 'left'; label.style.width = '90%';
    label.append(progressBar(doc, module.progress, {'data-progress-module': module.id})); const arrow = element(doc, 'div', open ? '▲' : '▼', {'aria-hidden': 'true'}); arrow.style.cssFloat = 'right'; arrow.style.color = 'darkgray'; title.append(label, arrow); header.append(title);
    const body = element(doc, 'div', null, {class: 'card-body p-2', id: contentId}); body.hidden = !open;
    const grid = element(doc, 'div', null, {class: 'mb-2 course-grid row'}); module.courses.forEach(course => grid.append(courseCard(doc, app, course))); body.append(grid);
    function toggle(event) { if (event && event.preventDefault) event.preventDefault(); body.hidden = !body.hidden; header.setAttribute('aria-expanded', String(!body.hidden)); arrow.textContent = body.hidden ? '▼' : '▲'; }
    header.addEventListener('click', toggle); header.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') toggle(event); }); node.append(header, body); return node;
}

function pathways(doc, app, model) {
    if (!model.pathways.length) return null;
    const section = element(doc, 'section', null, {id: 'coursePathways', class: 'mx-3 my-3', 'data-section': 'pathways'}), card = element(doc, 'div', null, {class: 'card border-0'});
    card.append(element(doc, 'div', 'Lernpfade', {class: 'card-header bg-light text-muted border-0'}));
    const container = element(doc, 'div', null, {class: 'pathway-container card-body p-2'});
    model.pathways.forEach(path => {
        const view = element(doc, 'div', null, {class: 'pathway', 'data-pathway-id': path.id}), list = element(doc, 'ul', null, {class: 'list-inline'}); view.append(element(doc, 'h5', path.label, {class: 'pathway-title'}));
        path.courses.forEach((course, index) => {
            const module = model.modules.find(candidate => candidate.id === course.moduleId);
            const label = (model.framework.prefix === 'DigComp' ? 'M' : '') + module.number + '.' + course.number;
            const item = element(doc, 'li', null, {class: 'list-inline-item milestone' + (index < path.courses.length - 1 ? ' milestone-with-line' : ''), role: 'button', tabindex: 0, 'data-launch-sco': course.id, 'aria-label': label + ' ' + course.label});
            const icon = element(doc, 'div', null, {class: 'milestone-icon' + (course.complete ? ' completed' : '')}); icon.append(element(doc, 'i', null, {class: 'fa fa-flag text-secondary', 'aria-hidden': 'true'}));
            item.append(icon, element(doc, 'div', label, {class: 'milestone-label'})); item.setAttribute('title', label + ' ' + course.label);
            const launch = safely(app, () => app.launchSCO(course.id)); item.addEventListener('click', launch); item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') launch(event); }); list.append(item);
        }); view.append(list); container.append(view);
    }); card.append(container); section.append(card); return section;
}

function chartSection(doc, model) {
    const section = element(doc, 'section', null, {id: 'charts', class: 'mx-3'}), row = element(doc, 'div', null, {class: 'row'}), widgets = [], modals = [];
    for (const [id, title, description, owner] of [
        ['template_pulse', 'Lernpuls', 'Der Lernpuls zeigt protokollierte Lernaktivitäten in diesem Kompetenzrahmen. Fehlende Zeitdaten werden nicht geschätzt.', 'LearningPulse'],
        ['template_radar', 'Lernradar', 'Das Lernradar visualisiert die Bearbeitung der ausgewählten Module und Kurse dieses Kompetenzrahmens. Es ist kein Kompetenztest-Ergebnis.', 'LearningRadar']
    ]) {
        const col = element(doc, 'div', null, {class: 'col-md-6'}), card = element(doc, 'div', null, {class: 'chart card border-0'}), header = element(doc, 'div', null, {class: 'card-header bg-light text-muted border-0 d-flex align-items-center'});
        const heading = element(doc, 'h6', title, {class: 'mb-0'}); heading.style.marginRight = '0.5rem'; const info = infoModal(doc, owner, title, description); header.append(heading, info.icon);
        const body = element(doc, 'div', null, {class: 'card-body'}), canvas = element(doc, 'canvas', null, {id, role: 'img', 'aria-label': title + ': ' + model.framework.label}); body.append(canvas); card.append(header, body); col.append(card); row.append(col); widgets.push({id, body, canvas}); modals.push(info);
    }
    section.append(row); return {section, widgets, modals};
}
function footer(doc) {
    const footer = element(doc, 'footer', null, {class: 'mt-5 text-center border-top'}), container = element(doc, 'div', null, {class: 'container'}), row = element(doc, 'div', null, {class: 'row mt-3'});
    [['https://infai.org/', 'infai-logo.png', 'InfAI Logo'], ['https://www.wetek.de/', 'wetek-logo.png', 'WeTeK Logo'], ['https://dtecbw.de/home', 'dtecbw-logo.png', 'dtec.bw Logo']].forEach(([href, src, alt]) => {
        const col = element(doc, 'div', null, {class: 'col-md-4'}), link = element(doc, 'a', null, {href, target: '_blank', rel: 'noopener noreferrer'}), image = element(doc, 'img', null, {src: ASSETS + 'img/' + src, alt, class: 'img-fluid'}); image.style.maxHeight = '4rem'; link.append(image); col.append(link); row.append(col);
    });
    const copyrightRow = element(doc, 'div', null, {class: 'row mt-2 mb-4'}), col = element(doc, 'div', null, {class: 'col'}), text = element(doc, 'p', null, {class: 'text-muted'});
    text.append(element(doc, 'span', '© 2024 Institut für Angewandte Informatik (InfAI) e. V. & WeTeK Berlin gGmbH.'), element(doc, 'br'), element(doc, 'span', 'Der Quellcode dieses Projekts ist unter der GPL-3.0-Lizenz (GNU General Public License Version 3) lizenziert. Die Lerninhalte stehen unter der CC BY 4.0-Lizenz (Creative Commons Namensnennung 4.0 International).')); col.append(text);
    const licences = element(doc, 'div', null, {class: 'float-right'});
    [['https://www.gnu.org/licenses/gpl-3.0.de.html', 'gplv3-127x51.png', 'GNU GPL v3'], ['https://creativecommons.org/licenses/by/4.0/deed.de', 'cc-by.png', 'CC BY 4.0']].forEach(([href, src, alt]) => {const link = element(doc, 'a', null, {href, target: '_blank', rel: 'noopener noreferrer'}), image = element(doc, 'img', null, {src: ASSETS + 'img/' + src, alt, class: 'img-fluid'}); image.style.maxHeight = '2rem'; link.append(image); licences.append(link);}); copyrightRow.append(col, licences); container.append(row, copyrightRow); footer.append(container); return footer;
}

function charts(app, model, widgets) {
    const doc = app.content.ownerDocument, Chart = app.Chart || doc.defaultView && doc.defaultView.Chart || globalThis.Chart, created = [];
    const pulse = widgets.find(widget => widget.id === 'template_pulse'), radar = widgets.find(widget => widget.id === 'template_radar');
    if (!model.activity.length) { pulse.canvas.hidden = true; pulse.body.append(element(doc, 'p', 'Noch keine protokollierten Lernzeiten für diesen Kompetenzrahmen.', {class: 'text-muted small', 'data-chart-empty': 'pulse'})); }
    else if (Chart && pulse.canvas.getContext) {
        const datasets = [];
        if (model.activity.some(row => Number.isFinite(row.xp))) {
            datasets.push({label: 'Lernaktivität - XP (kumuliert)', hidden: true, data: model.activity.map(row => Number.isFinite(row.xp) ? row.xp : null), borderColor: '#ff8c00', backgroundColor: '#ff8c00', borderWidth: 1});
            datasets.push({label: 'Lernaktivität - XP (neu)', hidden: true, data: model.activity.map((row, index, rows) => index && Number.isFinite(row.xp) && Number.isFinite(rows[index - 1].xp) ? row.xp - rows[index - 1].xp : null), borderColor: '#ff8c00', backgroundColor: '#ff8c00', borderWidth: 1});
        }
        datasets.push({label: 'Lernaktivität - Zeit (Minuten)', data: model.activity.map(row => row.minutes), borderColor: '#ff8c00', backgroundColor: '#ff8c00', borderWidth: 1});
        const labels = model.activity.map(row => {const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.date); return date ? date[3] + '.' + date[2] + '.' + date[1].slice(2) : row.date;});
        created.push(new Chart(pulse.canvas.getContext('2d'), {type: 'line', data: {labels, datasets}, options: {responsive: true, maintainAspectRatio: false, scales: {x: {grid: {display: false}}, y: {beginAtZero: true, grid: {display: false}}}}}));
    }
    const known = model.modules.filter(module => module.progress !== null);
    if (!known.length) { radar.canvas.hidden = true; radar.body.append(element(doc, 'p', 'Noch kein auswertbarer Bearbeitungsstand für diese Module.', {class: 'text-muted small', 'data-chart-empty': 'radar'})); }
    else if (Chart && radar.canvas.getContext) created.push(new Chart(radar.canvas.getContext('2d'), {type: 'radar', data: {labels: known.map(module => module.label.split('&').map(line => line.trim())), datasets: [{label: 'Lernfortschritt', data: known.map(module => module.progress), backgroundColor: 'rgba(255,140,0,0.4)', borderColor: '#ff8c00', borderWidth: 1, pointBackgroundColor: '#ff8c00'}]}, options: {responsive: true, maintainAspectRatio: false, scales: {r: {min: 0, max: 1, beginAtZero: true, ticks: {callback: value => (value * 100).toFixed(0) + '%'}, pointLabels: {font: {size: 15}}}}, plugins: {tooltip: {callbacks: {label: context => 'Lernfortschritt: ' + (context.parsed.r * 100).toFixed(0) + '%'}}}}}));
    return created;
}

export function renderDashboard(app, frameworkId) {
    const doc = app.content.ownerDocument, model = buildDashboardModel(app, frameworkId), cleanups = [];
    app.content.replaceChildren(); app.content.setAttribute('data-framework-id', frameworkId); app.content.setAttribute('data-view', 'dashboard');
    const greeting = element(doc, 'section', null, {id: 'greeting', class: 'jumbotron p-4'}), quote = element(doc, 'blockquote', null, {class: 'blockquote text-center'}), chosen = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    quote.append(element(doc, 'p', chosen[0], {id: 'quote_text', class: 'lead text-white'}), element(doc, 'footer', chosen[1], {id: 'quote_author', class: 'lead text-white blockquote-footer'})); greeting.append(quote); app.content.append(greeting);
    app.content.append(element(doc, 'p', model.framework.label.includes(model.framework.version) ? model.framework.label : model.framework.label + ' · ' + model.framework.version, {class: 'sr-only', 'data-framework-label': frameworkId}));
    const entry = section(doc, app, 'entryTest', 'Einstiegstest', 'Der Einstiegstest dient dazu, Ihren Anfangsstand zu den tatsächlich enthaltenen Themen dieses Kompetenzrahmens zu ermitteln.', 'template_entryTest', 'EntryTest');
    renderDiagnostic(doc, app, model.diagnostics.entry, entry.template); app.content.append(entry.outer, entry.modal); cleanups.push(entry.destroy);
    let curriculum = null;
    if (model.framework.prefix === 'DigComp') curriculum = element(doc, 'a', 'DigComp-Lehrplan (PDF)', {href: ASSETS + 'static/2024_07_16_ Final_Lehrplan_ComDigiS.pdf', class: 'btn btn-secondary', download: ''});
    const modules = section(doc, app, 'competences', 'Module', 'Die Module und Kurse sind diesem Kompetenzrahmen ausdrücklich zugeordnet. Die Modulgruppierung ist lokal; Bearbeitungsfortschritt und Testergebnisse sind unterschiedliche Größen.', 'template_courseSelector', 'Competences', curriculum);
    const middle = element(doc, 'div', null, {class: 'middle-scos'}); model.modules.forEach(module => middle.append(moduleCard(doc, app, module))); modules.template.append(middle); app.content.append(modules.outer, modules.modal); cleanups.push(modules.destroy);
    const pathSection = pathways(doc, app, model); if (pathSection) app.content.append(pathSection);
    const chartView = chartSection(doc, model); app.content.append(chartView.section); chartView.modals.forEach(modal => {app.content.append(modal.modal); cleanups.push(modal.destroy);});
    const final = section(doc, app, 'finalTest', 'Abschlusstest', 'Der Abschlusstest prüft Ihre Ergebnisse zu den tatsächlich enthaltenen Themen dieses Kompetenzrahmens. Nach Abschluss können Sie einen Rahmen- und Test-bezogenen Ergebnisbericht herunterladen.', 'template_finalTest', 'FinalTest');
    renderDiagnostic(doc, app, model.diagnostics.final, final.template); app.content.append(final.outer, final.modal, footer(doc)); cleanups.push(final.destroy);
    const made = charts(app, model, chartView.widgets); if (Array.isArray(app.charts)) app.charts.push(...made);
    let destroyed = false;
    return {model, destroy() {
        if (destroyed) return; destroyed = true;
        made.forEach(chart => { if (chart.destroy && (!('ctx' in chart) || chart.ctx)) chart.destroy(); });
        if (Array.isArray(app.charts)) app.charts = app.charts.filter(chart => !made.includes(chart));
        cleanups.forEach(cleanup => cleanup());
    }};
}

export function renderCourseOverview(app, moduleId) {
    const module = app.contract.modules.find(candidate => candidate.id === moduleId);
    if (!module) throw new Error('Unbekannte Modul-ID.');
    const model = buildDashboardModel(app, module.frameworkId), selected = model.modules.find(candidate => candidate.id === moduleId), doc = app.content.ownerDocument;
    app.content.replaceChildren(element(doc, 'h5', selected.label, {class: 'mx-3 my-3'}), moduleCard(doc, app, selected, true));
    app.content.setAttribute('data-framework-id', module.frameworkId); app.content.setAttribute('data-view', 'module'); return selected;
}
