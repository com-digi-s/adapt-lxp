// Behavioral regressions for the original learner UX, against source AND dist.
// This transparent DOM adapter exercises real renderer/controller code. It does
// not claim browser layout/fullscreen acceptance; the separate browser gate does.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {fixture,loadModule} from './multi-fixture.mjs';

const decode=value=>String(value).replace(/&(?:amp|lt|gt|quot|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity]));
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function selectorTokens(selector){return selector.replace(/\s*>\s*/g,' > ').match(/(?:\[[^\]]*\]|[^\s])+/g)||[];}
function simpleMatch(element,selector,scope){
    if(selector===':scope')return element===scope;
    const tag=/^(\*|[a-z][\w-]*)/i.exec(selector);if(tag&&tag[1]!=='*'&&element.tagName!==tag[1].toUpperCase())return false;
    for(const match of selector.matchAll(/#([\w-]+)|\.([\w-]+)|\[([^\s\]=~^$*]+)\s*(?:(\^=|\$=|\*=|=)\s*["']?([^\]"']*)["']?)?\]/g)){
        if(match[1]&&element.id!==match[1])return false;
        if(match[2]&&!element.classList.contains(match[2]))return false;
        if(match[3]){const value=element.getAttribute(match[3]);if(value===null)return false;const expected=(match[5]||'').trim();if(match[4]==='='&&value!==expected||match[4]==='^='&&!value.startsWith(expected)||match[4]==='$='&&!value.endsWith(expected)||match[4]==='*='&&!value.includes(expected))return false;}
    }
    return Boolean(tag||/[.#\[]/.test(selector));
}
function matches(element,selector,scope){
    const tokens=selectorTokens(selector);
    function at(node,index){if(!node||node.nodeType!==1||!simpleMatch(node,tokens[index],scope))return false;if(index===0)return true;if(tokens[index-1]==='>')return at(node.parentElement,index-2);for(let parent=node.parentElement;parent;parent=parent.parentElement)if(at(parent,index-1))return true;return false;}
    return tokens.length>0&&at(element,tokens.length-1);
}
class TextNode{
    constructor(text,doc){this.nodeType=3;this.ownerDocument=doc;this.parentNode=null;this.textContent=String(text);}
    remove(){this.parentNode?.removeChild(this);}
}
class Element{
    constructor(tag,doc){this.nodeType=1;this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.parentNode=null;this.childNodes=[];this.attributes=new Map();this.listeners=new Map();this.style={setProperty(name,value){this[name]=String(value);},getPropertyValue(name){return this[name]||'';},removeProperty(name){delete this[name];}};
        this.classList={add:(...names)=>this.setAttribute('class',[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ')),remove:(...names)=>this.setAttribute('class',this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ')),contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,force)=>{const enabled=force===undefined?!this.classList.contains(name):Boolean(force);this.classList[enabled?'add':'remove'](name);return enabled;}};
        this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true;}});
        if(this.tagName==='IFRAME'){this.contentDocument=new Document('about:blank',doc.defaultView);this.contentWindow=this.contentDocument.defaultView;this.contentWindow.frameElement=this;}
    }
    get children(){return this.childNodes.filter(node=>node.nodeType===1);}
    get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
    get firstChild(){return this.childNodes[0]||null;}
    get firstElementChild(){return this.children[0]||null;}
    get lastElementChild(){return this.children.at(-1)||null;}
    get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
    set textContent(value){this.replaceChildren(new TextNode(value??'',this.ownerDocument));}
    get innerText(){return this.textContent;}
    set innerText(value){this.textContent=value;}
    get innerHTML(){return this.textContent;}
    set innerHTML(value){this.replaceChildren();parseInto(this,String(value));}
    get id(){return this.getAttribute('id')||'';}set id(value){this.setAttribute('id',value);}
    get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
    get title(){return this.getAttribute('title')||'';}set title(value){this.setAttribute('title',value);}
    get href(){return this.getAttribute('href')||'';}set href(value){this.setAttribute('href',value);}
    get hidden(){return this.hasAttribute('hidden');}set hidden(value){if(value)this.setAttribute('hidden','');else this.removeAttribute('hidden');}
    get allowFullscreen(){return this.hasAttribute('allowfullscreen');}set allowFullscreen(value){if(value)this.setAttribute('allowfullscreen','');else this.removeAttribute('allowfullscreen');}
    get src(){return this.getAttribute('src')||'';}set src(value){this.ownerDocument.events.push({type:'iframe-src',frame:this,value,bridge:this.ownerDocument.defaultView.API});this.setAttribute('src',value);}
    get options(){return this.querySelectorAll('option');}
    get value(){return this._value??this.getAttribute('value')??(this.tagName==='SELECT'?this.options[0]?.value:'')??'';}
    set value(value){if(this.tagName==='SELECT')this._value=String(value);else this.setAttribute('value',value);}
    setAttribute(name,value){name=String(name).toLowerCase();this.attributes.set(name,String(value));if(name==='style')for(const entry of String(value).split(';')){const [key,...rest]=entry.split(':');if(key.trim())this.style[key.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=rest.join(':').trim();}}
    getAttribute(name){return this.attributes.get(String(name).toLowerCase())??null;}
    hasAttribute(name){return this.attributes.has(String(name).toLowerCase());}
    removeAttribute(name){this.attributes.delete(String(name).toLowerCase());}
    append(...nodes){for(let node of nodes){if(node===null||node===undefined)continue;if(typeof node!=='object')node=new TextNode(node,this.ownerDocument);node.remove();node.parentNode=this;this.childNodes.push(node);}}
    appendChild(node){this.append(node);return node;}
    prepend(...nodes){for(const node of nodes.reverse()){node.remove();node.parentNode=this;this.childNodes.unshift(node);}}
    insertBefore(node,before){if(!before)return this.appendChild(node);const index=this.childNodes.indexOf(before);assert.notEqual(index,-1);node.remove();node.parentNode=this;this.childNodes.splice(index,0,node);return node;}
    removeChild(node){const index=this.childNodes.indexOf(node);if(index>=0){this.childNodes.splice(index,1);node.parentNode=null;}return node;}
    replaceChildren(...nodes){for(const child of [...this.childNodes])this.removeChild(child);this.append(...nodes);}
    remove(){this.parentNode?.removeChild(this);}
    contains(node){for(let at=node;at;at=at.parentNode)if(at===this)return true;return false;}
    querySelectorAll(selector){const selectors=selector.split(',').map(part=>part.trim()),found=[];const visit=node=>{for(const child of node.children){if(selectors.some(value=>matches(child,value,this)))found.push(child);visit(child);}};visit(this);return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    matches(selector){return selector.split(',').some(value=>matches(this,value.trim(),this));}
    closest(selector){for(let at=this;at;at=at.parentElement)if(at.matches(selector))return at;return null;}
    addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
    removeEventListener(type,listener){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==listener));}
    dispatchEvent(event){event.target??=this;event.currentTarget=this;event.preventDefault??=()=>{event.defaultPrevented=true;};event.stopPropagation??=()=>{event.propagationStopped=true;};for(const listener of this.listeners.get(event.type)||[])listener.call(this,event);if(event.bubbles&&!event.propagationStopped)this.parentElement?.dispatchEvent(event);return !event.defaultPrevented;}
    click(){this.dispatchEvent({type:'click',bubbles:true});}
    focus(){this.ownerDocument.activeElement=this;}
    getContext(){return {canvas:this};}
    getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:1440,height:this.tagName==='HEADER'?56:0,right:1440,bottom:this.tagName==='HEADER'?56:0};}
}
function parseInto(parent,source){
    const stack=[parent];source=source.replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    for(const match of source.matchAll(/<\/?[^>]+>|[^<]+/g)){const token=match[0];if(/^<!/.test(token))continue;if(token.startsWith('</')){const tag=/^<\/\s*([\w-]+)/.exec(token)?.[1]?.toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}continue;}if(token.startsWith('<')){const tag=/^<\s*([\w-]+)/.exec(token)?.[1];if(!tag)continue;const element=parent.ownerDocument.createElement(tag);for(const attribute of token.slice(token.indexOf(tag)+tag.length).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))element.setAttribute(attribute[1],decode(attribute[2]??attribute[3]??attribute[4]??''));stack.at(-1).append(element);if(!voidTags.has(tag.toLowerCase())&&!token.endsWith('/>'))stack.push(element);}else stack.at(-1).append(new TextNode(decode(token),parent.ownerDocument));}
}
class Document{
    constructor(url='https://unit.invalid/package/index.html',parent=null){
        this.URL=url;this.baseURI=url==='about:blank'?(parent?.document?.baseURI||url):url;this.events=parent?.document?.events||[];this.listeners=new Map();this.readyState='complete';
        const view={document:this,location:new URL(url),console,addEventListener:(type,fn)=>{if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);},removeEventListener(){},setTimeout,clearTimeout,requestAnimationFrame:fn=>{fn();return 0;},cancelAnimationFrame(){},innerWidth:1440,innerHeight:1000,focus(){}};view.window=view;view.parent=parent||view;view.top=parent?.top||view;this.defaultView=view;
        this.documentElement=new Element('html',this);this.documentElement.lang='de';this.head=new Element('head',this);this.body=new Element('body',this);this.documentElement.append(this.head,this.body);
    }
    createElement(tag){return new Element(tag,this);}
    createTextNode(text){return new TextNode(text,this);}
    getElementById(id){return this.querySelector('#'+id);}
    querySelectorAll(selector){return [this.documentElement,...this.documentElement.querySelectorAll(selector)].filter((element,index)=>index>0||element.matches(selector));}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,listener){this.defaultView.addEventListener(type,listener);}
    removeEventListener(type,listener){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==listener));}
    open(){this.buffer='';return this;}
    write(value){this.buffer=(this.buffer||'')+String(value);this.parse(this.buffer);}
    close(){this.parse(this.buffer||'');}
    parse(source){this.head.replaceChildren();this.body.replaceChildren();const head=/<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(source);const body=/<body\b[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(source);if(head)parseInto(this.head,head[1]);parseInto(this.body,body?body[1]:source);}
}
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const originalIndex=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
async function withDOM(callback){
    const previous={window:globalThis.window,document:globalThis.document};const document=new Document();document.parse(originalIndex);const window=document.defaultView;window.CONF={};window.localStorage=memory();window.API={genuineOuter:true};Object.assign(globalThis,{window,document});
    try{return await callback({window,document});}catch(error){if(error.stack)error.stack=error.stack.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<actual-runtime-module>');throw error;}finally{Object.assign(globalThis,previous);}
}
function record(sco,complete=false){return{frameworkId:sco.frameworkId,fingerprint:sco.source.componentFingerprint||sco.source.buildSha256,payload:'',values:{'cmi.core.lesson_status':complete?'completed':'incomplete'},native:{format:1,complete,components:{first:{required:true,state:{_isComplete:true}},second:{required:true,state:{_isComplete:complete}}}}};}
function uxFixture(){
    const contract=fixture();contract.frameworks[0].prefix='DigComp';contract.frameworks[0].label='DigComp';contract.frameworks[0].version='2.2';contract.frameworks[1].prefix='AILit';contract.frameworks[1].label='AILit';
    contract.scos.push({...structuredClone(contract.scos[0]),id:'opaque-optional-two',number:'2',label:'Optional two',requiredForCompletion:false,source:{...contract.scos[0].source,courseId:'optional-two'},launch:{root:'scos/optional-two',entry:'index_lms.html',manifestHref:'index_lms.html'}});
    return contract;
}
function seed(app){app.state.scoStates['opaque-dig']=record(app.contract.scos.find(s=>s.id==='opaque-dig'));app.state.scoStates['opaque-ai']=record(app.contract.scos.find(s=>s.id==='opaque-ai'),true);app.state.scoStates['opaque-optional-two']=record(app.contract.scos.find(s=>s.id==='opaque-optional-two'),true);}
function diagnostic(contract){
    const hash='b'.repeat(64),fw='fw-dig',as='opaque-assessment',sco='opaque-diagnostic',q='opaque-question';
    contract.frameworks[0].diagnostics.entry={intent:'require',status:'provided',reason:null};
    contract.scos.push({id:sco,frameworkId:fw,role:'entry',requiredForCompletion:false,label:'Actual entry',source:{kind:'generated-assessment',assessmentId:as,generatorSha256:hash,templateSha256:hash,buildSha256:hash,catalogueSha256:hash,questions:[{questionId:q,sourceCourseId:'opaque-dig',sourceComponentId:'same-native'}],manifest:{sha256:hash,resourceId:'entry-resource',href:'index_lms.html'}},launch:{root:'scos/'+sco,entry:'index_lms.html',manifestHref:'index_lms.html'}});
    contract.questions.push({id:q,sourceCourseId:'opaque-dig',sourceComponentId:'same-native',runtimeQuestionId:'native-alias',component:'mcq',tags:['et'],available:true,selfAssessment:false,maxPoints:2});
    contract.domains.push({frameworkId:fw,id:'explicit-domain',label:'Explicit domain'});
    contract.assessments.push({id:as,frameworkId:fw,scoId:sco,phase:'entry',banks:[{id:'opaque-bank',runtimeBankId:1,targetCourseId:'opaque-dig',domainId:'explicit-domain',questionIds:[q],maxPoints:2}]});return contract;
}
function zeroAttempt(){return{attemptId:'actual-zero',frameworkId:'fw-dig',assessmentId:'opaque-assessment',phase:'entry',completed:true,completedAt:'2026-10-26T12:00:00Z',score:0,maxScore:2,banks:{'opaque-bank':{score:0,maxScore:2}},courses:{'opaque-dig':{score:0,maxScore:2}},domains:{'explicit-domain':{score:0,maxScore:2}},questions:{'opaque-question':{score:0,maxScore:2}}};}
function nativeRecord(sco,flags){return{...record(sco),native:{format:1,complete:flags.every(Boolean),components:Object.fromEntries(flags.map((complete,index)=>['component-'+index,{required:true,state:{_isComplete:complete,_isCorrect:false,_score:0}}]))}};}
function seedDiagnostic(app,flags=[true,true,false]){const sco=app.contract.scos.find(s=>s.id==='opaque-diagnostic');app.state.scoStates[sco.id]=nativeRecord(sco,flags);}
let converterPromise;
function actualSpoorConverter(){return converterPromise??=(async()=>{const context={console,setTimeout,clearTimeout,atob,btoa};context.window=context;context.LZMAFactory=()=>context.LZMA;for(const name of ['underscore.js','lzma_worker-min.js','SCORMSuspendData.js'])runInNewContext(await readFile(new URL('../dist/libraries/'+name,import.meta.url),'utf8'),context);return context.SCORMSuspendData;})();}
function withClock(start,callback){const original=Date.now;let now=start;Date.now=()=>now;try{return callback(value=>{now=value;});}finally{Date.now=original;}}
const landmarks=['greeting','quote_text','quote_author','entryTest','template_entryTest','competences','template_courseSelector','charts','template_pulse','template_radar','finalTest','template_finalTest'];
function assertDashboard(content){for(const id of landmarks)assert.ok(content.querySelector('#'+id),'Original dashboard landmark #'+id+' remains real DOM');assert.equal(content.querySelector('[data-section="migration"]'),null);assert.equal(content.querySelector('input[type="file"]'),null);}

for(const root of ['../js','../dist/js']){
    test(root+': real controller XP includes learning and diagnostic completion, not raw grade or another framework',async()=>withDOM(async({window})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),app=new MultiFrameworkApp(diagnostic(uxFixture()),{api:null,storage:memory(),environment:window});window.App=app;seed(app);seedDiagnostic(app);app.state.activeFrameworkId='fw-ai';
        app.state.scoStates['unselected-global']={native:{format:1,components:{wrongScope:{required:true,state:{_isComplete:true}}}}};
        app.state.scoStates['opaque-diagnostic'].values['cmi.core.score.raw']='999';
        assert.equal(app.getExperiencePoints('fw-dig'),5,'1 required-learning + 2 optional-learning + 2 diagnostic components, even when answers are incorrect');assert.equal(app.getExperiencePoints('fw-ai'),2);assert.equal(app.getExperiencePoints('unknown-framework'),0);
        const model=(complete,extra={},ancestors=[])=>({get:key=>({_isAvailable:true,_isOptional:false,_isComplete:complete,_isCorrect:false,_score:0,...extra})[key],getAncestorModels:()=>ancestors});
        app.activeContext={scoId:'opaque-dig',launchId:'live-dig'};app.controllers.set('live-dig',{Adapt:{components:{models:[model(true),model(true),model(false),model(true,{_isAvailable:false}),model(true,{_isOptional:true}),model(true,{},[{get:key=>key==='_isOptional'}])]}}});
        assert.equal(app.getExperiencePoints('fw-dig'),6,'The actual live component flags supersede stale persisted flags');assert.equal(app.getExperiencePoints('fw-ai'),2,'An active DigComp controller cannot change AILit XP');
        assert.deepEqual(app.getLearningActivity('fw-dig'),[],'Completed components alone do not fabricate a historical XP/time event');
    }));

    test(root+': real controller decodes actual Spoor completion arrays, distinguishes missing zero from opaque unknown XP',async()=>withDOM(async({window,document})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),converter=await actualSpoorConverter();window.SCORMSuspendData=converter;
        const app=new MultiFrameworkApp(diagnostic(uxFixture()),{api:null,storage:memory(),environment:window});window.App=app;
        assert.equal(app.getExperiencePoints('fw-dig'),0,'A genuinely missing source has zero completed components');
        const withoutResponses=[[[0,0],[true]],[[0,1],[false]],[[1,0],[true]]],withResponses=[[[0,0],[false,false,false],[[],[true,false],[[]]]],[[0,1],[true,true,false],[[0,0],[true,true,true,false],[[false,true]]]],[[1,0],[true,true,false],[[1,0],[false,true,true,true],[[true,false]]]]];
        // Use the shipped Converter instance itself: deserialize relies on its
        // receiver, unlike an arrow-function fake that hides a detached call.
        for(const states of [withoutResponses,withResponses]){
            const encoded=converter.serialize(states);assert.equal(converter.deserialize(encoded).length,states.length);
            app.state.scoStates['opaque-dig']={frameworkId:'fw-dig',payload:JSON.stringify({q:encoded}),values:{'cmi.core.score.raw':'100','cmi.core.total_time':'0009:00:00'},native:null};
            assert.equal(app.getCourseProgress('opaque-dig',true),2);assert.equal(app.getExperiencePoints('fw-dig'),2,'Only native isComplete flags, not score/raw or response counts, earn XP');
        }
        assert.deepEqual(app.getLearningActivity('fw-dig'),[],'Legacy total_time and compressed flags do not supply dated events');
        const before=structuredClone(app.state);app.getExperiencePoints('fw-dig');assert.deepEqual(app.state,before);
        app.state.scoStates['opaque-dig'].payload='opaque-unknown-spoor';assert.equal(app.getExperiencePoints('fw-dig'),null,'A changed opaque payload invalidates the known count, not silently zero');
        app.init();assert.equal(document.querySelector('#template_xp').textContent,'— XP');assert.equal(app.getExperiencePoints('fw-ai'),0);
        app.state.scoStates['opaque-dig']={frameworkId:'fw-dig',payload:'',values:{'cmi.core.lesson_status':'completed'},native:{format:1,complete:true,components:{}}};assert.equal(app.getExperiencePoints('fw-dig'),null,'Completion without a component count is not invented XP');
    }));

    test(root+': real visibility clock records only the launched SCO, excludes hidden time and duplicate instants',async()=>withDOM(async({window,document})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),app=new MultiFrameworkApp(diagnostic(uxFixture()),{api:null,storage:memory(),environment:window});window.App=app;seed(app);seedDiagnostic(app);app.state.activeFrameworkId='fw-ai';document.visibilityState='visible';
        const begin=Date.UTC(2026,9,26,12),day=new Date(begin).toLocaleDateString('sv-SE');
        withClock(begin,setNow=>{
            app.learningSession={scoId:'opaque-dig',lastTick:begin,visible:true};setNow(begin+60000);app.observeLearningTime();const learning=app.state.scoStates['opaque-dig'];assert.equal(learning.activityMs[day],60000);assert.deepEqual(learning.activityXP[day],{value:5,at:begin+60000});assert.equal(app.state.scoStates['opaque-ai'].activityMs,undefined);
            const once=structuredClone(learning);app.observeLearningTime();assert.deepEqual(learning,once,'Repeated save at the identical instant adds neither time nor a dated XP sample');
            document.visibilityState='hidden';setNow(begin+90000);app.observeLearningTime();assert.equal(learning.activityMs[day],90000,'The interval before the visibility event was visible');setNow(begin+390000);app.observeLearningTime();assert.equal(learning.activityMs[day],90000);
            document.visibilityState='visible';setNow(begin+510000);app.observeLearningTime();assert.equal(learning.activityMs[day],90000,'The hidden interval before becoming visible is excluded');setNow(begin+525000);app.observeLearningTime();assert.equal(learning.activityMs[day],105000);assert.equal(learning.activityXP[day].at,begin+525000);
            app.learningSession={scoId:'opaque-diagnostic',lastTick:begin+525000,visible:true};setNow(begin+585000);app.observeLearningTime();assert.equal(app.state.scoStates['opaque-diagnostic'].activityMs[day],60000,'Real diagnostic time is included, not discarded by a learning-only filter');assert.equal(learning.activityMs[day],105000);
        });
        assert.deepEqual(app.getLearningActivity('fw-dig'),[{date:day,minutes:2.75,xp:5}]);assert.deepEqual(app.getLearningActivity('fw-ai'),[]);
        const before=structuredClone(app.state);app.learningSession=null;withClock(begin+900000,()=>app.observeLearningTime());assert.deepEqual(app.state,before,'Dashboard/home time without a launched SCO is not attributed to a framework');
    }));

    test(root+': real activity getter and chart use only recorded scoped dates and measured XP, not retrospective earnings',async()=>withDOM(async({window,document})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),{renderDashboard,buildDashboardModel}=await loadModule('multiDashboard',root),app=new MultiFrameworkApp(diagnostic(uxFixture()),{api:null,storage:memory(),environment:window});window.App=app;seed(app);seedDiagnostic(app,[true,true]);app.state.scoStates['opaque-dig']=nativeRecord(app.contract.scos.find(s=>s.id==='opaque-dig'),[true,true]);
        const learning=app.state.scoStates['opaque-dig'],optional=app.state.scoStates['opaque-optional-two'],diag=app.state.scoStates['opaque-diagnostic'],ai=app.state.scoStates['opaque-ai'];
        learning.activityMs={'2026-10-24':60000,'2026-10-26':60000,'2026-10-27':60000,'bad-date':900000,'2026-10-28':-1};learning.activityXP={'2026-10-24':{value:3,at:10},'2026-10-26':{value:4,at:20},'2026-10-27':{value:6,at:40},'1900-01-01':{value:999,at:999999}};
        optional.activityMs={'2026-10-25':120000};diag.activityMs={'2026-10-26':120000};diag.activityXP={'2026-10-26':{value:5,at:30}};
        ai.activityMs={'2026-10-24':600000};ai.activityXP={'2026-10-24':{value:2,at:999}};app.state.scoStates['unselected-home']={frameworkId:'fw-dig',activityMs:{'1999-01-01':999999},activityXP:{'1999-01-01':{value:999,at:999999}}};
        const expected=[{date:'2026-10-24',minutes:1,xp:3},{date:'2026-10-25',minutes:2},{date:'2026-10-26',minutes:3,xp:5},{date:'2026-10-27',minutes:1,xp:6}];assert.deepEqual(app.getLearningActivity('fw-dig'),expected);assert.deepEqual(app.getLearningActivity('fw-ai'),[{date:'2026-10-24',minutes:10,xp:2}]);
        app.content=document.createElement('section');document.body.append(app.content);const made=[];app.Chart=class{constructor(_context,configuration){this.configuration=configuration;made.push(this);}destroy(){}};renderDashboard(app,'fw-dig');const pulse=made.find(chart=>chart.configuration.type==='line').configuration.data;
        const cumulative=pulse.datasets.find(data=>data.label==='Lernaktivität - XP (kumuliert)'),earned=pulse.datasets.find(data=>data.label==='Lernaktivität - XP (neu)'),minutes=pulse.datasets.find(data=>data.label==='Lernaktivität - Zeit (Minuten)');assert.equal(cumulative.hidden,true);assert.equal(earned.hidden,true);assert.deepEqual(cumulative.data,[3,null,5,6]);assert.deepEqual(earned.data,[null,null,null,1],'Initial and missing measurements do not invent XP earned that day');assert.deepEqual(minutes.data,[1,2,3,1]);
        for(const value of Object.values(app.state.scoStates))delete value.activityXP;made.length=0;renderDashboard(app,'fw-dig');const noXp=made.find(chart=>chart.configuration.type==='line').configuration.data.datasets;assert.equal(noXp.some(data=>data.label.includes('XP')),false,'Current completed components cannot retrospectively populate past XP charts');assert.equal(buildDashboardModel(app,'fw-dig').xp,6);assert.ok(buildDashboardModel(app,'fw-dig').activity.every(row=>!Object.hasOwn(row,'xp')));
    }));

    test(root+': dashboard model keeps native partial learning, optional courses and two frameworks separate',async()=>{
        const {buildDashboardModel,courseProgressValue}=await loadModule('multiDashboard',root),{createState}=await loadModule('multiState',root),{progress}=await loadModule('multiContract',root);const contract=uxFixture(),app={contract,state:createState(contract),getExperiencePoints:fw=>fw==='fw-dig'?3:2};seed(app);
        const before=structuredClone(contract),dig=buildDashboardModel(app,'fw-dig'),ai=buildDashboardModel(app,'fw-ai');
        assert.deepEqual(dig.modules[0].courses.map(course=>course.number),['2','10']);assert.equal(dig.modules[0].courses[0].requiredForCompletion,false);assert.equal(dig.modules[0].courses[0].progress,1);assert.equal(dig.modules[0].courses[1].progress,.5);assert.equal(dig.modules[0].progress,.75);
        assert.deepEqual(dig.progress,{required:1,completed:0,fraction:0,complete:false});assert.equal(ai.progress.complete,true);assert.equal(progress(contract,app.state).complete,false);assert.equal(dig.xp,3);assert.equal(ai.xp,2);assert.equal(dig.diagnostics.entry.status,'notProvided');assert.deepEqual(dig.diagnostics.entry.attempts,[]);assert.equal(dig.pathways.length,0);assert.equal(ai.pathways[0].courses[0].id,'opaque-ai');assert.deepEqual(contract,before);
        assert.equal(courseProgressValue({payload:'opaque-not-a-score',values:{}}),null);assert.equal(courseProgressValue({native:{format:1,components:{q:{required:true,state:{_isComplete:false}}}},values:{'cmi.core.score.raw':'100'}}),0,'A test score is not learning completion');
        assert.equal(courseProgressValue({native:{format:1,complete:false,components:{q:{required:true,state:{_isComplete:true,_isCorrect:false}}}},values:{'cmi.core.score.raw':'0'}}),1,'A genuinely completed but incorrect response is not relabelled unworked');
    });

    test(root+': actual dashboard renderer preserves landmarks, real controls, bars, flags, information and literal labels',async()=>withDOM(async({document})=>{
        const {renderDashboard,renderCourseOverview}=await loadModule('multiDashboard',root),{createState}=await loadModule('multiState',root);const contract=uxFixture();contract.scos.find(s=>s.id==='opaque-dig').label='<img src=x onerror=unexpected()>';
        const content=document.createElement('section');document.body.append(content);const calls=[],made=[];class Chart{constructor(context,configuration){assert.ok(context.canvas);this.configuration=configuration;this.destroyed=0;made.push(this);}destroy(){this.destroyed++;}}
        const app={contract,state:createState(contract),content,charts:[],Chart,launchSCO:(...args)=>calls.push(args),showResult(){},getExperiencePoints:()=>3,getLearningActivity:()=>[{date:'2026-10-26',minutes:4.5}]};seed(app);const view=renderDashboard(app,'fw-dig');assertDashboard(content);
        assert.deepEqual(made.find(chart=>chart.configuration.type==='line').configuration.data.datasets[0].data,[4.5]);assert.deepEqual(made.find(chart=>chart.configuration.type==='radar').configuration.data.datasets[0].data,[.75],'Learning radar uses real selected-course progress, not a fabricated test score');
        assert.match(content.textContent,/<img src=x onerror=unexpected\(\)>/);assert.equal(content.querySelector('img[onerror]'),null);assert.equal(content.querySelector('[data-progress-sco="opaque-dig"]').getAttribute('aria-valuenow'),'50');
        const module=content.querySelector('.collapsible-card'),header=module.querySelector('[role="button"]'),body=document.getElementById(header.getAttribute('aria-controls'));assert.equal(body.hidden,true);header.click();assert.equal(body.hidden,false);assert.equal(header.getAttribute('aria-expanded'),'true');
        content.querySelector('.course[data-launch-sco="opaque-dig"]').click();assert.deepEqual(calls.at(-1),['opaque-dig']);
        const info=content.querySelector('[aria-controls="infoModalCompetences"]');info.click();assert.equal(content.querySelector('#infoModalCompetences').getAttribute('aria-hidden'),'false');content.querySelector('#infoModalCompetences button').click();assert.equal(content.querySelector('#infoModalCompetences').getAttribute('aria-hidden'),'true');
        assert.ok(content.querySelector('footer img[alt="InfAI Logo"]'));view.destroy();assert.ok(made.every(chart=>chart.destroyed===1),'Dashboard-owned charts are disposed when the view is replaced');renderDashboard(app,'fw-ai');assertDashboard(content);assert.equal(content.querySelector('[data-progress-sco="opaque-dig"]'),null);const flag=content.querySelector('#coursePathways .milestone[data-launch-sco="opaque-ai"]');assert.ok(flag);flag.click();assert.deepEqual(calls.at(-1),['opaque-ai']);
        renderCourseOverview(app,'module-fw-ai');assert.equal(content.getAttribute('data-view'),'module');assert.equal(content.querySelector('.collapsible-card .card-body').hidden,false);
    }));

    test(root+': diagnostics distinguish missing tests from a genuine completed zero, without foreign attempts or fake chart history',async()=>withDOM(async({document})=>{
        const {buildDashboardModel,renderDashboard}=await loadModule('multiDashboard',root),{createState}=await loadModule('multiState',root);const contract=diagnostic(uxFixture()),content=document.createElement('section');document.body.append(content);const calls=[],app={contract,state:createState(contract),content,charts:[],launchSCO:(...args)=>calls.push(args),showResult:attempt=>calls.push(['result',attempt]),getLearningActivity:()=>[]};seed(app);
        const as=contract.assessments[0];app.state.scoStates[as.scoId]={...record(contract.scos.find(s=>s.id===as.scoId),true),native:{format:1,complete:true,components:{'native-alias':{required:true,state:{_isComplete:true,_isSubmitted:true,_isCorrect:false,_score:0}}}}};app.state.assessmentAttempts['fw-dig']={[as.id]:{good:zeroAttempt(),foreign:{...zeroAttempt(),frameworkId:'fw-ai'},pending:{...zeroAttempt(),completed:false}}};
        const model=buildDashboardModel(app,'fw-dig');assert.equal(model.diagnostics.entry.attempts.length,1);assert.equal(model.diagnostics.entry.attempts[0].score,0);renderDashboard(app,'fw-dig');assert.match(content.querySelector('#template_entryTest').textContent,/0\/2 Punkte/);assert.ok(content.querySelector('[data-chart-empty="pulse"]'));content.querySelector('[data-launch-sco="opaque-diagnostic"]').click();assert.deepEqual(calls.at(-1),['opaque-diagnostic']);content.querySelector('[data-result-attempt="actual-zero"]').click();assert.equal(calls.at(-1)[1].score,0);
        renderDashboard(app,'fw-ai');const missing=content.querySelector('#template_entryTest');assert.ok(missing.querySelector('[data-diagnostic-status="notProvided"]'));assert.equal(missing.querySelector('[data-launch-sco]'),null);assert.doesNotMatch(missing.textContent,/0\s*%|0\/\d|bestanden|abgeschlossen/i);assert.equal(buildDashboardModel(app,'fw-ai').diagnostics.entry.attempts.length,0);
    }));

    test(root+': pathway flags retain distinct explicit module and course numbers',async()=>withDOM(async({document})=>{
        const {renderDashboard}=await loadModule('multiDashboard',root),{createState}=await loadModule('multiState',root),contract=uxFixture(),other={...structuredClone(contract.scos[0]),id:'opaque-second-module-course',moduleId:'opaque-second-module'};
        contract.modules.push({id:other.moduleId,frameworkId:'fw-dig',number:'9',label:'Other module'});contract.scos.push(other);contract.pathways.push({id:'opaque-cross-module-path',frameworkId:'fw-dig',label:'Two modules',courseIds:['opaque-dig',other.id]});
        const content=document.createElement('section');document.body.append(content);const calls=[],app={contract,state:createState(contract),content,charts:[],launchSCO:id=>calls.push(id)};
        renderDashboard(app,'fw-dig');assert.deepEqual(content.querySelectorAll('.milestone-label').map(control=>control.textContent),['M5.10','M9.10'],'Duplicate course numbers stay unambiguous across modules without parsing opaque IDs');
        const flag=content.querySelector('[data-pathway-id="opaque-cross-module-path"] [data-launch-sco="opaque-second-module-course"]');assert.match(flag.getAttribute('aria-label'),/^M9\.10 /);flag.click();assert.equal(calls.at(-1),other.id);
        renderDashboard(app,'fw-ai');assert.equal(content.querySelector('.milestone-label').textContent,'1.10','Other frameworks retain explicit numbers without a misleading DigComp M-prefix');
    }));

    test(root+': information dialogs contain keyboard focus, close through document Escape and clean up',async()=>withDOM(async({document})=>{
        const {renderDashboard}=await loadModule('multiDashboard',root),{createState}=await loadModule('multiState',root),contract=uxFixture(),content=document.createElement('section');document.body.append(content);
        const app={contract,state:createState(contract),content,charts:[],launchSCO(){}},view=renderDashboard(app,'fw-dig'),icon=content.querySelector('[aria-controls="infoModalCompetences"]'),modal=content.querySelector('#infoModalCompetences'),close=modal.querySelector('button'),last=modal.querySelector('a[href]');
        const keyboard=(key,shiftKey=false)=>{const event={key,shiftKey,preventDefault(){this.prevented=true;},stopPropagation(){}};for(const listener of [...document.listeners.get('keydown')||[]])listener(event);return event;};
        icon.focus();icon.click();assert.equal(modal.getAttribute('aria-modal'),'true');assert.equal(document.activeElement,close);assert.equal(document.listeners.get('keydown').length,1);
        assert.equal(keyboard('Tab',true).prevented,true);assert.equal(document.activeElement,last,'Shift+Tab on the first control wraps to the final dialog action');
        assert.equal(keyboard('Tab').prevented,true);assert.equal(document.activeElement,close,'Tab on the final control wraps back into the dialog');
        const outside=document.querySelector('.navbar-brand');outside.focus();for(const listener of document.listeners.get('focusin')||[])listener({target:outside});assert.equal(document.activeElement,close,'Programmatic focus leaving the dialog is returned');
        outside.focus();keyboard('Escape');assert.equal(modal.getAttribute('aria-hidden'),'true');assert.equal(document.activeElement,icon);assert.equal(document.listeners.get('keydown').length,0);assert.equal(document.listeners.get('focusin').length,0);assert.equal(document.querySelector('.modal-backdrop'),null);
        icon.click();view.destroy();assert.equal(document.listeners.get('keydown').length,0);assert.equal(document.listeners.get('focusin').length,0);assert.equal(document.querySelector('.modal-backdrop'),null,'Replacing the dashboard cannot leave a modal overlay behind');
    }));

    test(root+': integrated glossary keeps multiword matches, all results and framework-scoped launch targets',async()=>withDOM(async({document,window})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),contract=uxFixture();contract.glossary=[...['Software','Computer','Computersoftware'].map((term,index)=>({id:'dig-term-'+index,frameworkId:'fw-dig',term,definition:'Definition',targets:[{scoId:'opaque-dig',contentId:'page-'+index}]})),...Array.from({length:40},(_,index)=>({id:'data-'+index,frameworkId:'fw-dig',term:'Datenbegriff '+index,targets:[{scoId:'opaque-dig',contentId:'data-'+index}]})),{id:'foreign-term',frameworkId:'fw-ai',term:'Computer AILit',targets:[{scoId:'opaque-ai',contentId:'page-ai'}]}];
        const app=new MultiFrameworkApp(contract,{api:null,storage:memory(),environment:window});window.App=app;app.init();const panel=document.querySelector('.mf-glossary-menu'),input=panel.querySelector('input'),terms=()=>panel.querySelectorAll('.glossary-term strong').map(control=>control.textContent);
        input.value='computer software';input.dispatchEvent({type:'input'});assert.deepEqual(terms(),['Computersoftware','Computer','Software']);assert.equal(panel.textContent.includes('Computer AILit'),false,'An active-framework search cannot expose another framework');
        input.value='daten';input.dispatchEvent({type:'input'});assert.equal(terms().length,40,'No matching entries disappear behind the previous implicit 25-entry limit');
        const calls=[];app.launchSCO=(...args)=>calls.push(args);panel.querySelector('.glossary-term button').click();assert.deepEqual(calls.at(-1),['opaque-dig','data-0']);
        app.showFramework('fw-ai');input.value='computer software';input.dispatchEvent({type:'input'});assert.deepEqual(terms(),['Computer AILit']);panel.querySelector('.glossary-term button').click();assert.deepEqual(calls.at(-1),['opaque-ai','page-ai']);
    }));

    test(root+': init keeps the actual original navbar and presentation iframe, adds only compact framework selection',async()=>withDOM(async({document,window})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),contract=uxFixture(),selectors=['header','#main-navbar','.navbar-brand','#template_glossary','#breadcrumb-container','#startBoarding','#template_xp','#sco-frame'],originals=new Map(selectors.map(selector=>[selector,document.querySelector(selector)]));for(const[selector,node]of originals)assert.ok(node,'Original index actually contains '+selector);
        const app=new MultiFrameworkApp(contract,{api:null,storage:memory(),environment:window});window.App=app;seed(app);app.init();
        assert.equal(app.getExperiencePoints('fw-dig'),3);assert.equal(app.getExperiencePoints('fw-ai'),2);
        for(const[selector,node]of originals)assert.equal(document.querySelector(selector),node,'init must preserve the SAME original '+selector+' node');
        assert.equal(originals.get('header').hidden,false);assert.notEqual(originals.get('header').style.display,'none');assert.notEqual(originals.get('#main-navbar').getAttribute('aria-hidden'),'true');
        assert.equal(document.querySelector('.mf-navigation'),null);const select=document.querySelector('#main-navbar select[data-framework-selector]');assert.ok(select);assert.deepEqual(select.options.filter(option=>option.value).map(option=>option.value).sort(),['fw-ai','fw-dig']);assert.match(select.textContent,/DigComp.*2\.2/);assert.match(select.textContent,/AILit.*2026/);
        assert.notEqual(app.content.ownerDocument,document);assert.equal(app.content.ownerDocument,originals.get('#sco-frame').contentDocument);assertDashboard(app.content);assert.equal(app.content.querySelector('input[type="file"]'),null);
        select.value='fw-ai';select.dispatchEvent({type:'change'});assert.equal(app.content.getAttribute('data-framework-id'),'fw-ai');assertDashboard(app.content);assert.equal(document.querySelector('#template_xp'),originals.get('#template_xp'));
        assert.equal(typeof app.renderView,'function','The original Home javascript:App.renderView action remains supported');app.showDiagnostics();assert.ok(app.content.querySelector('[data-section="migration"]'));app.renderView(app.SCO_FRAME,'views/dashboard/index.html');assertDashboard(app.content);assert.equal(document.querySelector('header'),originals.get('header'));
        app.transport.storage={getItem(){return null;},setItem(){throw Error('QuotaExceeded unit failure');}};assert.equal(app.save(),false);const alert=document.getElementById('mf-storage-alert');assert.equal(alert.hidden,false);assert.match(alert.textContent,/QuotaExceeded/);assert.equal(app.feedback.hidden,false,'A genuine persistence error cannot be hidden in the compact technical menu');assert.ok(app.transport.lastBackup);assertDashboard(app.content);
    }));

    test(root+': every course launch keeps the navbar, fills a fresh bridge frame and allows fullscreen media without stale identities',async()=>withDOM(async({document,window})=>{
        const {MultiFrameworkApp}=await loadModule('multiFramework',root),app=new MultiFrameworkApp(uxFixture(),{api:null,storage:memory(),environment:window});window.App=app;app.init();const header=document.querySelector('header'),dashboard=document.getElementById('sco-frame'),outerAPI=window.API;
        const first=app.launchSCO('opaque-dig'),firstHost=app.launchHost,firstFrame=app.SCO_FRAME,firstBridge=firstHost.contentWindow.API;
        assert.equal(firstHost.parentNode,app.courseArea);assert.equal(firstFrame.parentNode,firstHost.contentDocument.body);assert.ok(firstHost.allowFullscreen&&firstFrame.allowFullscreen,'Both bridge and real course iframe allow fullscreen media');assert.equal(app.courseArea.hidden,false);assert.equal(document.querySelector('header'),header);assert.equal(document.getElementById('sco-frame'),dashboard);
        const launchEvent=document.events.find(event=>event.type==='iframe-src'&&event.frame===firstFrame);assert.ok(launchEvent);assert.equal(launchEvent.bridge,firstBridge,'The immutable bridge is installed BEFORE course navigation');assert.match(launchEvent.value,/scos\/opaque-dig\/index_lms\.html$/);
        const second=app.launchSCO('opaque-ai');assert.notEqual(app.launchHost,firstHost);assert.notEqual(app.SCO_FRAME,firstFrame);assert.equal(firstHost.parentNode,null);assert.equal(first.frameworkId,'fw-dig');assert.equal(second.frameworkId,'fw-ai');assert.ok(Object.isFrozen(first)&&Object.isFrozen(second));assert.equal(window.API,outerAPI);
        assert.equal(header.hidden,false);assert.notEqual(header.style.display,'none');assert.ok(app.launchHost.allowFullscreen&&app.SCO_FRAME.allowFullscreen);
        firstBridge.LMSSetValue('cmi.suspend_data','late opaque old-course state');assert.equal(app.state.scoStates['opaque-dig'].payload,'late opaque old-course state');assert.notEqual(app.state.scoStates['opaque-ai'].payload,'late opaque old-course state');app.showFramework('fw-ai');assertDashboard(app.content);assert.equal(document.querySelector('header'),header);assert.equal(app.courseArea.hidden,true);
    }));
}
