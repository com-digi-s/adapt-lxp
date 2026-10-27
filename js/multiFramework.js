import { validateContract, clone, launchPath, progress, courseComplete } from './multiContract.js';
import { createState, hydrateState, StateTransport, findLMS, migrateLegacy } from './multiState.js';
import { createBridge, scoRecord } from './multiBridge.js';
import { attachCorePersistence } from './corePersistence.js';
import { collectAssessment, percentage, reportData } from './multiAssessment.js';
import { spoorCourseProgress } from './courseProgress.js';
import { renderDashboard, renderCourseOverview, courseProgressValue } from './multiDashboard.js';

function node(tag, text, attributes = {}) {
    const element = document.createElement(tag);
    if (text !== null && text !== undefined) element.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
}
function button(label, action, attributes = {}) {
    const element = node('button', label, { type: 'button', class: 'btn btn-secondary', ...attributes });
    element.addEventListener('click', () => { try { action(); } catch (error) { window.App.warn(error.message); } }); return element;
}
function uid() { return globalThis.crypto && globalThis.crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
function phaseLabel(phase) { return phase === 'entry' ? 'Einstiegstest' : 'Abschlusstest'; }
function numericOrder(a, b) { const left = BigInt(a.number), right = BigInt(b.number); return left < right ? -1 : left > right ? 1 : 0; }
function frameworkLabel(framework) { return framework.label.includes(framework.version) ? framework.label : framework.label + ' · ' + framework.version; }

export class MultiFrameworkApp {
    constructor(contract, options = {}) {
        this.catalog = validateContract(contract); this.contract = this.catalog.contract; this.contexts = new WeakMap();
        this.controllers = new Map(); this.launchRecords = new Map(); this.state = createState(this.contract); this.warnings = []; this.closed = false; this.charts = [];
        const environment = options.environment || window;
        let storage = options.storage;
        if (storage === undefined) { try { storage = window.localStorage; } catch (_) { storage = null; } }
        this.transport = new StateTransport({ contract: this.contract, api: options.api === undefined ? findLMS(window) : options.api, storage,
            profileId: options.profileId || (window.CONF && window.CONF.LOCAL_PROFILE_ID), attemptId: options.attemptId || (window.CONF && window.CONF.LOCAL_ATTEMPT_ID), environment,
            onStatus: status => { this.storageStatus = status; this.renderStatus(); } });
        try {
            const loaded = hydrateState(this.contract, this.transport.load()); this.state = loaded.state; this.warnings.push(...loaded.warnings);
            if (loaded.warnings.length && this.transport.rawLoaded) {
                this.previousStateRaw = this.transport.rawLoaded;
                try { if (!storage) throw new Error('Browser-Speicher nicht verfügbar'); storage.setItem(this.transport.key + ':before-update:' + uid(), this.previousStateRaw); }
                catch (_) { this.warnings.push('Unveränderter Zustand vor dem Update liegt nur im Arbeitsspeicher. Bitte Sicherung herunterladen.'); }
            }
        } catch (error) { this.warnings.push(error.message); this.loadBlocked = true; }
        // The old global cmi.* browser keys are intentionally never read.
    }
    init() {
        document.body.classList.add('multi-framework-mode'); document.title = this.contract.package.title;
        // Keep the established shell. Only the framework selector is new;
        // existing Home/glossary/breadcrumb/help/XP nodes remain in place.
        this.header = document.querySelector('body > header');
        this.dashboardFrame = document.getElementById('sco-frame');
        if (!this.header || !this.dashboardFrame) throw new Error('Die ursprüngliche LXP-Navigation oder Inhaltsfläche fehlt.');
        this.shell = node('main', null, { id: 'multi-framework-app' });
        this.courseArea = node('section', null, { id: 'mf-course-area', hidden: '', 'aria-label': 'Lernkurs' });
        this.shell.append(this.dashboardFrame, this.courseArea); document.body.append(this.shell);
        this.dashboardFrame.setAttribute('title', 'Lernübersicht'); this.dashboardFrame.removeAttribute('style');
        const doc = this.dashboardFrame.contentDocument;
        doc.open();
        doc.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + new URL('.', window.location.href).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"><link rel="stylesheet" href="views/dashboard/css/font-awesome.css"><link rel="stylesheet" href="views/dashboard/css/bootstrap.min.css"><link rel="stylesheet" href="views/dashboard/css/dashboard.css"><link rel="stylesheet" href="css/multi-framework.css"></head><body class="mf-dashboard-document"><section id="mf-content"></section></body></html>');
        doc.close();
        this.content = doc.getElementById('mf-content');
        this.dashboardFrame.contentWindow.App = this;
        this.installNavigation();
        this.statusElement = node('details', null, { id: 'mf-storage-status', class: 'mf-storage' });
        const summary = node('summary', null, { 'aria-label': 'Speicherstatus', title: 'Speicherstatus' });
        summary.append(node('span', '●', { 'aria-hidden': 'true' }));
        this.statusText = node('p'); this.statusPanel = node('div', null, { class: 'mf-storage-panel' });
        this.statusPanel.append(this.statusText, button('Sicherung herunterladen', () => this.downloadBackup()), button('Technische Werkzeuge', () => this.showDiagnostics(), { class: 'btn btn-link' }));
        this.statusElement.append(summary, this.statusPanel);
        this.header.querySelector('.navbar-nav').append(node('li', null, { class: 'nav-item mf-storage-item' }));
        this.header.querySelector('.mf-storage-item').append(this.statusElement);
        this.feedback = node('aside', null, { id: 'mf-feedback', 'aria-live': 'polite', hidden: '' });
        this.storageAlert = node('div', null, { id: 'mf-storage-alert', role: 'alert', hidden: '' });
        this.notice = node('div', null, { id: 'mf-notices', 'aria-live': 'polite' });
        this.feedback.append(this.storageAlert, this.notice); document.body.insertBefore(this.feedback, this.shell);
        this.renderStatus(); this.renderWarnings();
        if (this.loadBlocked) {
            this.content.append(node('h1', 'Gespeicherter Zustand konnte nicht sicher geladen werden'), node('p', 'Der LMS-Zustand wird nicht überschrieben. Bitte sichern Sie den vorhandenen Zustand und wenden Sie sich an die Kursbetreuung.'));
            this.content.append(button('Vorhandene lokale Sicherung herunterladen', () => this.downloadLocalBackup())); return this;
        }
        this.showFramework(this.preferredFramework());
        window.addEventListener('beforeunload', () => this.stopApp()); window.addEventListener('unload', () => this.stopApp());
        document.addEventListener('visibilitychange', () => this.saveActive());
        window.addEventListener('resize', () => this.updateLayout());
        if (window.ResizeObserver) { this.layoutObserver = new window.ResizeObserver(() => this.updateLayout()); this.layoutObserver.observe(this.header.querySelector('#main-navbar')); this.layoutObserver.observe(this.feedback); }
        this.updateLayout();
        return this;
    }
    preferredFramework() {
        return this.catalog.frameworks.has(this.state.activeFrameworkId) ? this.state.activeFrameworkId :
            (this.contract.frameworks.find(framework => framework.prefix === 'DigComp') || this.contract.frameworks[0]).id;
    }
    installNavigation() {
        const bar = this.header.querySelector('#main-navbar .container-fluid');
        this.frameworkSelector = node('select', null, { 'data-framework-selector': '', 'aria-label': 'Kompetenzrahmen wählen', class: 'form-select form-select-sm mf-framework-selector' });
        this.contract.frameworks.forEach(framework => this.frameworkSelector.append(node('option', frameworkLabel(framework), { value: framework.id })));
        this.frameworkSelector.hidden = this.contract.frameworks.length < 2;
        this.frameworkSelector.addEventListener('change', () => this.showFramework(this.frameworkSelector.value));
        bar.insertBefore(this.frameworkSelector, this.header.querySelector('#breadcrumb-container'));
        this.header.querySelector('.navbar-brand').addEventListener('click', event => { event.preventDefault(); this.showFramework(this.preferredFramework()); });
        this.header.querySelector('.navbar-brand').setAttribute('aria-label', 'Zur Lernübersicht');
        this.installGlossary();
    }
    installGlossary() {
        const root = this.header.querySelector('#template_glossary');
        root.replaceChildren();
        const toggle = button('', () => { const open = panel.hidden; panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); if (open) input.focus(); }, { class: 'nav-link mf-glossary-toggle', 'aria-label': 'Glossar durchsuchen', 'aria-expanded': 'false' });
        toggle.append(node('i', null, { class: 'fa-solid fa-magnifying-glass fa-xl', 'aria-hidden': 'true' }));
        const panel = node('div', null, { class: 'dropdown-menu mf-glossary-menu', hidden: '' });
        const input = node('input', null, { type: 'search', class: 'form-control', placeholder: 'Begriff suchen', 'aria-label': 'Glossar durchsuchen' });
        const results = node('div', null, { class: 'mf-glossary-results', 'aria-live': 'polite' });
        const update = () => {
            results.replaceChildren();
            const terms = this.contract.glossary.filter(term => term.frameworkId === this.state.activeFrameworkId), query = input.value.trim().toLocaleLowerCase();
            if (!terms.length) { results.append(node('p', 'Für diesen Kompetenzrahmen sind keine Glossareinträge hinterlegt.', { class: 'text-muted' })); return; }
            if (query.length < 3) { results.append(node('p', 'Mindestens drei Zeichen eingeben.', { class: 'text-muted' })); return; }
            const matches = terms.filter(term => term.term.toLocaleLowerCase().includes(query) || String(term.definition || '').toLocaleLowerCase().includes(query));
            if (!matches.length) results.append(node('p', 'Keine passenden Begriffe gefunden.', { class: 'text-muted' }));
            matches.slice(0, 25).forEach(term => {
                const entry = node('article', null, { class: 'glossary-term' }); entry.append(node('strong', term.term));
                if (term.definition) entry.append(node('p', term.definition, { class: 'glossary-definition' }));
                term.targets.forEach(target => entry.append(button(this.catalog.scos.get(target.scoId).label, () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); this.launchSCO(target.scoId, target.contentId); }, { class: 'btn btn-link text-start' })));
                results.append(entry);
            });
        };
        input.addEventListener('input', update); panel.append(input, results); root.append(toggle, panel); this.refreshGlossary = () => { input.value = ''; update(); panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
        const dismiss = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if (this.statusElement) this.statusElement.open = false; };
        document.addEventListener('click', event => { if (!root.contains(event.target)) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } if (this.statusElement && !this.statusElement.contains(event.target)) this.statusElement.open = false; });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(); });
        window.addEventListener('blur', dismiss);
    }
    updateLayout() {
        const height = this.header?.querySelector('#main-navbar').getBoundingClientRect().height || 56;
        const feedbackHeight = this.feedback && !this.feedback.hidden ? this.feedback.getBoundingClientRect().height : 0;
        document.documentElement.style.setProperty('--lxp-nav-height', height + 'px');
        document.documentElement.style.setProperty('--lxp-feedback-height', feedbackHeight + 'px');
    }
    updateNavigation(sco = null) {
        const framework = this.catalog.frameworks.get(this.state.activeFrameworkId || this.preferredFramework());
        this.frameworkSelector.value = framework.id;
        if (this.statusElement) this.statusElement.open = false;
        this.dashboardFrame.setAttribute('title', 'Lernübersicht: ' + frameworkLabel(framework));
        this.header.querySelector('#breadcrumb-container').hidden = !sco;
        const list = this.header.querySelector('.breadcrumb'); list.replaceChildren();
        if (sco) {
            const item = node('li', null, { class: 'breadcrumb-item' });
            item.append(button(frameworkLabel(framework), () => this.showFramework(framework.id), { class: 'btn btn-link p-0' })); list.append(item);
            const module = this.catalog.modules.get(sco.moduleId);
            if (module) { const entry = node('li', null, { class: 'breadcrumb-item' }); entry.append(button(module.label, () => this.showModule(module.id), { class: 'btn btn-link p-0' })); list.append(entry); }
            list.append(node('li', sco.label, { class: 'breadcrumb-item active', 'aria-current': 'page', title: sco.label }));
        }
        this.updateExperience(); this.refreshGlossary(); this.updateLayout();
    }
    updateExperience() {
        const target = this.header && this.header.querySelector('#template_xp');
        if (target) { const value = this.getExperiencePoints(this.state.activeFrameworkId || this.preferredFramework()), label = (value === null ? '—' : value) + ' XP'; if (target.textContent !== label) target.textContent = label; }
    }
    getCourseProgress(scoId, absolute = false) {
        const sco = this.catalog.scos.get(scoId), record = this.state.scoStates[scoId];
        if (!sco || !record) return 0;
        const controller = this.activeContext && this.activeContext.scoId === scoId && this.controllers.get(this.activeContext.launchId);
        const models = controller && controller.Adapt && controller.Adapt.components && controller.Adapt.components.models;
        if (models && models.length) {
            const required = models.filter(model => model.get('_isAvailable') !== false && model.get('_isOptional') !== true && (typeof model.getAncestorModels !== 'function' || model.getAncestorModels().every(parent => parent.get('_isAvailable') !== false && parent.get('_isOptional') !== true)));
            const completed = required.filter(model => model.get('_isComplete') === true).length;
            if (required.length) return absolute ? completed : completed / required.length;
        }
        if (record.native && record.native.components) {
            const components = Object.values(record.native.components).filter(value => value.required !== false && value.state && typeof value.state._isComplete === 'boolean');
            if (components.length) { const completed = components.filter(value => value.state._isComplete).length; return absolute ? completed : completed / components.length; }
        }
        if (!absolute) return courseProgressValue(record, window);
        if (!record.payload) return record.native?.complete ? null : 0;
        if (!this.nativeProgressCache) this.nativeProgressCache = new Map();
        const cached = this.nativeProgressCache.get(scoId);
        if (cached && cached.payload === record.payload) return cached.completed;
        let completed = null;
        try {
            const data = JSON.parse(record.payload), serializer = window.SCORMSuspendData;
            if (courseProgressValue({ ...record, values: {}, native: null }, window) !== null && serializer && typeof serializer.deserialize === 'function') completed = spoorCourseProgress(data, value => serializer.deserialize(value), true);
        } catch (_) { /* Unknown native payloads remain opaque, including XP. */ }
        this.nativeProgressCache.set(scoId, { payload: record.payload, completed }); return completed;
    }
    getExperiencePoints(frameworkId) { const values = this.contract.scos.filter(sco => sco.frameworkId === frameworkId).map(sco => this.getCourseProgress(sco.id, true)); return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0); }
    observeLearningTime() {
        const session = this.learningSession; if (!session) return;
        const now = Date.now(), elapsed = Math.max(0, now - session.lastTick); session.lastTick = now;
        if (session.visible && elapsed) {
            const record = this.state.scoStates[session.scoId];
            if (record) {
                const date = new Date(now).toLocaleDateString('sv-SE');
                if (!record.activityMs || typeof record.activityMs !== 'object' || Array.isArray(record.activityMs)) record.activityMs = {};
                record.activityMs[date] = (Number.isFinite(record.activityMs[date]) && record.activityMs[date] >= 0 ? record.activityMs[date] : 0) + elapsed;
                const xp = this.getExperiencePoints(record.frameworkId);
                if (Number.isFinite(xp)) { if (!record.activityXP || typeof record.activityXP !== 'object' || Array.isArray(record.activityXP)) record.activityXP = {}; record.activityXP[date] = {value: xp, at: now}; }
            }
        }
        session.visible = document.visibilityState !== 'hidden';
    }
    getLearningActivity(frameworkId) {
        const days = new Map(), xpValues = new Map();
        this.contract.scos.filter(sco => sco.frameworkId === frameworkId).forEach(sco => Object.entries(this.state.scoStates[sco.id]?.activityMs || {}).forEach(([date, milliseconds]) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(milliseconds) && milliseconds >= 0) {
                days.set(date, (days.get(date) || 0) + milliseconds);
                const xp = this.state.scoStates[sco.id]?.activityXP?.[date];
                if (xp && Number.isFinite(xp.value) && xp.value >= 0 && Number.isFinite(xp.at) && (!xpValues.has(date) || xpValues.get(date).at < xp.at)) xpValues.set(date, xp);
            }
        }));
        return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, milliseconds]) => ({ date, minutes: milliseconds / 60000, ...(xpValues.has(date) ? {xp: xpValues.get(date).value} : {}) }));
    }
    renderView(_frame, path) {
        if (path !== 'views/dashboard/index.html' && path !== 'views/courses/index.html') throw new Error('Diese Ansicht ist im Lernangebot nicht verfügbar.');
        return this.showFramework(this.preferredFramework());
    }
    warn(message) { if (!this.warnings.includes(message)) this.warnings.push(message); this.renderWarnings(); }
    renderWarnings() {
        if (!this.notice) return; this.notice.replaceChildren();
        this.warnings.filter(message => !message.startsWith('Paketrevision geändert:')).forEach(message => this.notice.append(node('p', message, { role: 'alert' })));
        this.refreshFeedback();
    }
    renderStatus() {
        if (!this.statusElement) return;
        const status = this.storageStatus || this.transport.status;
        this.statusElement.className = 'mf-storage mf-storage-' + status.kind + (status.overBudget ? ' mf-storage-over-budget' : '');
        this.statusElement.querySelector('summary').setAttribute('aria-label', status.kind === 'error' ? 'Speichern fehlgeschlagen' : status.kind === 'lms' ? 'Im LMS gespeichert' : 'Lokal gespeichert');
        this.statusElement.querySelector('summary').setAttribute('title', status.kind === 'error' ? status.message : status.kind === 'lms' ? 'Im LMS gespeichert' : status.overBudget ? 'Lokal gespeichert. LMS-Freigabe offen: Speicherbudget überschritten.' : 'Lokal gespeichert');
        this.statusText.textContent = status.message;
        if (this.storageAlert) { this.storageAlert.hidden = status.kind !== 'error'; this.storageAlert.replaceChildren(); if (status.kind === 'error') this.storageAlert.append(node('span', status.message), button('Sicherung herunterladen', () => this.downloadBackup(), { class: 'btn btn-outline-danger btn-sm' })); }
        this.refreshFeedback();
    }
    refreshFeedback() { if (this.feedback) { this.feedback.hidden = this.storageAlert.hidden && !this.notice.childNodes.length; this.updateLayout(); } }
    save() {
        if (this.loadBlocked || this.closed) return false;
        this.observeLearningTime();
        const result = this.transport.save(this.state, progress(this.contract, this.state).complete);
        this.updateProgressLabels(); return result;
    }
    saveActive() {
        if (this.activeContext) {
            const controller = this.controllers.get(this.activeContext.launchId); if (controller && controller.save) controller.save();
            this.captureLocation(this.activeContext, this.SCO_FRAME && this.SCO_FRAME.contentWindow);
        }
        return this.save();
    }
    stopApp() {
        if (this.closed || this.loadBlocked) return this.finishResult;
        this.saveActive();
        // Let the active child flush its own native/Spoor finish while its
        // immutable bridge and the outer LMS session are still open.
        if (this.launchHost) { this.launchHost.remove(); this.launchHost = null; }
        this.closed = true;
        this.finishResult = this.transport.finish(this.state, progress(this.contract, this.state).complete); return this.finishResult;
    }
    closeCourse() {
        this.saveActive();
        this.learningSession = null;
        if (this.launchHost) { this.launchHost.remove(); this.launchHost = null; }
        this.SCO_FRAME = null; this.activeContext = null; this.courseArea.hidden = true;
        if (this.dashboardFrame) this.dashboardFrame.hidden = false;
    }
    resetContent() {
        if (this.dashboardView && this.dashboardView.destroy) this.dashboardView.destroy(); this.dashboardView = null;
        this.charts.forEach(chart => chart.destroy && chart.destroy()); this.charts = [];
        this.content.replaceChildren(); this.content.className = ''; this.content.hidden = false;
        if (this.dashboardFrame && typeof this.dashboardFrame.contentWindow.scrollTo === 'function') this.dashboardFrame.contentWindow.scrollTo(0, 0);
    }
    showFrameworks() {
        return this.showFramework(this.preferredFramework());
    }
    showDiagnostics() {
        if (this.loadBlocked) return;
        this.closeCourse(); this.resetContent(); this.statusElement.open = false;
        this.content.setAttribute('data-view', 'tools'); this.content.append(node('h1', 'Technische Werkzeuge'), button('Zur Lernübersicht', () => this.showFramework(this.preferredFramework())));
        this.renderMigration(); this.updateNavigation();
    }
    renderMigration() {
        const section = node('details', null, { 'data-section': 'migration' }); section.append(node('summary', 'Bekannten Altbestand migrieren'));
        section.append(node('p', 'Nur für nachgewiesene alte Paketidentitäten mit bestätigter Alias-Tabelle und kompatiblen Fingerabdrücken. Globale Browserwerte werden nicht automatisch übernommen. Die Originaldaten werden vor der Übernahme gesichert.'));
        const envelopeInput = node('input', null, { type: 'file', accept: 'application/json,.json', id: 'mf-legacy-envelope' });
        const planInput = node('input', null, { type: 'file', accept: 'application/json,.json', id: 'mf-legacy-plan' });
        const envelopeLabel = node('label', 'Gesicherter Altzustand ', { for: 'mf-legacy-envelope' }), planLabel = node('label', 'Geprüfte Alias-Tabelle ', { for: 'mf-legacy-plan' });
        envelopeLabel.append(envelopeInput); planLabel.append(planInput);
        const confirmLabel = node('label', ' Ich bestätige Quellpaket, Revision und geprüfte Alias-Zuordnung. '), confirm = node('input', null, { type: 'checkbox' }); confirmLabel.prepend(confirm);
        const status = node('p', null, { role: 'status' });
        const start = button('Geprüfte Migration starten', async () => {
            try {
                if (!confirm.checked || !envelopeInput.files.length || !planInput.files.length) throw new Error('Altzustand, Alias-Tabelle und ausdrückliche Bestätigung fehlen.');
                const envelope = JSON.parse(await envelopeInput.files[0].text()), plan = JSON.parse(await planInput.files[0].text());
                const result = this.importLegacy(envelope, { ...plan, confirmed: true });
                if (result.backup) this.downloadJSON('LXP-Migrationssicherung-' + String(plan.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json', result.backup);
                status.textContent = result.report.alreadyApplied ? 'Diese Migration wurde bereits ausgeführt; nichts dupliziert.' : `${result.report.migrated.length} Kurse übernommen. Nicht übernommen: ${result.report.rejected.join(', ') || 'keine'}.`;
            } catch (error) { status.textContent = error.message; this.warn(error.message); }
        });
        section.append(envelopeLabel, node('br'), planLabel, node('br'), confirmLabel, node('br'), start, status); this.content.append(section);
    }
    progressLabel(frameworkId) {
        const element = node('p', null, { 'data-progress-framework': frameworkId || '*', class: 'mf-progress' }); this.fillProgressLabel(element, frameworkId); return element;
    }
    fillProgressLabel(element, frameworkId) {
        const value = progress(this.contract, this.state, frameworkId);
        element.textContent = `${frameworkId ? 'Rahmenfortschritt' : 'Paketfortschritt'}: ${value.completed}/${value.required} Pflicht-Lernkurse${value.fraction === null ? ' · kein Pflichtumfang' : ' · ' + Math.round(value.fraction * 100) + ' %'}${value.complete ? ' · abgeschlossen' : ' · offen'}`;
    }
    updateProgressLabels() {
        if (!this.shell) return;
        this.shell.querySelectorAll('[data-progress-framework]').forEach(element => this.fillProgressLabel(element, element.getAttribute('data-progress-framework') === '*' ? null : element.getAttribute('data-progress-framework')));
        this.updateExperience();
    }
    showFramework(frameworkId) {
        if (this.loadBlocked) return;
        const framework = this.catalog.frameworks.get(frameworkId); if (!framework) throw new Error('Unbekannter Kompetenzrahmen.');
        this.closeCourse(); this.resetContent(); this.state.activeFrameworkId = frameworkId; this.save();
        this.updateNavigation();
        this.dashboardView = renderDashboard(this, frameworkId);
    }
    showModule(moduleId) {
        const module = this.catalog.modules.get(moduleId); if (!module) throw new Error('Unbekanntes Modul.');
        this.showFramework(module.frameworkId); this.resetContent(); renderCourseOverview(this, moduleId);
    }
    renderUnadaptedFramework(frameworkId) {
        const framework = this.catalog.frameworks.get(frameworkId);
        this.content.append(node('h1', framework.label + ' · ' + framework.version), this.progressLabel(frameworkId));
        const bookmark = this.state.frameworkBookmarks[frameworkId];
        if (bookmark) this.content.append(button('Letzten Kurs fortsetzen', () => this.launchSCO(bookmark.scoId, bookmark.contentId), { 'data-resume-framework': frameworkId }));
        const tests = node('section', null, { class: 'mf-tests' }); tests.append(node('h2', 'Diagnostik'));
        ['entry', 'final'].forEach(phase => {
            const diagnostic = framework.diagnostics[phase], section = node('article', null, { class: 'mf-card', 'data-test-phase': phase });
            section.append(node('h3', phaseLabel(phase)));
            if (diagnostic.status === 'notProvided') section.append(node('p', diagnostic.reason === 'not-requested' ? 'Nicht bereitgestellt: nicht angefordert. Kein Testergebnis verfügbar.' : 'Nicht bereitgestellt: keine zugeordneten Diagnosefragen. Kein Testergebnis verfügbar.'));
            else {
                const assessment = this.contract.assessments.find(as => as.frameworkId === frameworkId && as.phase === phase);
                section.append(button(phaseLabel(phase) + ' öffnen', () => this.launchSCO(assessment.scoId), { 'data-launch-sco': assessment.scoId }));
                const attempts = this.attempts(assessment), previous = Object.values(attempts).filter(attempt => attempt.completed).sort((a,b) => String(a.completedAt).localeCompare(String(b.completedAt)));
                previous.forEach(attempt => {
                    const value = percentage(attempt);
                    section.append(node('p', value === null ? 'Ergebnis ungültig – bitte Kursbetreuung informieren.' : `${attempt.score}/${attempt.maxScore} Punkte · ${value.toFixed(1)} %`));
                    if (value !== null) section.append(button('Ergebnisbericht', () => this.showResult(attempt), { 'data-result-attempt': attempt.attemptId }));
                });
                if (previous.length) section.append(button('Neuen Versuch beginnen', () => this.launchSCO(assessment.scoId, null, { newAttempt: true })));
            }
            tests.append(section);
        }); this.content.append(tests);
        this.contract.modules.filter(mod => mod.frameworkId === frameworkId).sort(numericOrder).forEach(mod => {
            const section = node('section', null, { class: 'mf-module', 'data-module-id': mod.id }); section.append(node('h2', 'Modul ' + mod.number + ' · ' + mod.label));
            this.contract.scos.filter(sco => sco.moduleId === mod.id && sco.role === 'learning').sort(numericOrder).forEach(sco => {
                const row = node('article', null, { class: 'mf-course-card', 'data-course-id': sco.id });
                row.append(node('h3', sco.number + ' · ' + sco.label), node('p', `${sco.requiredForCompletion ? 'Pflicht-Lernkurs' : 'Optionaler Lernkurs'} · ${courseComplete(this.state.scoStates[sco.id]) ? 'abgeschlossen' : 'offen'}`), button('Kurs öffnen', () => this.launchSCO(sco.id), { 'data-launch-sco': sco.id })); section.append(row);
            }); this.content.append(section);
        });
        this.renderPathways(frameworkId); this.renderGlossary(frameworkId); this.renderRadar(frameworkId);
    }
    renderPathways(frameworkId) {
        const section = node('section', null, { 'data-section': 'pathways' }); section.append(node('h2', 'Lernpfade'));
        const pathways = this.contract.pathways.filter(path => path.frameworkId === frameworkId);
        if (!pathways.length) section.append(node('p', 'Keine Lernpfade für diesen Kompetenzrahmen hinterlegt.'));
        pathways.forEach(path => { const list = node('ol'); section.append(node('h3', path.label), list); path.courseIds.forEach(id => { const item = node('li'); item.append(button(this.catalog.scos.get(id).label, () => this.launchSCO(id))); list.append(item); }); });
        this.content.append(section);
    }
    renderGlossary(frameworkId) {
        const section = node('section', null, { 'data-section': 'glossary' }); section.append(node('h2', 'Glossar'));
        const terms = this.contract.glossary.filter(term => term.frameworkId === frameworkId);
        if (!terms.length) section.append(node('p', 'Keine Glossareinträge für diesen Kompetenzrahmen hinterlegt.'));
        terms.forEach(term => {
            const entry = node('details'); entry.append(node('summary', term.term)); if (term.definition) entry.append(node('p', term.definition));
            term.targets.forEach(target => entry.append(button('Im Kurs: ' + this.catalog.scos.get(target.scoId).label, () => this.launchSCO(target.scoId, target.contentId)))); section.append(entry);
        }); this.content.append(section);
    }
    renderRadar(frameworkId) {
        const section = node('section', null, { 'data-section': 'radar' }); section.append(node('h2', 'Diagnostik nach didaktischer Domäne'));
        const latest = this.contract.assessments.filter(as => as.frameworkId === frameworkId).flatMap(as => Object.values(this.attempts(as)).filter(attempt => attempt.completed)).sort((a,b) => String(a.completedAt).localeCompare(String(b.completedAt))).pop();
        if (!latest) { section.append(node('p', 'Noch kein auswertbarer Test für diesen Kompetenzrahmen. Keine Kompetenzwerte abgeleitet.')); this.content.append(section); return; }
        const report = reportData(this.contract, latest), values = report.groups.filter(group => group.kind === 'Didaktische Domäne');
        section.append(node('p', `${phaseLabel(latest.phase)} · ${report.framework} · ${report.version}. Werte beziehen sich nur auf die tatsächlich enthaltenen Testfragen.`));
        const list = node('ul'); values.forEach(value => list.append(node('li', `${value.label}: ${value.score}/${value.maxScore} · ${value.percentage.toFixed(1)} %`))); section.append(list);
        if (window.Chart && values.length >= 3) {
            const container = node('div', null, { class: 'mf-chart' }), canvas = node('canvas', null, { 'aria-label': 'Testergebnisse nach konfigurierter didaktischer Domäne', role: 'img' }); container.append(canvas); section.append(container);
            this.charts.push(new window.Chart(canvas.getContext('2d'), { type: 'radar', data: { labels: values.map(value => value.label), datasets: [{ label: phaseLabel(latest.phase), data: values.map(value => value.percentage), backgroundColor: 'rgba(37,99,135,.15)', borderColor: '#256387' }] }, options: { responsive: true, scales: { r: { min: 0, max: 100 } } } }));
        } else section.append(node('p', 'Radar benötigt mindestens drei ausdrücklich konfigurierte Domänen; die vorhandenen Werte stehen in der Liste.'));
        this.content.append(section);
    }
    attempts(assessment) { return (this.state.assessmentAttempts[assessment.frameworkId] || {})[assessment.id] || {}; }
    recordLocation(context, contentId) {
        const bookmark = this.state.frameworkBookmarks[context.frameworkId];
        // A late old launch can update its own state, not overwrite a newer bookmark.
        const record = this.launchRecords.get(context.launchId) || scoRecord(this, context); record.contentId = contentId;
        if (bookmark && bookmark.scoId === context.scoId && this.activeContext && this.activeContext.launchId === context.launchId) bookmark.contentId = contentId;
    }
    captureLocation(context, childWindow) {
        try {
            const fragment = childWindow.location.hash;
            if (fragment.startsWith('#/id/')) this.recordLocation(context, decodeURIComponent(fragment.slice(5)));
        } catch (_) { /* A trusted same-origin SCO may be between documents. */ }
    }
    launchSCO(scoId, contentId, options = {}) {
        const sco = this.catalog.scos.get(scoId); if (!sco) throw new Error('Kurs-ID nicht im Produktvertrag.');
        const stored = this.state.scoStates[scoId], remembered = this.state.frameworkBookmarks[sco.frameworkId];
        const location = contentId === undefined ? (remembered && remembered.scoId === scoId ? remembered.contentId : stored && stored.contentId) : contentId;
        const path = launchPath(sco, location); // Validate before bookmark or iframe mutation.
        if (this.closed || this.loadBlocked) throw new Error('Laufzeit ist geschlossen oder wegen Speicherfehler gesperrt.');
        this.closeCourse(); this.resetContent(); this.content.hidden = true; this.courseArea.hidden = false;
        this.dashboardFrame.hidden = true;
        this.state.activeFrameworkId = sco.frameworkId;
        const assessment = this.contract.assessments.find(as => as.scoId === sco.id);
        let context = { scoId, frameworkId: sco.frameworkId, role: sco.role, assessmentId: assessment ? assessment.id : null, launchId: uid() };
        if (options.newAttempt) delete this.state.scoStates[scoId];
        const record = scoRecord(this, context);
        if (assessment) {
            if (!record.activeAttemptId) record.activeAttemptId = uid();
            if (!this.state.assessmentAttempts[sco.frameworkId]) this.state.assessmentAttempts[sco.frameworkId] = {};
            if (!this.state.assessmentAttempts[sco.frameworkId][assessment.id]) this.state.assessmentAttempts[sco.frameworkId][assessment.id] = {};
            const attempts = this.state.assessmentAttempts[sco.frameworkId][assessment.id];
            if (!attempts[record.activeAttemptId]) attempts[record.activeAttemptId] = { attemptId: record.activeAttemptId, frameworkId: sco.frameworkId, assessmentId: assessment.id, phase: assessment.phase, startedAt: new Date().toISOString(), completed: false };
        }
        context = Object.freeze({ ...context, attemptId: record.activeAttemptId || null });
        this.launchRecords.set(context.launchId, record);
        this.activeContext = context; this.state.frameworkBookmarks[sco.frameworkId] = { scoId, contentId: location || null };
        this.courseArea.replaceChildren();
        if (assessment) { const toolbar = node('div', null, { class: 'mf-course-toolbar' }); toolbar.append(button('Testergebnis anzeigen', () => this.calculateActiveResult(), { class: 'btn btn-outline-secondary btn-sm', 'data-action': 'test-result' })); this.courseArea.append(toolbar); }
        // Each launch has a permanent API-bearing parent window. A genuine outer
        // API is never overwritten, and an old SCO cannot acquire a new bridge.
        const host = node('iframe', null, { class: 'mf-bridge-host', title: sco.label, 'data-sco-id': scoId, 'data-launch-id': context.launchId, allowfullscreen: '' });
        this.launchHost = host; this.courseArea.append(host);
        const hostWindow = host.contentWindow, doc = host.contentDocument;
        doc.documentElement.lang = document.documentElement.lang; doc.body.style.margin = '0'; doc.documentElement.style.height = doc.body.style.height = '100%';
        hostWindow.App = this; hostWindow.__lxpLaunchContext = context; hostWindow.API = createBridge(this, context);
        const frame = doc.createElement('iframe'); frame.id = 'sco-frame'; frame.title = sco.label; frame.setAttribute('allowfullscreen', ''); frame.style.cssText = 'border:0;width:100%;height:100%;display:block';
        doc.body.append(frame); this.SCO_FRAME = frame; this.contexts.set(frame.contentWindow, context);
        frame.addEventListener('load', () => this.bindChild(frame, context));
        this.learningSession = { scoId, lastTick: Date.now(), visible: document.visibilityState !== 'hidden' };
        this.updateNavigation(sco);
        frame.src = path; this.save(); return context;
    }
    bindChild(frame, context) {
        const childWindow = frame.contentWindow;
        this.contexts.set(childWindow, context);
        try {
            childWindow.addEventListener('hashchange', () => { this.captureLocation(context, childWindow); this.save(); });
            childWindow.addEventListener('beforeunload', () => { const controller = this.controllers.get(context.launchId); if (controller && controller.save) controller.save(); this.captureLocation(context, childWindow); this.save(); });
            // Published bundles attach through the injected bootstrap before
            // iframe load. Their internal __AMD modules are not necessarily in
            // the public RequireJS registry. Never request a guessed URL.
            if (this.controllers.has(context.launchId)) return;
            const loader = childWindow.require;
            if (typeof loader === 'function' && typeof loader.defined === 'function') {
                const name = ['core/js/adapt', 'coreJS/adapt'].find(id => loader.defined(id));
                if (name) this.attachAdaptPersistence(loader(name), childWindow);
            }
        } catch (error) { this.warn(`Kursanbindung fehlgeschlagen: ${error.message}`); }
    }
    attachAdaptPersistence(Adapt, childWindow) {
        const context = this.contexts.get(childWindow);
        if (!context) throw new Error('Adapt-Kindfenster besitzt keinen unveränderlichen Startkontext.');
        if (Adapt.__multiLXPController) return Adapt.__multiLXPController;
        const record = scoRecord(this, context);
        const facade = { DATA: { 'cmi.suspend_data': { adaptData: {}, customData: { nativeAdapt: record.native ? { [context.scoId]: clone(record.native) } : {} } } }, SCORM_API: {} };
        facade.SCORM_API.set = () => {
            const native = facade.DATA['cmi.suspend_data'].customData.nativeAdapt[context.scoId]; if (native) record.native = clone(native);
            this.captureLocation(context, childWindow); this.save();
        };
        const controller = attachCorePersistence(facade, Adapt, childWindow, context.scoId);
        Adapt.__multiLXPController = controller; this.controllers.set(context.launchId, controller);
        const observe = () => {
            if (controller.__multiObserved || !Adapt.course || !Adapt.components || !Adapt.components.models.length) return;
            controller.__multiObserved = true; controller.Adapt = Adapt; controller.context = context;
            const complete = () => {
                if (Adapt.course.get('_isComplete') === true) {
                    record.values['cmi.core.lesson_status'] = 'completed';
                    if (context.assessmentId) { try { this.calculateResult(Adapt, context); } catch (error) { this.warn(error.message); } }
                }
                this.save();
            };
            Adapt.course.on('change:_isComplete', complete);
            Adapt.on('router:location', () => { this.captureLocation(context, childWindow); this.save(); });
            if (Adapt.course.get('_isComplete') === true) complete();
        };
        Adapt.on('app:dataReady', observe); observe(); return controller;
    }
    calculateResult(Adapt, context) {
        if (!Adapt.course || Adapt.course.get('_isComplete') !== true) throw new Error('Test noch nicht abgeschlossen. Es wird kein Ergebnis erfunden.');
        const value = collectAssessment(this.contract, context, Adapt.components.models, Adapt.blocks.models);
        const attempts = this.state.assessmentAttempts[context.frameworkId][context.assessmentId], previous = attempts[context.attemptId];
        if (!previous) throw new Error('Testversuch besitzt keine gebundene Versuch-ID.');
        const result = { ...previous, ...value, completed: true, completedAt: previous.completedAt || new Date().toISOString() };
        attempts[context.attemptId] = result; this.save(); return result;
    }
    calculateActiveResult() {
        const context = this.activeContext, controller = context && this.controllers.get(context.launchId);
        if (!controller || !controller.Adapt) throw new Error('Testanbindung noch nicht bereit.');
        const result = this.calculateResult(controller.Adapt, context); this.showResult(result);
    }
    showResult(attempt) {
        const report = reportData(this.contract, attempt); this.closeCourse(); this.resetContent();
        this.state.activeFrameworkId = attempt.frameworkId; this.updateNavigation();
        this.content.setAttribute('data-view', 'results'); this.content.className = 'mf-results container-fluid py-3';
        this.content.append(button('Zur Lernübersicht', () => this.showFramework(attempt.frameworkId)), node('h1', frameworkLabel(this.catalog.frameworks.get(attempt.frameworkId)) + ' · ' + phaseLabel(report.phase)), node('p', `${report.score}/${report.maxScore} Punkte · ${report.percentage.toFixed(1)} %`, { class: 'lead' }), node('p', 'Ergebnis der tatsächlich enthaltenen Testfragen. Die Auswertung gehört ausschließlich zu diesem Kompetenzrahmen.', { class: 'text-muted' }));
        const list = node('ul'); report.groups.forEach(group => list.append(node('li', `${group.kind}: ${group.label} · ${group.score}/${group.maxScore} · ${group.percentage.toFixed(1)} %`))); this.content.append(list);
        this.content.append(button('Bericht als PDF herunterladen', () => this.downloadReport(attempt), { class: 'btn btn-success mr-2' }), button('Rohdaten als JSON herunterladen', () => this.downloadJSON(report.filename + '.json', { ...report, attempt }), { class: 'btn btn-secondary' }));
    }
    downloadReport(attempt) {
        const report = reportData(this.contract, attempt);
        if (!window.jspdf) throw new Error('PDF-Bibliothek nicht verfügbar. Rohdaten können als JSON gesichert werden.');
        const doc = new window.jspdf.jsPDF(); let y = 20;
        const lines = [report.framework + ' · ' + report.version, phaseLabel(report.phase), `${report.score}/${report.maxScore} Punkte · ${report.percentage.toFixed(1)} %`, 'Bezug: tatsächliche Testfragen, keine Gesamtaussage über beide Rahmen.', ...report.groups.map(group => `${group.kind}: ${group.label} – ${group.score}/${group.maxScore} (${group.percentage.toFixed(1)} %)` )];
        doc.setFontSize(12); lines.forEach(line => { const wrapped = doc.splitTextToSize(line, 175); if (y + wrapped.length * 7 > 280) { doc.addPage(); y = 20; } doc.text(wrapped, 18, y); y += wrapped.length * 7 + 4; }); doc.save(report.filename + '.pdf');
    }
    downloadJSON(filename, data) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
        const link = node('a', filename, { href: url, download: filename }); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    downloadBackup() { this.downloadJSON('LXP-Sicherung-' + this.contract.package.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json', { packageId: this.contract.package.id, revision: this.contract.package.revision, state: this.state, previousStateRaw: this.previousStateRaw || null, rejectedStateRaw: this.loadBlocked ? this.transport.rawLoaded : null, storageStatus: this.transport.status }); }
    downloadLocalBackup() {
        const raw = this.transport.rawLoaded;
        this.downloadJSON('LXP-unveraenderte-lokale-Sicherung.json', { key: this.transport.key, raw });
    }
    importLegacy(envelope, plan) {
        if (this.loadBlocked) throw new Error('Gespeicherter Zustand ist gesperrt.');
        const result = migrateLegacy(this.contract, envelope, plan, this.state);
        if (result.backup) {
            // Persist the exact input BEFORE accepting the migration result.
            if (!this.transport.storage) throw new Error('Migration benötigt eine unbeschädigte lokale Sicherung.');
            this.transport.storage.setItem(this.transport.key + ':migration-backup:' + encodeURIComponent(plan.id), JSON.stringify(result.backup));
        }
        this.state = result.state; this.save(); this.warn(result.report.alreadyApplied ? 'Migration bereits ausgeführt; keine Daten dupliziert.' : 'Migration: ' + result.report.migrated.length + ' Kurse übernommen; ' + result.report.rejected.length + ' Einträge nicht übernommen.'); return result;
    }
}
export default MultiFrameworkApp;
