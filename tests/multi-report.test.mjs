import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, loadModule } from './multi-fixture.mjs';

function example() {
    const contract = fixture();
    contract.frameworks[0] = { ...contract.frameworks[0], label: 'DigComp', prefix: 'DigComp', version: '2.2' };
    contract.frameworks[1] = { ...contract.frameworks[1], label: 'AILit', prefix: 'AILit', version: '2026' };
    contract.domains.push({ id: 'v', frameworkId: 'fw-ai', label: 'Verstehen' }, { id: 'v', frameworkId: 'fw-dig', label: 'Foreign domain' });
    contract.assessments.push({ id: 'assessment-ai', frameworkId: 'fw-ai', scoId: 'assessment-sco', phase: 'entry', banks: [{ targetCourseId: 'opaque-ai', domainId: 'v' }] });
    const attempt = { attemptId: 'try-a', frameworkId: 'fw-ai', assessmentId: 'assessment-ai', phase: 'entry', completed: true, score: 1, maxScore: 3, courses: { 'opaque-ai': { score: 1, maxScore: 3 } }, domains: { v: { score: 1, maxScore: 3 } } };
    return { contract, attempt };
}
class Element {
    constructor(tag, document) { this.tagName = tag; this.ownerDocument = document; this.children = []; this.attributes = {}; this.listeners = {}; this.textContent = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    append(...children) { this.children.push(...children); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    get innerText() { return [this.textContent, ...this.children.map(child => child.innerText)].join(' '); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
        const match = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector);
        const matches = element => match && Object.hasOwn(element.attributes, match[1]) && (!match[2] || element.attributes[match[1]] === match[2]);
        return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
}
function application(contract) {
    const document = { createElement: tag => new Element(tag, document) }, content = document.createElement('section');
    return { contract, content, transport: { connected: false }, showFramework() {} };
}
function pdfRecorder() {
    const records = [], instances = [];
    class PDF {
        constructor(configuration) { this.page = 1; this.pages = 1; this.fontSize = 10; this.configuration = configuration; instances.push(this); }
        setFontSize(value) { this.fontSize = value; }
        setTextColor() {} setDrawColor() {} setFillColor() {}
        splitTextToSize(value, width) {
            const size = Math.max(1, Math.floor(width / (this.fontSize * .19))), lines = [];
            for (const paragraph of String(value).split('\n')) for (let index = 0; index < paragraph.length; index += size) lines.push(paragraph.slice(index, index + size));
            return lines;
        }
        text(value, x, y) { const lines = Array.isArray(value) ? value : [value]; records.push({ kind: 'text', value: lines.join(' '), x, y, page: this.page, bottom: y + (lines.length - 1) * this.fontSize * .43 }); }
        rect(x, y, width, height, style) { records.push({ kind: 'rect', x, y, width, height, style, page: this.page }); }
        addImage(image, type, x, y, width, height) { records.push({ kind: 'image', image, type, x, y, width, height, page: this.page }); }
        addPage() { this.page = ++this.pages; }
        setPage(page) { this.page = page; }
        save(filename) { records.push({ kind: 'save', filename }); }
    }
    return { PDF, records, instances };
}
const loadImage = async file => ({ image: file, width: 100, height: 30 });

for (const root of ['../js', '../dist/js']) {
    // The build gate copies this module together with the other shared modules.
    const { reportData } = await loadModule('multiAssessment', root);
    const { renderResult, downloadResultPDF } = await loadModule('multiReport', root);
    test(root + ': modules aggregate explicit scoped course mappings without adding state or guessing digits', () => {
        const { contract, attempt } = example(), before = structuredClone(attempt);
        contract.modules.find(module => module.frameworkId === 'fw-ai').number = '92';
        const second = structuredClone(contract.scos.find(course => course.id === 'opaque-ai'));
        second.id = 'not-a-numeric-course'; second.number = '8'; contract.scos.push(second);
        attempt.courses[second.id] = { score: 2, maxScore: 2 }; attempt.score = 3; attempt.maxScore = 5; attempt.domains.v = { score: 3, maxScore: 5 };
        contract.assessments[0].banks.push({ targetCourseId: second.id, domainId: 'v' });
        const report = reportData(contract, attempt);
        assert.deepEqual(report.modules.map(value => [value.id, value.number, value.score, value.maxScore]), [['module-fw-ai', '92', 3, 5]]);
        assert.equal(report.modules[0].percentage, 60); assert.equal(report.courses.length, 2); assert.equal(report.domains[0].label, 'Verstehen');
        assert.equal(report.groups.length, 3, 'Raw detail groups remain course/domain groups for compatibility');
        assert.equal(Object.hasOwn(attempt, 'modules'), false, 'No redundant module totals are stored in suspend_data');
        assert.deepEqual(before.courses, { 'opaque-ai': { score: 1, maxScore: 3 } });
        for (const mutate of [value => value.courses['opaque-dig'] = { score: 1, maxScore: 3 }, value => value.domains.foreign = { score: 0, maxScore: 1 }, value => value.score = 99, value => value.phase = 'final', value => delete value.courses['opaque-ai']]) {
            const bad = structuredClone(attempt); mutate(bad); assert.throws(() => reportData(contract, bad));
        }
        const invalid = structuredClone(contract); invalid.scos.find(course => course.id === 'opaque-ai').moduleId = 'module-fw-dig'; assert.throws(() => reportData(invalid, attempt));
    });
    test(root + ': readable report restores modules/domains, project context and one primary PDF action', () => {
        const { contract, attempt } = example(), app = application(contract), before = structuredClone(attempt);
        contract.modules.find(module => module.frameworkId === 'fw-ai').label = '<script>not executable</script>';
        const report = renderResult(app, attempt);
        assert.equal(app.content.getAttribute('data-view'), 'results'); assert.equal(report.modules.length, 1);
        assert.equal(app.content.querySelectorAll('[data-report-module]').length, 1); assert.equal(app.content.querySelectorAll('[data-report-domain]').length, 1);
        assert.ok(app.content.querySelector('[data-action="download-report"]')); assert.ok(app.content.querySelector('[data-report-feedback]'));
        assert.match(app.content.innerText, /ComDigiS\*.*AILit.*2026.*Einstiegstest/); assert.match(app.content.innerText, /Modul 1/); assert.match(app.content.innerText, /33,3 %/);
        assert.match(app.content.innerText, /Ergebnisse je Kurs/); assert.match(app.content.innerText, /DigiTaKS\*/); assert.doesNotMatch(app.content.innerText, /DigComp|JSON|Rohdaten/);
        assert.equal(app.content.querySelectorAll('[onerror]').length, 0); assert.deepEqual(attempt, before);
    });
    test(root + ': submitted-answer review is offered only for the native attempt still held by the SCO', () => {
        const {contract,attempt} = example(), app=application(contract), launches=[];
        app.state={scoStates:{'assessment-sco':{activeAttemptId:attempt.attemptId}}};app.launchSCO=(...args)=>launches.push(args);renderResult(app,attempt);
        const review=app.content.querySelector('[data-action="review-answers"]');assert.ok(review);review.listeners.click();assert.deepEqual(launches,[['assessment-sco',undefined,{review:true}]]);
        const historical=application(contract);historical.state={scoStates:{'assessment-sco':{activeAttemptId:'newer-attempt'}}};renderResult(historical,attempt);assert.equal(historical.content.querySelector('[data-action="review-answers"]'),null,'A previous score must not be paired with a newer native answer set');
        const missing=application(contract);renderResult(missing,attempt);assert.equal(missing.content.querySelector('[data-action="review-answers"]'),null);
    });
    test(root + ': report domains follow their configured pedagogical order, not answer insertion or another framework', () => {
        const { contract, attempt } = example();
        contract.domains = [{frameworkId:'fw-dig',id:'b',label:'Foreign'}, {frameworkId:'fw-ai',id:'v',label:'Verstehen'}, {frameworkId:'fw-ai',id:'a',label:'Anwenden'}, {frameworkId:'fw-ai',id:'b',label:'Bewerten'}];
        contract.assessments[0].banks.push({targetCourseId:'opaque-ai',domainId:'a'}, {targetCourseId:'opaque-ai',domainId:'b'});
        attempt.domains = {b:{score:0,maxScore:1},a:{score:0,maxScore:1},v:{score:1,maxScore:1}};
        const before = structuredClone(attempt);
        assert.deepEqual(reportData(contract,attempt).domains.map(domain=>domain.label), ['Verstehen','Anwenden','Bewerten']);
        assert.deepEqual(attempt,before);
    });
    test(root + ': PDF contains actual branded layout, module/domain boxes, anonymous default and explicit framework', async () => {
        const { contract, attempt } = example(), app = application(contract), recording = pdfRecorder(); renderResult(app, attempt);
        const result = await downloadResultPDF(app, attempt, { PDF: recording.PDF, loadImage });
        const text = recording.records.filter(record => record.kind === 'text').map(record => record.value).join(' ');
        assert.match(text, /ComDigiS\* Einstiegstest/); assert.match(text, /AILit · 2026/); assert.match(text, /Anonym/); assert.match(text, /Modul 1/); assert.match(text, /Verstehen/); assert.doesNotMatch(text, /DigComp/);
        assert.equal(recording.records.filter(record => record.kind === 'rect').length, 2); assert.ok(recording.records.filter(record => record.kind === 'rect').every(record => record.style === 'FD'));
        assert.equal(recording.records.filter(record => record.kind === 'image').length, 4); assert.match(result.filename, /^Ergebnis-fw-ai-2026-entry-try-a\.pdf$/);
        assert.equal(result.missingLogos.length, 0); assert.match(app.content.querySelector('[data-report-feedback]').textContent, /heruntergeladen/);
    });
    test(root + ': long labels and many modules paginate without colliding with footer, names stay optional', async () => {
        const { contract, attempt } = example(), app = application(contract), recording = pdfRecorder();
        app.transport = { connected: true, get: () => 'Testperson, Beispiel' };
        for (let index = 1; index < 18; index++) {
            const id = 'module-' + index, course = 'course-' + index;
            contract.modules.push({ id, frameworkId: 'fw-ai', number: String(index + 1), label: ('Langes verständliches Modulthema ' + index + ' ').repeat(6) });
            contract.scos.push({ id: course, role: 'learning', frameworkId: 'fw-ai', moduleId: id, number: '1', label: 'Course ' + index });
            contract.assessments[0].banks.push({ targetCourseId: course, domainId: 'v' }); attempt.courses[course] = { score: 0, maxScore: 1 }; attempt.maxScore++; attempt.domains.v.maxScore++;
        }
        await downloadResultPDF(app, attempt, { PDF: recording.PDF, loadImage });
        assert.ok(recording.instances[0].pages > 1); assert.equal(recording.records.filter(record => record.kind === 'rect').length, 19);
        for (const record of recording.records.filter(record => record.kind === 'rect')) assert.ok(record.y + record.height <= 263, 'Tile stays above reserved footer');
        assert.match(recording.records.filter(record => record.kind === 'text').map(record => record.value).join(' '), /Testperson, Beispiel/);
        assert.equal(recording.records.filter(record => record.kind === 'image').length, recording.instances[0].pages * 4);
    });
    test(root + ': failed logos do not lose a report; failed PDF save offers retry without state mutation', async () => {
        const { contract, attempt } = example(), app = application(contract), recording = pdfRecorder(), before = structuredClone(attempt); renderResult(app, attempt);
        const result = await downloadResultPDF(app, attempt, { PDF: recording.PDF, loadImage: async () => { throw Error('offline'); } });
        assert.equal(result.missingLogos.length, 4); assert.ok(recording.records.some(record => record.kind === 'save')); assert.match(app.content.querySelector('[data-report-feedback]').textContent, /erneut herunterladen/);
        class FailingPDF extends recording.PDF { save() { throw Error('download blocked'); } }
        await assert.rejects(downloadResultPDF(app, attempt, { PDF: FailingPDF, loadImage }));
        assert.match(app.content.querySelector('[data-report-feedback]').textContent, /erneut.*Testergebnisse bleiben gespeichert/); assert.deepEqual(attempt, before);
    });
    test(root + ': slow report downloads ignore duplicate clicks and enable the action again afterwards', async () => {
        const {contract,attempt}=example(),app=application(contract),recording=pdfRecorder(),previous=globalThis.window,pending=[];
        class Image {
            constructor(){this.naturalWidth=100;this.naturalHeight=30;}
            set src(_value){pending.push(()=>this.onload());}
        }
        globalThis.window={Image,setTimeout,clearTimeout,location:new URL('https://unit.invalid/package/index.html'),jspdf:{jsPDF:recording.PDF}};
        try {
            renderResult(app,attempt);
            const button=app.content.querySelector('[data-action="download-report"]');
            const first=button.listeners.click(),second=button.listeners.click();
            assert.equal(button.disabled,true);assert.equal(pending.length,4,'One logo load per report, not another report per click');
            pending.splice(0).forEach(release=>release());await Promise.all([first,second]);
            assert.equal(recording.records.filter(record=>record.kind==='save').length,1);assert.equal(button.disabled,false);
        } finally {globalThis.window=previous;}
    });
}
