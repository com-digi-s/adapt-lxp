// Source-level navigation regressions. These transparent element doubles do
// not measure browser wrapping, native select rendering or visual acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {fixture,loadModule} from './multi-fixture.mjs';

class Element {
    constructor(tag) { this.tagName=tag; this.attributes=new Map(); this.children=[]; this.listeners=new Map(); this.textContent=''; this.height=0; }
    setAttribute(name,value) { this.attributes.set(name,String(value)); }
    getAttribute(name) { return this.attributes.get(name)??null; }
    get hidden() { return this.attributes.has('hidden'); }
    set hidden(value) { if(value)this.setAttribute('hidden','');else this.attributes.delete('hidden'); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children=[...children]; }
    insertBefore(child,before) { const at=this.children.indexOf(before); assert.notEqual(at,-1); this.children.splice(at,0,child); }
    addEventListener(type,listener) { this.listeners.set(type,[...(this.listeners.get(type)||[]),listener]); }
    dispatch(type) { const event={preventDefault(){}}; for(const listener of this.listeners.get(type)||[])listener(event); }
    focus() { document.activeElement=this; }
    getBoundingClientRect() { return {height:this.height}; }
}

async function withNavigation(callback) {
    const previous={window:globalThis.window,document:globalThis.document};
    const properties=new Map(),document={createElement:tag=>new Element(tag),documentElement:{style:{setProperty:(name,value)=>properties.set(name,value)}}};
    const window={App:{warn(message){throw Error(message);}}}; Object.assign(globalThis,{window,document});
    try {
        const {MultiFrameworkApp}=await loadModule('multiFramework');
        const contract=fixture(),framework=contract.frameworks[0],other=contract.frameworks[1];
        framework.prefix='Kurz'; framework.label='Ein ausführlich benannter Kompetenzrahmen';
        other.prefix='Zweit 2026'; other.label='Ein anderer ausführlicher Kompetenzrahmen 2026';
        const header=new Element('header'),navbar=new Element('nav'),bar=new Element('div'),brand=new Element('a'),glossary=new Element('div'),breadcrumbs=new Element('div'),list=new Element('ol'),help=new Element('a'),xp=new Element('div');
        breadcrumbs.append(list); bar.append(brand,glossary,breadcrumbs,help,xp); navbar.append(bar); header.append(navbar); navbar.height=78.25;
        const selectors=new Map([['#main-navbar',navbar],['#main-navbar .container-fluid',bar],['.navbar-brand',brand],['#breadcrumb-container',breadcrumbs],['.breadcrumb',list]]);
        header.querySelector=selector=>selectors.get(selector)||null;
        const feedback=new Element('aside'); feedback.height=17.25;
        const calls=[],app=Object.assign(Object.create(MultiFrameworkApp.prototype),{
            contract,catalog:{frameworks:new Map(contract.frameworks.map(value=>[value.id,value])),modules:new Map(contract.modules.map(value=>[value.id,value]))},
            state:{activeFrameworkId:framework.id},header,feedback,dashboardFrame:new Element('iframe'),statusElement:{open:true},
            preferredFramework:()=>framework.id,installGlossary(){calls.push(['glossary']);},
            updateExperience(){calls.push(['xp']);},refreshGlossary(){calls.push(['refresh-glossary']);},
            showFramework(id){calls.push(['framework',id]);},showModule(id){calls.push(['module',id]);}
        });
        app.installNavigation();
        return await callback({app,contract,framework,other,navbar,bar,brand,glossary,breadcrumbs,list,help,xp,feedback,properties,calls,document});
    } finally { Object.assign(globalThis,previous); }
}

test('framework options use dynamic prefix/version, preserve full labels and explicit IDs',async()=>withNavigation(({app,framework,other,bar,brand,glossary,breadcrumbs,help,xp,calls})=>{
    const select=app.frameworkSelector,options=select.children;
    assert.deepEqual(options.map(option=>option.textContent),['Kurz · 2026','Zweit 2026']);
    assert.deepEqual(options.map(option=>option.getAttribute('value')),[framework.id,other.id]);
    assert.equal(options[0].getAttribute('title'),framework.label+' · 2026');
    assert.equal(options[0].getAttribute('aria-label'),framework.label+' · 2026');
    assert.equal(options[1].getAttribute('title'),other.label);
    assert.equal(select.hidden,false);
    assert.deepEqual(bar.children,[brand,glossary,select,breadcrumbs,help,xp],'Keep original controls and insert only the native selector');
    select.value=other.id; select.dispatch('change');
    assert.deepEqual(calls.at(-1),['framework',other.id],'Selection routes by explicit ID, not displayed prefix');
    app.state.activeFrameworkId=other.id; app.updateNavigation();
    assert.equal(select.getAttribute('title'),other.label);
    assert.equal(select.getAttribute('aria-label'),'Kompetenzrahmen wählen: '+other.label);
    brand.dispatch('click'); assert.deepEqual(calls.at(-1),['framework',framework.id],'Original Home callback is retained');
}));

