import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadModule, fixture } from './multi-fixture.mjs';

for (const root of ['../js','../dist/js']) {
    const {validateContract,validateCapabilities,validatePresentationCompatibility,launchPath,safeRelativePath,progress,courseComplete} = await loadModule('multiContract',root);
    const compatibility = (scoId = 'opaque-dig', previous = 'b'.repeat(64)) => ({version:1,rule:'markledge-generated-display-v1',proofs:[{
        previousFingerprint:previous,path:`presentation-compatibility/${scoId}/${previous}.json`,sha256:'c'.repeat(64),
        componentDisplayTitles:[{componentId:'text-1',previousDisplayTitle:'Generated heading',currentDisplayTitle:''}]
    }]});
    test(`${root}: wrapper capability version and complete implementation declaration are mandatory`, async () => {
        const cap=JSON.parse(await readFile(new URL('../dist/adapt-multi-framework-capabilities.json',import.meta.url),'utf8'));
        assert.equal(validateCapabilities(cap),cap);assert.throws(()=>validateCapabilities({...cap,version:2}));assert.throws(()=>validateCapabilities({...cap,persistenceContract:2}));assert.throws(()=>validateCapabilities({...cap,implementationFiles:{}}));
        assert.equal(validateCapabilities({...cap,presentationCompatibility:1}).presentationCompatibility,1);
        for(const value of [0,2,true,null,{}])assert.throws(()=>validateCapabilities({...cap,presentationCompatibility:value}));
    });
    test(`${root}: typed product graph is immutable and opaque IDs separate both frameworks`, () => {
        const input=fixture(), catalog=validateContract(input);
        assert.equal(catalog.scos.get('opaque-ai').frameworkId,'fw-ai');
        assert.equal(launchPath(catalog.scos.get('opaque-ai')),'scos/opaque-ai/index_lms.html');
        assert.equal(launchPath(catalog.scos.get('opaque-ai'),'page-2'),'scos/opaque-ai/index_lms.html#/id/page-2');
        input.scos[0].label='mutated'; assert.notEqual(catalog.contract.scos[0].label,'mutated');
        assert.ok(Object.isFrozen(catalog.contract.scos[0]));
    });
    test(`${root}: cross-framework reading links require learning courses, a safe unique resource and its digest`, () => {
        const valid=fixture();valid.learningLinks=[{sourceScoId:'opaque-ai',targetScoId:'opaque-dig',contentId:'real-page',resourcePath:'course/de/assets/reference.md',resourceSha256:'a'.repeat(64)}];
        assert.equal(validateContract(valid).contract.learningLinks[0].targetScoId,'opaque-dig');
        for(const change of [v=>v.learningLinks=null,v=>v.learningLinks[0].targetScoId='missing',v=>v.learningLinks[0].sourceScoId='missing',v=>v.learningLinks[0].resourcePath='../reference.md',v=>v.learningLinks[0].resourcePath='https://elsewhere.invalid/a.md',v=>v.learningLinks[0].resourceSha256='',v=>v.learningLinks[0].contentId='',v=>v.learningLinks.push({...v.learningLinks[0]})]){const bad=structuredClone(valid);change(bad);assert.throws(()=>validateContract(bad));}
    });
    test(`${root}: display compatibility is a frozen learning-only exact evidence contract`, () => {
        const input=fixture();input.scos[0].source.presentationCompatibility=compatibility();
        const catalog=validateContract(input),proof=catalog.scos.get('opaque-dig').source.presentationCompatibility;
        assert.deepEqual(proof,compatibility());assert.ok(Object.isFrozen(proof.proofs[0].componentDisplayTitles[0]));
        input.scos[0].source.presentationCompatibility.proofs[0].componentDisplayTitles[0].previousDisplayTitle='mutated';
        assert.equal(proof.proofs[0].componentDisplayTitles[0].previousDisplayTitle,'Generated heading');
        const two=fixture();two.scos[0].source.presentationCompatibility=compatibility();
        two.scos[0].source.presentationCompatibility.proofs.push(compatibility('opaque-dig','d'.repeat(64)).proofs[0]);
        assert.equal(validateContract(two).scos.get('opaque-dig').source.presentationCompatibility.proofs.length,2);
        assert.equal(validatePresentationCompatibility(undefined,'opaque-dig'),undefined);
        assert.throws(()=>validatePresentationCompatibility(compatibility(),'opaque-dig','a'.repeat(64),'entry'));
        assert.throws(()=>validatePresentationCompatibility(compatibility(),'opaque-dig','a'.repeat(64),'final'));
    });
    test(`${root}: malformed, self, duplicate and foreign display aliases fail closed`, () => {
        const mutations=[value=>value.version=2,value=>value.rule='ignore-displayTitle',value=>value.extra=true,value=>value.extra=undefined,
            value=>value.proofs=[],value=>value.proofs.push(structuredClone(value.proofs[0])),value=>value.proofs[0].extra=true,
            value=>value.proofs[0].previousFingerprint='a'.repeat(64),value=>value.proofs[0].previousFingerprint='B'.repeat(64),
            value=>value.proofs[0].sha256='hash',value=>value.proofs[0].path='../old.json',value=>value.proofs[0].path=value.proofs[0].path+'?x=1',
            value=>value.proofs[0].path=value.proofs[0].path.replace('opaque-dig','opaque-ai'),
            value=>delete value.proofs[0].componentDisplayTitles,value=>value.proofs[0].componentDisplayTitles=null,
            value=>value.proofs[0].componentDisplayTitles.push({...value.proofs[0].componentDisplayTitles[0]}),
            value=>value.proofs[0].componentDisplayTitles[0].extra=true,value=>value.proofs[0].componentDisplayTitles[0].componentId='constructor',
            value=>value.proofs[0].componentDisplayTitles[0].componentId=' spaced ',value=>value.proofs[0].componentDisplayTitles[0].componentId='x'.repeat(257),
            value=>value.proofs[0].componentDisplayTitles[0].previousDisplayTitle=' heading',value=>value.proofs[0].componentDisplayTitles[0].previousDisplayTitle='line\nbreak',
            value=>value.proofs[0].componentDisplayTitles[0].previousDisplayTitle='<strong>heading</strong>',value=>value.proofs[0].componentDisplayTitles[0].previousDisplayTitle='Heading &amp; text',
            value=>value.proofs[0].componentDisplayTitles[0].previousDisplayTitle='x'.repeat(4097),value=>value.proofs[0].componentDisplayTitles[0].currentDisplayTitle='replacement'];
        for(const mutate of mutations){const input=fixture(),value=compatibility();mutate(value);input.scos[0].source.presentationCompatibility=value;assert.throws(()=>validateContract(input));}
        for(const value of [null,[],false])assert.throws(()=>validatePresentationCompatibility(value,'opaque-dig','a'.repeat(64)));
        assert.throws(()=>validatePresentationCompatibility(compatibility(),'opaque-dig','B'.repeat(64)),'Self aliases are case-independent');
        const oversized=compatibility();oversized.proofs[0].componentDisplayTitles=Array.from({length:513},(_,index)=>({componentId:'text-'+index,previousDisplayTitle:'Heading',currentDisplayTitle:''}));
        assert.throws(()=>validatePresentationCompatibility(oversized,'opaque-dig','a'.repeat(64)));
        const three=compatibility();three.proofs.push(compatibility('opaque-dig','d'.repeat(64)).proofs[0],compatibility('opaque-dig','e'.repeat(64)).proofs[0]);
        assert.throws(()=>validatePresentationCompatibility(three,'opaque-dig','a'.repeat(64)));
        const sparse=compatibility();sparse.proofs[0].componentDisplayTitles=new Array(1);
        assert.throws(()=>validatePresentationCompatibility(sparse,'opaque-dig','a'.repeat(64)));
    });
    test(`${root}: graphics-only display evidence needs no text heading fallback rows`, () => {
        const input=fixture(),value=compatibility();value.proofs[0].componentDisplayTitles=[];
        input.scos[0].source.presentationCompatibility=value;
        assert.deepEqual(validateContract(input).scos.get('opaque-dig').source.presentationCompatibility,value);
    });
    test(`${root}: display proof text rejects lone surrogates but retains valid Unicode code points`, () => {
        for(const field of ['componentId','previousDisplayTitle'])for(const surrogate of ['\ud800','\udfff']){
            const input=fixture(),value=compatibility();value.proofs[0].componentDisplayTitles[0][field]='Text'+surrogate;
            input.scos[0].source.presentationCompatibility=value;assert.throws(()=>validateContract(input));
        }
        const input=fixture(),value=compatibility(),row=value.proofs[0].componentDisplayTitles[0];
        row.componentId='text-😀';row.previousDisplayTitle='Überschrift 😀';input.scos[0].source.presentationCompatibility=value;
        assert.deepEqual(validateContract(input).scos.get('opaque-dig').source.presentationCompatibility,value);
        row.componentId='😀'.repeat(128);row.previousDisplayTitle='😀'.repeat(2048);
        assert.deepEqual(validateContract(input).scos.get('opaque-dig').source.presentationCompatibility,value,'The limits count UTF-16 units, not Unicode code points');
    });
    test(`${root}: fixture, wrong version, real-source absence, bad graph and missing required scope fail closed`, () => {
        const cases=[v=>v.exampleOnly=true,v=>v.version=2,v=>v.scos[0].source.kind='fixture',v=>v.scos[0].source.publishedTitle='unpublished',v=>v.scos[0].source.manifest.resourceId='',v=>v.scos[0].source.buildSha256='hash',v=>v.scos[0].frameworkId='unknown',v=>v.scos[1].moduleId=v.scos[0].moduleId,v=>v.scos[1].launch.root=v.scos[0].launch.root+'/nested',v=>v.scos.forEach(s=>s.requiredForCompletion=false),v=>v.scos[1].number='01',v=>v.frameworks[1].prefix=v.frameworks[0].prefix,v=>v.pathways[0].courseIds=['opaque-dig'],v=>v.glossary[0].targets[0].scoId='opaque-dig',v=>v.frameworks[1].diagnostics.entry={intent:'require',status:'notProvided',reason:'no-assigned-questions'}];
        for(const change of cases){ const value=fixture();change(value);assert.throws(()=>validateContract(value)); }
    });
    test(`${root}: safe exact manifest paths reject alias traversal and external starts`, () => {
        for(const value of ['../index.html','/index.html','https://example.org/x','x\\y','a//b','a/./b','a/%2e%2e/b','a/%252e%252e/b','a/%2fb','a/%5cb','a/%00b','a/%3fb','a/%','a/b#x\n','a/b?x=%00','a/b?x=%2500'])assert.throws(()=>safeRelativePath(value,true),value);
        assert.equal(safeRelativePath('index_lms.html?lang=de#/id/page',true),'index_lms.html?lang=de#/id/page');
        const contract=fixture();contract.scos[0].launch.entry='different-file.html';assert.throws(()=>validateContract(contract),/Manifestressource/);
        contract.scos[0].launch.entry='index_lms.html?unconfirmed=1';assert.throws(()=>validateContract(contract),/Manifestressource/);
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
