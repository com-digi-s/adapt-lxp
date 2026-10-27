// The established ComDigiS report presentation, backed by explicit framework
// mappings. Reporting never changes answers, grades or the saved attempt.
import { reportData } from './multiAssessment.js';

const phaseLabel = phase => phase === 'entry' ? 'Einstiegstest' : 'Abschlusstest';
const percent = value => value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const frameworkLabel = report => report.framework.includes(report.version) ? report.framework : report.framework + ' · ' + report.version;
const scope = 'Die Werte beziehen sich auf die enthaltenen Testfragen, nicht auf den gesamten Kompetenzrahmen.';
const domainDescription = 'Verstehen: Zusammenhänge erkennen. Anwenden: Wissen in Situationen einsetzen. Bewerten: Entscheidungen begründen und kritisch prüfen.';
const unassessedDescription = 'Für diese Bereiche enthält dieser Test keine Fragen. Nicht geprüft bedeutet nicht 0 %.';
const unassessedKinds = [['modules', 'Module'], ['courses', 'Kurse'], ['domains', 'Kognitive Domänen']];
const logos = [
    { file: 'digitaks-logo.png', label: 'DigiTaKS*' },
    { file: 'dtecbw-logo.png', label: 'dtec.bw' },
    { file: 'wetek-logo.png', label: 'WeTeK' },
    { file: 'infai-logo.png', label: 'InfAI' }
];
function node(doc, tag, text, attributes = {}) {
    const element = doc.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
}
function action(doc, text, callback, attributes = {}) {
    const element = node(doc, 'button', text, { type: 'button', class: 'btn btn-secondary', ...attributes });
    element.addEventListener('click', callback); return element;
}
function person(app) {
    try {
        const value = app.transport && app.transport.connected && app.transport.get('cmi.core.student_name');
        if (typeof value === 'string' && value.trim() && !['null', 'undefined', 'Anonymous User'].includes(value.trim())) return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    } catch (_) { /* An optional name must never block a learner's report. */ }
    return 'Anonym';
}
function tiles(doc, title, values, kind) {
    const section = node(doc, 'section', null, { class: 'mf-report-section', 'data-report-section': kind });
    section.append(node(doc, 'h2', title));
    const grid = node(doc, 'div', null, { class: 'mf-report-grid' });
    values.forEach(value => {
        const tile = node(doc, 'article', null, { class: 'mf-report-tile', 'data-report-group': value.id, [kind === 'modules' ? 'data-report-module' : 'data-report-domain']: value.id });
        if (kind === 'modules') tile.append(node(doc, 'p', 'Modul ' + value.number, { class: 'mf-report-number' }));
        tile.append(node(doc, 'h3', value.label), node(doc, 'p', percent(value.percentage), { class: 'mf-report-percentage' }), node(doc, 'p', `${value.score}/${value.maxScore} Punkte`, { class: 'text-muted mb-0' }));
        grid.append(tile);
    });
    section.append(grid); return section;
}

