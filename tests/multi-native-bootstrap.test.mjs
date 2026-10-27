import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadModule} from './multi-fixture.mjs';
for(const root of ['../js','../dist/js']){
 const {MultiFrameworkApp}=await loadModule('multiFramework',root);
 test(root+': an injected native bundle does not trigger a guessed public AMD script fetch',()=>{
  let requests=0;const require=()=>{requests++;throw Error('guessed module request');};require.defined=()=>false;
  const child={require,addEventListener(){}},context={launchId:'native-launch'},app={contexts:new WeakMap(),controllers:new Map([['native-launch',{mode:'spoor'}]]),warn:message=>{throw Error(message);}};
  MultiFrameworkApp.prototype.bindChild.call(app,{contentWindow:child},context);assert.equal(requests,0);assert.equal(app.contexts.get(child),context);
 });
 test(root+': only already-defined explicit Adapt modules are resolved synchronously',()=>{
  for(const available of [null,'core/js/adapt','coreJS/adapt']){
   const calls=[],Adapt={real:true},require=name=>{calls.push(name);assert.equal(name,available);return Adapt;};require.defined=id=>id===available;
   const child={require,addEventListener(){}},context={launchId:'launch'},attached=[];
   const app={contexts:new WeakMap(),controllers:new Map(),attachAdaptPersistence:(...args)=>attached.push(args),warn:message=>{throw Error(message);}};
   MultiFrameworkApp.prototype.bindChild.call(app,{contentWindow:child},context);
   assert.equal(calls.length,available?1:0);assert.equal(attached.length,available?1:0);if(available)assert.deepEqual(attached[0],[Adapt,child]);
  }
 });
}
