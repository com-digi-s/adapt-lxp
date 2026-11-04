import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {fixture,loadModule} from './multi-fixture.mjs';
for(const root of ['../js','../dist/js']){
 const {MultiFrameworkApp}=await loadModule('multiFramework',root);
 test(root+': an injected native bundle does not trigger a guessed public AMD script fetch',()=>{
  let requests=0;const require=()=>{requests++;throw Error('guessed module request');};require.defined=()=>false;
  const child={require,addEventListener(){}},context={launchId:'native-launch'},app={contexts:new WeakMap(),controllers:new Map([['native-launch',{mode:'spoor'}]]),bindLearningLinks(){},warn:message=>{throw Error(message);}};
  MultiFrameworkApp.prototype.bindChild.call(app,{contentWindow:child},context);assert.equal(requests,0);assert.equal(app.contexts.get(child),context);
 });
 test(root+': only already-defined explicit Adapt modules are resolved synchronously',()=>{
  for(const available of [null,'core/js/adapt','coreJS/adapt']){
   const calls=[],Adapt={real:true},require=name=>{calls.push(name);assert.equal(name,available);return Adapt;};require.defined=id=>id===available;
   const child={require,addEventListener(){}},context={launchId:'launch'},attached=[];
   const app={contexts:new WeakMap(),controllers:new Map(),bindLearningLinks(){},attachAdaptPersistence:(...args)=>attached.push(args),warn:message=>{throw Error(message);}};
   MultiFrameworkApp.prototype.bindChild.call(app,{contentWindow:child},context);
   assert.equal(calls.length,available?1:0);assert.equal(attached.length,available?1:0);if(available)assert.deepEqual(attached[0],[Adapt,child]);
  }
 });
 test(root+': immutable launch context forwards only its validated text display evidence to native Core',async()=>{
  const {attachCorePersistence}=await loadModule('corePersistence',root),{validateContract}=await loadModule('multiContract',root),{createState,hydrateState,fingerprint}=await loadModule('multiState',root);
  function native(displayTitle){
   const model=new EventEmitter();model.attributes={_id:'text-1',_component:'text',title:'Generated heading',displayTitle,body:'Actual unchanged prose',_isComplete:false};
   model.get=key=>model.attributes[key];model.getAttemptObject=()=>({...model.attributes});model.setAttemptObject=state=>Object.assign(model.attributes,state);
   const Adapt=new EventEmitter();Adapt.components={models:[model]};
   const child=new EventEmitter();child.addEventListener=child.on.bind(child);child.document=new EventEmitter();child.document.addEventListener=child.document.on.bind(child.document);
   return{Adapt,model,child};
  }
  const old=fixture(),sco=old.scos[0],initial=native('Generated heading'),facade={DATA:{'cmi.suspend_data':{customData:{}}},SCORM_API:{set(){}}};
  const first=attachCorePersistence(facade,initial.Adapt,initial.child,sco.id);initial.model.attributes._isComplete=true;first.save();
  const input=createState(old);input.scoStates[sco.id]={frameworkId:sco.frameworkId,fingerprint:fingerprint(sco),payload:'',values:{},native:facade.DATA['cmi.suspend_data'].customData.nativeAdapt[sco.id]};
  const current=structuredClone(old);current.scos[0].source.componentFingerprint='b'.repeat(64);
  current.scos[0].source.presentationCompatibility={version:1,rule:'markledge-generated-display-v1',proofs:[{previousFingerprint:fingerprint(sco),path:`presentation-compatibility/${sco.id}/${fingerprint(sco)}.json`,sha256:'c'.repeat(64),componentDisplayTitles:[{componentId:'text-1',previousDisplayTitle:'Generated heading',currentDisplayTitle:''}]}]};
  const catalog=validateContract(current),state=hydrateState(catalog.contract,input).state,restored=native(''),context=Object.freeze({scoId:sco.id,frameworkId:sco.frameworkId,role:'learning',launchId:'bound-launch'});
  let saves=0;const app={catalog,state,contexts:new WeakMap([[restored.child,context]]),controllers:new Map(),captureLocation(){},save(){saves++;}};
  const controller=MultiFrameworkApp.prototype.attachAdaptPersistence.call(app,restored.Adapt,restored.child);
  assert.equal(restored.model.get('_isComplete'),true);assert.equal(restored.model.get('displayTitle'),'');
  assert.equal(state.scoStates[sco.id].native.components['text-1'].fingerprint,input.scoStates[sco.id].native.components['text-1'].fingerprint);
  controller.save();assert.equal(saves,1);assert.notEqual(state.scoStates[sco.id].native.components['text-1'].fingerprint,input.scoStates[sco.id].native.components['text-1'].fingerprint);
 });
}