export function renderResult(app, attempt) {
    const report = reportData(app.contract, attempt), content = app.content, doc = content.ownerDocument;
    content.setAttribute('data-view', 'results'); content.className = 'mf-results mf-report container-fluid py-3';
    content.append(action(doc, 'Zur Lernübersicht', () => app.showFramework(attempt.frameworkId), { class: 'btn btn-outline-secondary mb-3' }));
    const heading = node(doc, 'header', null, { class: 'mf-report-heading' });
    const title = node(doc, 'div');
    title.append(node(doc, 'p', 'ComDigiS* · ' + frameworkLabel(report), { class: 'text-muted mb-1' }), node(doc, 'h1', phaseLabel(report.phase), { id: 'mf-report-title', tabindex: '-1' }), node(doc, 'p', `${report.score}/${report.maxScore} Punkte · ${percent(report.percentage)}`, { class: 'lead mb-1' }));
    heading.append(title, node(doc, 'img', null, { src: 'img/digitaks-logo.png', alt: 'DigiTaKS*', class: 'mf-report-project-logo' }));
    content.append(heading, node(doc, 'p', 'Geschafft! Hier sehen Sie, in welchen Themen und kognitiven Domänen Sie bereits sicher sind und wo sich weiteres Üben lohnt.'));
    const actions = node(doc, 'div', null, { class: 'mf-report-actions' });
    const download = action(doc, 'Ergebnisbericht als PDF herunterladen', async () => {
        if (download.disabled) return;
        download.disabled = true;
        try { await downloadResultPDF(app, attempt); }
        catch (_) { /* The inline status explains retry without losing results. */ }
        finally { download.disabled = false; }
    }, { class: 'btn btn-success', 'data-action': 'download-report' });
    actions.append(download, node(doc, 'p', '', { class: 'text-muted mb-0', role: 'status', 'aria-live': 'polite', 'data-report-feedback': '' }));
    const assessment = app.contract.assessments.find(candidate => candidate.id === attempt.assessmentId && candidate.frameworkId === attempt.frameworkId);
    if (attempt.completed && app.state?.scoStates?.[assessment.scoId]?.activeAttemptId === attempt.attemptId) {
        actions.append(action(doc, 'Antworten ansehen', () => app.launchSCO(assessment.scoId, undefined, { review: true }), { class: 'btn btn-outline-secondary', 'data-action': 'review-answers' }));
    }
    content.append(actions, tiles(doc, 'Module', report.modules, 'modules'));
    const domains = tiles(doc, 'Kognitive Domänen', report.domains, 'domains');
    if (report.domains.every(value => ['verstehen', 'anwenden', 'bewerten'].includes(value.label.toLocaleLowerCase()))) domains.append(node(doc, 'p', domainDescription, { class: 'text-muted mt-2' }));
    content.append(domains);
    const details = node(doc, 'details', null, { class: 'mf-report-course-details' });
    details.append(node(doc, 'summary', 'Ergebnisse je Kurs'));
    const list = node(doc, 'ul', null, { class: 'mt-2' });
    report.courses.forEach(value => list.append(node(doc, 'li', `${value.label}: ${value.score}/${value.maxScore} Punkte · ${percent(value.percentage)}`)));
    details.append(list); content.append(details, node(doc, 'p', scope, { class: 'text-muted mf-report-scope' }));
    if (unassessedKinds.some(([kind]) => report.unassessed[kind].length)) {
        const excluded = node(doc, 'details', null, { class: 'mf-report-course-details', 'data-report-unassessed': '' });
        excluded.append(node(doc, 'summary', 'Nicht geprüfte Bereiche'), node(doc, 'p', unassessedDescription, { class: 'text-muted mt-2' }));
        unassessedKinds.forEach(([kind, title]) => {
            if (!report.unassessed[kind].length) return;
            excluded.append(node(doc, 'h3', title, { class: 'h6' }));
            const list = node(doc, 'ul');
            report.unassessed[kind].forEach(value => list.append(node(doc, 'li', (kind === 'modules' ? 'Modul ' + value.number + ' · ' : '') + value.label)));
            excluded.append(list);
        });
        content.append(excluded);
    }
    const footer = node(doc, 'footer', null, { class: 'mf-report-footer' });
    footer.append(node(doc, 'p', 'ComDigiS* wurde im Rahmen des Verbundprojekts DigiTaKS* entwickelt.', { class: 'text-muted' }));
    const partners = node(doc, 'div', null, { class: 'mf-report-partners' });
    logos.slice(1).forEach(logo => partners.append(node(doc, 'img', null, { src: 'img/' + logo.file, alt: logo.label })));
    footer.append(partners); content.append(footer);
    return report;
}

async function browserLogo(file) {
    return new Promise((resolve, reject) => {
        const image = new window.Image();
        const timer = window.setTimeout(() => reject(new Error('Logo konnte nicht geladen werden.')), 5000);
        image.onload = () => { window.clearTimeout(timer); resolve({ image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }); };
        image.onerror = () => { window.clearTimeout(timer); reject(new Error('Logo konnte nicht geladen werden.')); };
        image.src = new URL('img/' + file, window.location.href).href;
    });
}

