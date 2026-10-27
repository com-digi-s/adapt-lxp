import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,loadModule} from './multi-fixture.mjs';
function model(attributes,other={}){return{attributes,get:key=>attributes[key],...other};}
function setup(){
    const c=fixture();
    for(const [fw,course,test,assessment]of[['fw-dig','opaque-dig','test-dig','as-dig'],['fw-ai','opaque-ai','test-ai','as-ai']]){
        c.domains.push({id:'domain',frameworkId:fw,label:'Configured domain '+fw});
        c.frameworks.find(v=>v.id===fw).diagnostics.entry={intent:'require',status:'provided',reason:null};
        c.scos.push({...structuredClone(c.scos.find(s=>s.id===course)),id:test,role:'entry',requiredForCompletion:false,moduleId:undefined,number:undefined,launch:{root:'scos/'+test,entry:'index.html',manifestHref:'index.html'},source:{kind:'generated-assessment',buildSha256:'a'.repeat(64),catalogueSha256:'a'.repeat(64),generatorSha256:'b'.repeat(64),templateSha256:'c'.repeat(64),questions:[{questionId:'q-'+fw,sourceCourseId:course,sourceComponentId:'same-native-id'}]}});
        c.questions.push({id:'q-'+fw,sourceCourseId:course,sourceComponentId:'same-native-id',runtimeQuestionId:'same-runtime-id',component:'mcq',tags:['et'],available:true,selfAssessment:false,maxPoints:2});
        c.assessments.push({id:assessment,frameworkId:fw,scoId:test,phase:'entry',banks:[{id:'bank-'+fw,runtimeBankId:111,targetCourseId:course,domainId:'domain',questionIds:['q-'+fw],maxPoints:2}]});
    }return c;
}
for(const root of ['../js','../dist/js']){
    const {collectAssessment,reportData,percentage}=await loadModule('multiAssessment',root);
    const {validateContract}=await loadModule('multiContract',root);
    test(`${root}: same native bank and component IDs never mix framework scores or report labels`,()=>{
        const c=setup();validateContract(c);
        const blocks=[model({_id:'b',_assessment:{_quizBankID:111,_isEnabled:true}})];
        const components=[model({_id:'same-runtime-id',_parentId:'b',_component:'mcq',_isSubmitted:true,_questionWeight:1,_items:[{_shouldBeSelected:true},{_shouldBeSelected:true},{_shouldBeSelected:false}],_userAnswer:[true,false,false]})];
        const first=collectAssessment(c,{scoId:'test-dig',frameworkId:'fw-dig',role:'entry',assessmentId:'as-dig'},components,blocks);
        assert.equal(percentage(first),50);assert.deepEqual(Object.keys(first.courses),['opaque-dig']);
        components[0].attributes._userAnswer=[true,true,false];
        const second=collectAssessment(c,{scoId:'test-ai',frameworkId:'fw-ai',role:'entry',assessmentId:'as-ai'},components,blocks);
        assert.equal(percentage(second),100);assert.deepEqual(Object.keys(second.courses),['opaque-ai']);
        assert.equal(reportData(c,{...second,attemptId:'try-2'}).framework,'fw-ai');
        assert.match(reportData(c,{...second,attemptId:'try-2'}).filename,/fw-ai.*entry.*try-2/);
        assert.throws(()=>collectAssessment(c,{scoId:'test-dig',frameworkId:'fw-ai',role:'entry',assessmentId:'as-ai'},components,blocks));
    });
    test(`${root}: weighted zero and partial grades stay finite; invalid bank, duplicates and missing questions error`,()=>{
        const c=setup(),context={scoId:'test-ai',frameworkId:'fw-ai',role:'entry',assessmentId:'as-ai'},blocks=[model({_id:'b',_assessment:{_quizBankID:111}})];
        c.questions.find(q=>q.id==='q-fw-ai').component='matching';
        const q=model({_id:'same-runtime-id',_parentId:'b',_component:'matching',_isSubmitted:true,_questionWeight:2,_items:[{_options:[{_isCorrect:true},{_isCorrect:false}]}],_userAnswer:[false,true]});
        const result=collectAssessment(c,context,[q],blocks);assert.equal(result.score,0);assert.equal(result.maxScore,2);assert.equal(percentage(result),0);
        assert.throws(()=>collectAssessment(c,context,[q,q],blocks),/Doppelte/);
        blocks[0].attributes._assessment._quizBankID=222;assert.throws(()=>collectAssessment(c,context,[q],blocks),/nicht zugeordnet/);
        assert.throws(()=>collectAssessment(c,context,[],blocks),/unvollständig/);
        assert.equal(percentage({score:0,maxScore:0}),null);
    });
    test(`${root}: slider and textinput use genuine native partial scores`,()=>{
        const c=setup(),context={scoId:'test-ai',frameworkId:'fw-ai',role:'entry',assessmentId:'as-ai'},blocks=[model({_id:'b',_assessment:{_quizBankID:111}})];
        for(const type of ['slider','textinput']){
            c.questions.find(q=>q.id==='q-fw-ai').component=type;
            const q=model({_id:'same-runtime-id',_parentId:'b',_component:type,_isSubmitted:true,_score:.5,_maxScore:2});
            const result=collectAssessment(c,context,[q],blocks);assert.equal(result.score,.5);assert.equal(result.maxScore,2);
        }
    });
}
