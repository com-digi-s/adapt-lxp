// Independent integration-level tests of actual source AND delivered state code.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fixture,loadModule} from './multi-fixture.mjs';

const memory=()=>{const data=new Map();return{data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function lms(options={}){
 const data=new Map(),calls=[];let error='0';
 const api={calls,data,LMSInitialize(){calls.push(['initialize']);return options.initializeFalse?'false':'true';},
  LMSGetLastError:()=>error,
  LMSGetValue(k){calls.push(['get',k]);if(options.readError){error='101';return'';}error='0';const v=data.get(k)||'';return options.truncate&&k==='cmi.suspend_data'?v.slice(0,-1):v;},
  LMSSetValue(k,v){calls.push(['set',k,v]);if(options.setFalse){error='101';return'false';}data.set(k,String(v));error='0';return'true';},
  LMSCommit(){calls.push(['commit']);error=options.commitFalse?'101':'0';return options.commitFalse?'false':'true';},
  LMSFinish(){calls.push(['finish']);return options.finishFalse?'false':'true';}};
 return api;
}
function diagnostic(c){
 const hash='b'.repeat(64);const learning=c.scos[0];
 c.scos.push({id:'diag-dig',frameworkId:learning.frameworkId,role:'entry',requiredForCompletion:false,label:'Entry',source:{kind:'generated-assessment',buildSha256:hash,catalogueSha256:hash,generatorSha256:hash,templateSha256:hash,questions:['q-dig']},launch:{root:'scos/diag-dig',entry:'index.html',manifestHref:'index.html'}});
 c.frameworks[0].diagnostics.entry={intent:'require',status:'provided',reason:null};
 c.domains.push({id:'verstehen',frameworkId:learning.frameworkId,label:'Verstehen'});
 c.questions.push({id:'q-dig',sourceCourseId:learning.id,sourceComponentId:'native-question',runtimeQuestionId:'native-q',component:'mcq',tags:['et'],available:true,selfAssessment:false,maxPoints:1});
 c.assessments.push({id:'test-dig',frameworkId:learning.frameworkId,scoId:'diag-dig',phase:'entry',banks:[{id:'bank-dig',runtimeBankId:111,targetCourseId:learning.id,domainId:'verstehen',questionIds:['q-dig'],maxPoints:1}]});
 return c;
}
async function codecEnvironment(){
 const context={};vm.createContext(context);
 for(const f of ['base64.js','rawdeflate.js','rawinflate.js'])vm.runInContext(await readFile(new URL('../dist/libraries/'+f,import.meta.url),'utf8'),context);
 return context;
}
const environment=await codecEnvironment();

for(const root of ['../js','../dist/js']){
 const {createState,hydrateState,fingerprint,localStateKey,encodeState,decodeState,migrateLegacy,findLMS,StateTransport}=await loadModule('multiState',root);
 const record=(sco,payload='{"q":"echte Antwort: äöü 😀"}')=>({frameworkId:sco.frameworkId,fingerprint:fingerprint(sco),payload,values:{'cmi.core.lesson_status':'incomplete'},native:null});

 test(root+': independent immutable defaults and package/profile/attempt keys',()=>{
  const c=fixture(),a=createState(c),b=createState(c),before=structuredClone(c);
  a.frameworkBookmarks.x={scoId:'anything'};assert.deepEqual(b.frameworkBookmarks,{});assert.deepEqual(c,before);
  const d=structuredClone(c);d.package.id='another';assert.notEqual(localStateKey(c,'u','a'),localStateKey(d,'u','a'));
  assert.notEqual(localStateKey(c,'u1','a'),localStateKey(c,'u2','a'));assert.notEqual(localStateKey(c,'u','a1'),localStateKey(c,'u','a2'));
  assert.notEqual(localStateKey(c,'a:b','c'),localStateKey(c,'a','b:c'));d.package.id=c.package.id;d.package.revision='r2';assert.equal(localStateKey(c,'u','a'),localStateKey(d,'u','a'));
 });
 test(root+': actual shipped JSON+compressed codecs preserve Unicode and opaque child suspend payloads',()=>{
  const c=fixture(),s=createState(c);s.scoStates[c.scos[0].id]=record(c.scos[0],'opaque:☃/ä/😀/\u0000');
  for(const env of [{},environment]){const encoded=encodeState(s,env);assert.deepEqual(decodeState(encoded,env),s);}
  assert.throws(()=>decodeState('old unrelated cmi.suspend_data',environment));assert.throws(()=>decodeState('LXP1J:{',environment));
 });
 test(root+': reject foreign package and schema, retain exact compatible state across revision',()=>{
  const c=fixture(),s=createState(c);s.activeFrameworkId=c.frameworks[1].id;s.scoStates[c.scos[0].id]=record(c.scos[0]);s.frameworkBookmarks[c.frameworks[0].id]={scoId:c.scos[0].id,contentId:'page-a'};
  const before=structuredClone(s),updated=structuredClone(c);updated.package.revision='r2';const h=hydrateState(updated,s);
  assert.deepEqual(h.state.scoStates,s.scoStates);assert.deepEqual(h.state.frameworkBookmarks,s.frameworkBookmarks);assert.equal(h.state.contentRevision,'r2');assert.ok(h.warnings.length);assert.deepEqual(s,before);
  assert.throws(()=>hydrateState({...c,package:{...c.package,id:'foreign'}},s));assert.throws(()=>hydrateState(c,{...s,stateVersion:999}));
 });
 test(root+': incompatibility drops only affected state/bookmark and never attributes it to another frame',()=>{
  const c=fixture(),s=createState(c);for(const sco of c.scos){s.scoStates[sco.id]=record(sco);s.frameworkBookmarks[sco.frameworkId]={scoId:sco.id,contentId:'page'};}
  const changed=structuredClone(c);changed.scos[0].source.buildSha256='f'.repeat(64);
  const h=hydrateState(changed,s);assert.equal(h.state.scoStates[c.scos[0].id],undefined);assert.deepEqual(h.state.scoStates[c.scos[1].id],s.scoStates[c.scos[1].id]);assert.equal(h.state.frameworkBookmarks[c.frameworks[0].id],undefined);assert.ok(h.warnings.length);
  s.scoStates[c.scos[0].id].frameworkId=c.frameworks[1].id;assert.equal(hydrateState(c,s).state.scoStates[c.scos[0].id],undefined);
 });
 test(root+': malformed completed assessment attempts are dropped with warnings, genuine zero survives',()=>{
  const c=diagnostic(fixture()),s=createState(c),sco=c.scos.find(x=>x.id==='diag-dig');s.scoStates[sco.id]=record(sco);
  const fw=sco.frameworkId,attempt={attemptId:'a1',frameworkId:fw,assessmentId:'test-dig',phase:'entry',completed:true,completedAt:'2026-10-26T00:00:00Z',score:0,maxScore:1,banks:{'bank-dig':{score:0,maxScore:1}},courses:{'opaque-dig':{score:0,maxScore:1}},domains:{verstehen:{score:0,maxScore:1}},questions:{'q-dig':{score:0,maxScore:1}}};
  s.assessmentAttempts[fw]={'test-dig':{a1:attempt}};assert.equal(hydrateState(c,s).state.assessmentAttempts[fw]['test-dig'].a1.score,0);
  s.assessmentAttempts[fw]['test-dig']='corrupt';const h=hydrateState(c,s);assert.equal(h.state.assessmentAttempts[fw]?.['test-dig'],undefined);assert.ok(h.warnings.length);
  s.assessmentAttempts[fw]['test-dig']={a1:{...attempt,frameworkId:'foreign'}};assert.equal(hydrateState(c,s).state.assessmentAttempts[fw]['test-dig'].a1,undefined);
 });
 test(root+': changed test selections explain the reset once while preserving learning state and original backup data',()=>{
  const c=diagnostic(fixture()),s=createState(c),sco=c.scos.find(x=>x.id==='diag-dig'),learning=c.scos[0];
  sco.label='DigComp – Einstiegstest';s.scoStates[sco.id]=record(sco,'old native test answers');s.scoStates[learning.id]=record(learning,'actual unchanged learning progress');
  s.frameworkBookmarks[sco.frameworkId]={scoId:sco.id,contentId:'test-page'};s.assessmentAttempts[sco.frameworkId]={'test-dig':{old:{attemptId:'old'}}};
  const before=structuredClone(s),changed=structuredClone(c);changed.scos.find(x=>x.id===sco.id).source.buildSha256='f'.repeat(64);
  const result=hydrateState(changed,s);
  assert.equal(result.state.scoStates[sco.id],undefined);assert.equal(result.state.assessmentAttempts[sco.frameworkId]?.['test-dig'],undefined);
  assert.deepEqual(result.state.scoStates[learning.id],s.scoStates[learning.id]);assert.deepEqual(s,before,'The exact original input remains available for the enclosing backup mechanism');
  assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/DigComp – Einstiegstest.*aktualisiert.*neu beginnen/);assert.doesNotMatch(result.warnings[0],/diag-dig|test-dig/);
 });
 test(root+': explicit local mode roundtrips large state but never claims remote LMS success',()=>{
  const c=fixture(),s=createState(c),storage=memory(),events=[];s.scoStates[c.scos[0].id]=record(c.scos[0],'large'.repeat(2000));
  const transport=new StateTransport({contract:c,storage,environment:{},onStatus:s=>events.push(s)});
  assert.equal(transport.save(s,false),true);assert.deepEqual(transport.load(),s);assert.equal(transport.status.kind,'local');assert.equal(transport.status.overBudget,true);assert.match(transport.status.message,/LMS/i);assert.notEqual(transport.status.kind,'lms');
 });
 test(root+': genuine API receives one global status and exact payload, no fabricated score100',()=>{
  const c=fixture(),s=createState(c),api=lms(),storage=memory();const t=new StateTransport({contract:c,api,storage,environment:{}});
  assert.equal(t.save(s,false),true);assert.equal(t.status.kind,'lms');assert.deepEqual(t.load(),s);assert.equal(api.data.get('cmi.core.lesson_status'),'incomplete');
  assert.equal(t.save(s,true),true);assert.equal(api.data.get('cmi.core.lesson_status'),'completed');assert.equal(api.calls.filter(c=>c[0]==='set'&&c[1]==='cmi.core.score.raw').length,0);
 });
 test(root+': remote overbudget never writes/truncates, while exact memory/local backup stays available',()=>{
  const c=fixture(),s=createState(c);s.scoStates[c.scos[0].id]=record(c.scos[0],'large'.repeat(2000));const api=lms(),storage=memory(),t=new StateTransport({contract:c,api,storage,environment:{}});
  assert.equal(t.save(s,true),false);assert.equal(t.status.kind,'error');assert.equal(api.calls.filter(c=>c[0]==='set').length,0);assert.equal(JSON.parse(t.lastBackup).scoStates[c.scos[0].id].payload,s.scoStates[c.scos[0].id].payload);assert.deepEqual(decodeState(storage.getItem(t.key),{}),s);
 });
 test(root+': initialization rejection is not downgraded into a successful local LMS save',()=>{
  const c=fixture(),s=createState(c),api=lms({initializeFalse:true}),storage=memory(),t=new StateTransport({contract:c,api,storage,environment:{}});
  assert.equal(t.save(s,false),false);assert.equal(t.status.kind,'error');assert.equal(api.calls.filter(c=>c[0]==='commit').length,0);assert.ok(t.lastBackup);
 });
 test(root+': real API still persists if browser storage is denied; warning retains memory backup',()=>{
  const c=fixture(),s=createState(c),api=lms(),storage={getItem(){throw Error('SecurityError');},setItem(){throw Error('QuotaExceeded');}};
  const t=new StateTransport({contract:c,api,storage,environment:{}});assert.equal(t.save(s,false),true);assert.equal(t.status.kind,'lms');assert.equal(t.status.localBackupFailed,true);assert.deepEqual(t.load(),s);assert.ok(t.lastBackup);
 });
 test(root+': local denial without API reports failure and keeps downloadable memory state',()=>{
  const c=fixture(),s=createState(c),storage={getItem(){return null;},setItem(){throw Error('Quota');}},t=new StateTransport({contract:c,storage,environment:{}});
  assert.equal(t.save(s,false),false);assert.equal(t.status.kind,'error');assert.deepEqual(JSON.parse(t.lastBackup),s);
 });
 test(root+': SetValue, Commit and truncated readback all fail visibly without false success',()=>{
  for(const options of [{setFalse:true},{commitFalse:true},{truncate:true}]){const c=fixture(),t=new StateTransport({contract:c,api:lms(options),storage:memory(),environment:{}});assert.equal(t.save(createState(c),true),false);assert.equal(t.status.kind,'error');assert.ok(t.lastBackup);}
 });
 test(root+': corrupted LMS state cannot silently become a new local state',()=>{
  const c=fixture(),api=lms();api.data.set('cmi.suspend_data','broken');const t=new StateTransport({contract:c,api,storage:memory(),environment:{}});assert.throws(()=>t.load());assert.equal(t.status.kind,'error');
 });
 test(root+': finish is idempotent and commits session time once',()=>{
  const c=fixture(),api=lms(),t=new StateTransport({contract:c,api,storage:memory(),environment:{}}),s=createState(c);
  assert.equal(t.finish(s,false),true);assert.equal(t.finish(s,false),true);assert.equal(api.calls.filter(c=>c[0]==='finish').length,1);assert.equal(api.calls.filter(c=>c[0]==='set'&&c[1]==='cmi.core.session_time').length,1);
 });
 test(root+': real external LMS discovery skips LXP bridges and terminates cyclic parents',()=>{
  const api=lms(),parent={API:api};parent.parent=parent;const child={API:{__adaptLXPBridge:true},parent};assert.equal(findLMS(child),api);
  const a={},b={};a.parent=b;b.parent=a;assert.equal(findLMS(a),null);
 });
 test(root+': proven legacy migration preserves opaque payload/native/core state and is idempotent',()=>{
  const c=fixture(),sco=c.scos[0],hash=fingerprint(sco),payload='#native-opaque';
  const envelope={packageId:'known-old',revision:'old-r1',fingerprints:{'M1.1':hash},data:{adaptData:{'M1.1':payload},bookmark:'M1.1',customData:{nativeAdapt:{'M1.1':{format:1,complete:true,components:{}}},scoState:{'M1.1':{'cmi.core.lesson_status':'completed'}},'old-score-note':{untouched:0}}}};
  const plan={id:'migration-1',confirmed:true,targetPackageId:c.package.id,sourcePackageId:'known-old',sourceRevision:'old-r1',scoAliases:{'M1.1':{scoId:sco.id,frameworkId:sco.frameworkId,sourceFingerprint:hash,targetFingerprint:hash}},bookmarkAliases:{'M1.1':{scoId:sco.id,frameworkId:sco.frameworkId,contentId:'page-old'}},opaqueContainerAliases:{'old-score-note':'archived-score-note'}};
  const before=structuredClone(envelope),first=migrateLegacy(c,envelope,plan);
  assert.deepEqual(first.backup,before);assert.equal(first.state.scoStates[sco.id].payload,payload);assert.equal(first.state.scoStates[sco.id].native.complete,true);assert.equal(first.state.frameworkBookmarks[sco.frameworkId].contentId,'page-old');assert.deepEqual(first.state.migration.opaque['archived-score-note'],{untouched:0});assert.deepEqual(envelope,before);
  const again=migrateLegacy(c,envelope,plan,first.state);assert.equal(again.report.alreadyApplied,true);assert.equal(again.backup,null);assert.deepEqual(again.state,first.state);
  assert.throws(()=>migrateLegacy(c,envelope,{...plan,confirmed:false}));assert.throws(()=>migrateLegacy(c,{...envelope,packageId:'unknown'},plan));
  const bad=structuredClone(plan);bad.scoAliases['M1.1'].targetFingerprint='wrong';const rejected=migrateLegacy(c,envelope,bad);assert.equal(rejected.state.scoStates[sco.id],undefined);assert.ok(rejected.report.rejected.includes('M1.1'));
  const duplicate=structuredClone(plan);duplicate.scoAliases['M2.1']=structuredClone(duplicate.scoAliases['M1.1']);assert.throws(()=>migrateLegacy(c,envelope,duplicate),/Kollision|collision/i);
 });
}