export async function downloadResultPDF(app, attempt, options = {}) {
    const feedback = app.content && app.content.querySelector('[data-report-feedback]');
    const say = text => { if (feedback) feedback.textContent = text; };
    say('Ergebnisbericht wird erstellt …');
    try {
        const report = reportData(app.contract, attempt), PDF = options.PDF || window.jspdf && window.jspdf.jsPDF;
        if (!PDF) throw new Error('PDF-Bibliothek ist nicht verfügbar.');
        const loaded = await Promise.all(logos.map(async logo => {
            try { return { ...logo, ...(await (options.loadImage || browserLogo)(logo.file)) }; }
            catch (_) { return { ...logo, missing: true }; }
        }));
        const doc = new PDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const margin = 16, width = 178, bottom = 263;
        let y = 0, page = 0;
        const split = (text, size, available = width) => { doc.setFontSize(size); return doc.splitTextToSize(String(text), available); };
        const put = (text, x, top, size, available = width) => { const lines = split(text, size, available); doc.text(lines, x, top); return lines.length * size * .43; };
        const header = () => {
            page++; y = 20;
            doc.setTextColor(35, 35, 35);
            y += put('ComDigiS* ' + phaseLabel(report.phase), margin, y, 20, 142) + 4;
            y += put(frameworkLabel(report), margin, y, 11, 142) + 3;
            const logo = loaded[0];
            if (!logo.missing) doc.addImage(logo.image, 'PNG', 164, 14, 30, Math.min(22, 30 * logo.height / logo.width));
            y += 5;
        };
        const nextPage = () => { doc.addPage(); header(); };
        const paragraph = (text, size = 10, gap = 4) => {
            const lines = split(text, size); const height = size * .43;
            for (const line of lines) { if (y + height > bottom) nextPage(); doc.text(line, margin, y); y += height; }
            y += gap;
        };
        const section = (title, values, kind) => {
            if (y + 26 > bottom) nextPage();
            paragraph(title, 15, 4);
            const gap = 5, columns = 3, tileWidth = (width - gap * (columns - 1)) / columns;
            for (let index = 0; index < values.length; index += columns) {
                const row = values.slice(index, index + columns);
                const tileData = row.map(value => {
                    const label = split(value.label, 10, tileWidth - 8);
                    return { value, label, height: Math.max(36, label.length * 4.3 + (kind === 'modules' ? 31 : 25)) };
                });
                const height = Math.max(...tileData.map(tile => tile.height));
                if (y + height > bottom) { nextPage(); paragraph(title + ' (Fortsetzung)', 15, 4); }
                tileData.forEach((tile, column) => {
                    const x = margin + column * (tileWidth + gap);
                    doc.setDrawColor(180, 180, 180); doc.setFillColor(249, 249, 249); doc.rect(x, y, tileWidth, height, 'FD');
                    let top = y + 7;
                    if (kind === 'modules') { put('Modul ' + tile.value.number, x + 4, top, 9, tileWidth - 8); top += 6; }
                    doc.setFontSize(10); doc.text(tile.label, x + 4, top);
                    put(percent(tile.value.percentage), x + 4, y + height - 10, 15, tileWidth - 8);
                    put(`${tile.value.score}/${tile.value.maxScore} Punkte`, x + 4, y + height - 4, 8, tileWidth - 8);
                });
                y += height + gap;
            }
            y += 4;
        };
        header(); paragraph(person(app), 12);
        paragraph(`${report.score}/${report.maxScore} Punkte · ${percent(report.percentage)}`, 14);
        paragraph('Ihr Ergebnisbericht zeigt den Anteil der erreichten Punkte in den Modulen und kognitiven Domänen. Er hilft Ihnen, weitere Lernschritte zu planen.');
        paragraph('Kompetenzrahmen: ' + frameworkLabel(report) + '. Die Module bündeln Kurse zu gemeinsamen Themen.');
        section('Module', report.modules, 'modules');
        if (report.domains.every(value => ['verstehen', 'anwenden', 'bewerten'].includes(value.label.toLocaleLowerCase()))) paragraph(domainDescription);
        section('Kognitive Domänen', report.domains, 'domains');
        paragraph(scope, 9);
        if (unassessedKinds.some(([kind]) => report.unassessed[kind].length)) {
            if (y + 22 > bottom) nextPage();
            paragraph('Nicht geprüfte Bereiche', 13);
            paragraph(unassessedDescription, 9);
            unassessedKinds.forEach(([kind, title]) => {
                if (report.unassessed[kind].length) paragraph(title + ': ' + report.unassessed[kind].map(value => (kind === 'modules' ? 'Modul ' + value.number + ' – ' : '') + value.label).join('; '), 9);
            });
        }
        const pages = page;
        for (let index = 1; index <= pages; index++) {
            doc.setPage(index); doc.setTextColor(90, 90, 90);
            put('ComDigiS* · DigiTaKS* | ' + index + '/' + pages, margin, 272, 8);
            let x = margin;
            loaded.slice(1).forEach(logo => {
                if (!logo.missing) { const logoWidth = 25, logoHeight = Math.min(13, logoWidth * logo.height / logo.width); doc.addImage(logo.image, 'PNG', x, 278, logoWidth, logoHeight); }
                x += 40;
            });
        }
        const filename = report.filename + '.pdf'; doc.save(filename);
        const missingLogos = loaded.filter(logo => logo.missing).map(logo => logo.label);
        say(missingLogos.length ? 'PDF heruntergeladen. Einige Projektlogos konnten nicht geladen werden. Sie können den Bericht erneut herunterladen.' : 'Ihr Ergebnisbericht wurde heruntergeladen. Sie finden ihn im Download-Ordner.');
        return { filename, missingLogos };
    } catch (error) {
        say('Der PDF-Bericht konnte nicht heruntergeladen werden. Bitte versuchen Sie es erneut. Ihre Testergebnisse bleiben gespeichert.');
        throw error;
    }
}
