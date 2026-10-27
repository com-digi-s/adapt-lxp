import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,loadModule} from './multi-fixture.mjs';

// Semantic fixture of the real published ComDigiS M3/3 component
// 64773e87c0b812002aaed5f9: 3 rows; the first row accepts 3 alternatives.
// Its native Adapt 5.22.6 MatchingModel.setUpItems sets _selectable=items.length;
// setActiveOption toggles exactly one active option in each row. Text/answers
// in the original course are not modified or reinterpreted by this test.
const ITEMS=[
    {_options:[{_isCorrect:true},{_isCorrect:true},{_isCorrect:true},{_isCorrect:false}]},
    {_options:[{_isCorrect:false},{_isCorrect:false},{_isCorrect:true},{_isCorrect:false}]},
    {_options:[{_isCorrect:false},{_isCorrect:true},{_isCorrect:false},{_isCorrect:false}]}
];
function vector(indices){return ITEMS.flatMap((item,row)=>item._options.map((_,option)=>indices[row]===option));}
function setup(weight=1){
    const contract=fixture(),fw=contract.frameworks[0].id;
    contract.questions.push({id:'source-question',sourceCourseId:'opaque-dig',sourceComponentId:'64773e87c0b812002aaed5f9',runtimeQuestionId:'generated-question',component:'matching',maxPoints:3*weight});
    contract.assessments.push({id:'assessment',frameworkId:fw,scoId:'diagnostic',phase:'entry',banks:[{id:'bank',runtimeBankId:1,targetCourseId:'opaque-dig',domainId:'configured-domain',questionIds:['source-question'],maxPoints:3*weight}]});
    const attributes={_id:'generated-question',_parentId:'block',_component:'matching',_questionWeight:weight,_isSubmitted:true,_items:structuredClone(ITEMS),_userAnswer:vector([0,2,1])};
    const component={attributes,get:key=>attributes[key]},blocks=[{get:key=>key==='_id'?'block':key==='_assessment'?{_quizBankID:1}:undefined}],context={assessmentId:'assessment',frameworkId:fw,scoId:'diagnostic',role:'entry'};
    return{contract,context,component,attributes,blocks};
}

for(const root of ['../js','../dist/js']){
    const{collectAssessment}=await loadModule('multiAssessment',root);
    function score(input){return collectAssessment(input.contract,input.context,[input.component],input.blocks);}
    test(`${root}: alternative correct options are one valid choice, with maximum one point per native row`,()=>{
        for(const alternative of [0,1,2]){
            const input=setup();input.attributes._userAnswer=vector([alternative,2,1]);const result=score(input);
            assert.equal(result.score,3);assert.equal(result.maxScore,3);assert.deepEqual(result.questions['source-question'],{score:3,maxScore:3});
        }
    });
    test(`${root}: one wrong row preserves genuine partial points, and all wrong rows preserve zero`,()=>{
        const input=setup();input.attributes._userAnswer=vector([3,2,1]);assert.equal(score(input).score,2);assert.equal(score(input).maxScore,3);
        input.attributes._userAnswer=vector([3,0,0]);assert.equal(score(input).score,0);assert.equal(score(input).maxScore,3);
    });
    test(`${root}: row weights apply to achieved and maximum scores, never to alternative counts`,()=>{
        const input=setup(2.5);input.attributes._userAnswer=vector([1,0,1]);const result=score(input);assert.equal(result.score,5);assert.equal(result.maxScore,7.5);
    });
    test(`${root}: manipulated multi-selection, malformed vectors and submitted empty rows fail closed`,()=>{
        const input=setup();input.attributes._userAnswer[1]=true;assert.throws(()=>score(input),/Mehrfachauswahl/);
        input.attributes._userAnswer=vector([0,2,1]).slice(0,-1);assert.throws(()=>score(input),/Antwortvektor/);
        input.attributes._userAnswer=vector([0,2,1]);input.attributes._userAnswer[0]=1;assert.throws(()=>score(input),/Antwortvektor/);
        input.attributes._userAnswer=vector([0,2,1]);input.attributes._userAnswer.fill(false,4,8);assert.throws(()=>score(input),/unbeantwortete Zeile/);
    });
    test(`${root}: an unsubmitted native matching question has zero earned points without fabricated submission`,()=>{
        const input=setup();input.attributes._isSubmitted=false;input.attributes._userAnswer=[];const result=score(input);assert.equal(result.score,0);assert.equal(result.maxScore,3);assert.equal(input.attributes._isSubmitted,false);
    });
}
