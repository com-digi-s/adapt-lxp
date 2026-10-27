import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,loadModule} from './multi-fixture.mjs';
for(const root of ['../js','../dist/js']){
    const {createBridge}=await loadModule('multiBridge',root),{validateContract}=await loadModule('multiContract',root),{createState}=await loadModule('multiState',root);
    test(`${root}: bound old bridge preserves opaque payload, completion and interaction state after fast framework switch`,()=>{
        const contract=fixture(),app={catalog:validateContract(contract),state:createState(contract),save:()=>true,recordLocation:()=>{},warn:()=>{},transport:{get:()=>'',status:{message:'test'}}};
        const first=createBridge(app,{scoId:'opaque-dig',frameworkId:'fw-dig',role:'learning',assessmentId:null});
        const second=createBridge(app,{scoId:'opaque-ai',frameworkId:'fw-ai',role:'learning',assessmentId:null});
        assert.equal(first.LMSSetValue('cmi.suspend_data','uninterpreted-spoor\u00e4'), 'true');
        second.LMSSetValue('cmi.suspend_data','AILit answer');first.LMSSetValue('cmi.core.lesson_status','completed');first.LMSSetValue('cmi.interactions.0.id','same-native');
        assert.equal(first.LMSGetValue('cmi.suspend_data'),'uninterpreted-spoor\u00e4');assert.equal(second.LMSGetValue('cmi.suspend_data'),'AILit answer');
        assert.equal(second.LMSGetValue('cmi.core.lesson_status'),'not attempted');assert.equal(second.LMSGetValue('cmi.interactions._count'),'0');
        const record=app.state.scoStates['opaque-dig'];delete app.state.scoStates['opaque-dig'];
        const third=createBridge(app,{scoId:'opaque-dig',frameworkId:'fw-dig',role:'learning',assessmentId:null});
        third.LMSSetValue('cmi.suspend_data','new attempt');first.LMSSetValue('cmi.suspend_data','late old unload');
        assert.equal(record.payload,'late old unload');assert.equal(third.LMSGetValue('cmi.suspend_data'),'new attempt');
    });
    test(`${root}: child commits report failure honestly and finish is idempotent without finishing outer LMS`,()=>{
        const c=fixture();let saves=0;const app={catalog:validateContract(c),state:createState(c),save:()=>{saves++;return false},warn:()=>{},recordLocation:()=>{},transport:{status:{message:'LMS failure'}}};
        const bridge=createBridge(app,{scoId:'opaque-ai',frameworkId:'fw-ai',role:'learning',assessmentId:null});
        assert.equal(bridge.LMSSetValue('cmi.suspend_data','safe in memory'),'false');assert.equal(bridge.LMSGetLastError(),'101');
        assert.equal(bridge.LMSFinish(''),'false');const count=saves;assert.equal(bridge.LMSFinish(''),'false');assert.equal(saves,count);
    });
    test(`${root}: outer finalization explicitly suspends its learner attempt exactly once for LMS resume`,async()=>{
        const {StateTransport,createState}=await loadModule('multiState',root),c=fixture(),values=new Map(),calls=[];
        const api={LMSInitialize:()=> 'true',LMSGetLastError:()=> '0',LMSSetValue:(key,value)=>{calls.push([key,value]);values.set(key,value);return'true';},LMSGetValue:key=>values.get(key)||'',LMSCommit:()=> 'true',LMSFinish:()=> 'true'};
        const transport=new StateTransport({contract:c,api,storage:{setItem(){},getItem(){return null;}},environment:{}});
        assert.equal(transport.finish(createState(c),false),true);assert.equal(transport.finish(createState(c),false),true);
        assert.deepEqual(calls.filter(([key])=>key==='cmi.core.exit'),[['cmi.core.exit','suspend']]);
    });
}