test('current course stays complete while concise parent buttons retain full labels and exact routes',async()=>withNavigation(({app,contract,framework,breadcrumbs,list,calls,document})=>{
    const sco=contract.scos[0],module=contract.modules[0];
    sco.label=module.label='Ein sehr langer Kurstitel: Quellen prüfen, Ergebnisse einordnen und verantwortlich weiterarbeiten';
    app.frameworkSelector.focus(); app.updateNavigation(sco);
    assert.equal(document.activeElement,app.frameworkSelector,'Updating labels must not steal selector focus');
    assert.equal(breadcrumbs.hidden,false); assert.equal(breadcrumbs.getAttribute('role'),'navigation');
    assert.equal(breadcrumbs.getAttribute('aria-label'),'Kursnavigation');
    assert.equal(breadcrumbs.getAttribute('tabindex'),'0','Overflow remains reachable for keyboard scrolling');
    assert.equal(list.children.length,3);
    const [frameworkEntry,moduleEntry,current]=list.children,frameworkButton=frameworkEntry.children[0],moduleButton=moduleEntry.children[0];
    assert.equal(frameworkButton.textContent,'Kurz · 2026');
    assert.equal(frameworkButton.getAttribute('title'),framework.label+' · 2026');
    assert.equal(frameworkButton.getAttribute('aria-label'),'Zur Lernübersicht: '+framework.label+' · 2026');
    assert.equal(moduleButton.textContent,'Modul '+module.number);
    assert.equal(moduleButton.getAttribute('title'),module.label);
    assert.equal(moduleButton.getAttribute('aria-label'),'Zum Modul: '+module.label);
    assert.equal(current.textContent,sco.label); assert.equal(current.getAttribute('title'),sco.label);
    assert.equal(current.getAttribute('aria-current'),'page'); assert.equal(current.hidden,false);
    assert.match(current.getAttribute('class'),/\bmf-breadcrumb-current\b/);
    frameworkButton.dispatch('click'); assert.deepEqual(calls.at(-1),['framework',framework.id]);
    moduleButton.dispatch('click'); assert.deepEqual(calls.at(-1),['module',module.id]);
    assert.equal(app.statusElement.open,false); assert.ok(calls.some(call=>call[0]==='xp')); assert.ok(calls.some(call=>call[0]==='refresh-glossary'));
}));

test('dashboard hides only breadcrumbs, courses without modules retain their title, single framework hides selector',async()=>withNavigation(({app,contract,breadcrumbs,list,bar})=>{
    const sco={...contract.scos[0],moduleId:null}; app.updateNavigation(sco);
    assert.equal(list.children.length,2); assert.equal(list.children[1].textContent,sco.label);
    app.updateNavigation(); assert.equal(breadcrumbs.hidden,true); assert.equal(list.children.length,0);
    contract.frameworks.splice(1); app.installNavigation();
    assert.equal(app.frameworkSelector.hidden,true);
    assert.ok(bar.children.includes(breadcrumbs),'Single-framework mode retains the original navigation container');
}));

test('layout offsets use actual wrapped navbar and visible feedback heights, rounded up without overlap',async()=>withNavigation(({app,navbar,feedback,properties})=>{
    app.updateLayout(); assert.equal(properties.get('--lxp-nav-height'),'79px'); assert.equal(properties.get('--lxp-feedback-height'),'18px');
    navbar.height=132.5; feedback.hidden=true; app.updateLayout();
    assert.equal(properties.get('--lxp-nav-height'),'133px'); assert.equal(properties.get('--lxp-feedback-height'),'0px');
    navbar.height=0; app.updateLayout(); assert.equal(properties.get('--lxp-nav-height'),'56px');
}));

test('source CSS wraps current course, bounds scrollable header text and keeps measured content inset/focus styles',async()=>{
    const css=await readFile(new URL('../css/multi-framework.css',import.meta.url),'utf8');
    const rule=selector=>css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^}]+)\\}'))?.[1]||'';
    assert.match(rule('body.multi-framework-mode .breadcrumb'),/flex-wrap:\s*wrap/);
    assert.match(rule('body.multi-framework-mode .breadcrumb-item'),/white-space:\s*normal/);
    assert.match(rule('body.multi-framework-mode .breadcrumb-item'),/overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(rule('body.multi-framework-mode .breadcrumb-item'),/ellipsis|overflow:\s*hidden/);
    assert.match(rule('body.multi-framework-mode .mf-breadcrumb-current'),/flex:\s*1 0 100%/);
    assert.match(rule('body.multi-framework-mode #breadcrumb-container'),/max-height:\s*min\(32vh, 10rem\)/);
    assert.match(rule('body.multi-framework-mode #breadcrumb-container'),/overflow:\s*auto/);
    assert.match(css,/@media \(max-width: 600px\)[\s\S]*#breadcrumb-container:not\(\[hidden\]\)[^{]*\{[^}]*order:\s*5;[^}]*flex-basis:\s*100%/);
    assert.match(rule('body.multi-framework-mode #multi-framework-app'),/var\(--lxp-nav-height, 56px\).*var\(--lxp-feedback-height, 0px\)/);
    assert.match(css,/#main-navbar select:focus-visible/); assert.match(css,/#breadcrumb-container:focus-visible/);
    const source=await readFile(new URL('../js/multiFramework.js',import.meta.url),'utf8');
    assert.match(source,/new window\.ResizeObserver\(\(\) => this\.updateLayout\(\)\)/);
    assert.match(source,/this\.layoutObserver\.observe\(this\.header\.querySelector\('#main-navbar'\)\)/);
    assert.match(source,/this\.layoutObserver\.observe\(this\.feedback\)/);
});
