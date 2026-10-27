import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadModule, fixture } from './multi-fixture.mjs';

for (const root of ['../js','../dist/js']) {
    const {validateContract,validateCapabilities,launchPath,safeRelativePath,progress,courseComplete} = await loadModule('multiContract',root);
    test(`${root}: wrapper capability version and complete implementation declaration are mandatory`, async () => {
        const cap=JSON.parse(await readFile(new URL('../dist/adapt-multi-framework-capabilities.json',import.meta.url),'utf8'));
        assert.equal(validateCapabilities(cap),cap);assert.throws(()=>validateCapabilities({...cap,version:2}));assert.throws(()=>validateCapabilities({...cap,persistenceContract:2}));assert.throws(()=>validateCapabilities({...cap,implementationFiles:{}}));
    });
    test(`${root}: typed product graph is immutable and opaque IDs separate both frameworks`, () => {
        const input=fixture(), catalog=validateContract(input);
        assert.equal(catalog.scos.get('opaque-ai').frameworkId,'fw-ai');
        assert.equal(launchPath(catalog.scos.get('opaque-ai')),'scos/opaque-ai/index_lms.html');
        assert.equal(launchPath(catalog.scos.get('opaque-ai'),'page-2'),'scos/opaque-ai/index_lms.html#/id/page-2');
        input.scos[0].label='mutated'; assert.notEqual(catalog.contract.scos[0].label,'mutated');
        assert.ok(Object.isFrozen(catalog.contract.scos[0]));
    });
    test(`${root}: fixture, wrong version, real-source absence, bad graph and missing required scope fail closed`, () => {
        const cases=[v=>v.exampleOnly=true,v=>v.version=2,v=>v.scos[0].source.kind='fixture',v=>v.scos[0].source.publishedTitle='unpublished',v=>v.scos[0].source.manifest.resourceId='',v=>v.scos[0].source.buildSha256='hash',v=>v.scos[0].frameworkId='unknown',v=>v.scos[1].moduleId=v.scos[0].moduleId,v=>v.scos[1].launch.root=v.scos[0].launch.root+'/nested',v=>v.scos.forEach(s=>s.requiredForCompletion=false),v=>v.scos[1].number='01',v=>v.frameworks[1].prefix=v.frameworks[0].prefix,v=>v.pathways[0].courseIds=['opaque-dig'],v=>v.glossary[0].targets[0].scoId='opaque-dig',v=>v.frameworks[1].diagnostics.entry={intent:'require',status:'notProvided',reason:'no-assigned-questions'}];
        for(const change of cases){ const value=fixture();change(value);assert.throws(()=>validateContract(value)); }
    });
    test(`${root}: safe exact manifest paths reject alias traversal and external starts`, () => {
        for(const value of ['../index.html','/index.html','https://example.org/x','x\\y','a//b','a/./b','a/%2e%2e/b','a/%252e%252e/b','a/%2fb','a/%5cb','a/%00b','a/%3fb','a/%','a/b#x\n','a/b?x=%00','a/b?x=%2500'])assert.throws(()=>safeRelativePath(value,true),value);
        assert.equal(safeRelativePath('index_lms.html?lang=de#/id/page',true),'index_lms.html?lang=de#/id/page');
    });
    test(`${root}: real all-course completion stays separate from test scores, optional courses and 75 percent`, () => {
        const contract=fixture(),state={scoStates:{'opaque-dig':{values:{'cmi.core.lesson_status':'completed'}}}};
        assert.deepEqual(progress(contract,state,'fw-dig'),{required:1,completed:1,fraction:1,complete:true});
        assert.equal(progress(contract,state).complete,false);
        state.scoStates['opaque-ai']={native:{format:1,components:{a:{required:true,state:{_isComplete:true}},b:{required:true,state:{_isComplete:false}}}}};
        assert.equal(courseComplete(state.scoStates['opaque-ai']),false);
        state.scoStates['opaque-ai'].native.components.b.state._isComplete=true;
        assert.equal(progress(contract,state).complete,true);
        assert.equal(progress({...contract,scos:[]},state).complete,false);
        assert.equal(progress({...contract,scos:[]},state).fraction,null);
        assert.equal(courseComplete({native:{format:1,components:{}}}),false);
    });
}
test('new runtime source/dist and declared implementation hashes match the deliverable',async()=>{
    for(const name of ['multiContract','multiState','multiBridge','multiAssessment','multiFramework'])assert.equal(await readFile(new URL(`../js/${name}.js`,import.meta.url),'utf8'),await readFile(new URL(`../dist/js/${name}.js`,import.meta.url),'utf8'));
    const cap=JSON.parse(await readFile(new URL('../dist/adapt-multi-framework-capabilities.json',import.meta.url),'utf8'));
    assert.equal(cap.packageContract,'adapt-lxp-multi-framework@1');
    assert.equal(cap.implementationSha256,createHash('sha256').update(JSON.stringify(cap.implementationFiles)).digest('hex'));
    for(const [path,hash] of Object.entries(cap.implementationFiles))assert.equal(createHash('sha256').update(await readFile(new URL(`../dist/${path}`,import.meta.url))).digest('hex'),hash,path);
});
