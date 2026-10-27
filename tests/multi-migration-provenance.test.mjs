import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,loadModule} from './multi-fixture.mjs';
for(const root of ['../js','../dist/js']){
 const {createState,fingerprint,migrateLegacy,hydrateState}=await loadModule('multiState',root);
 function setup(){
  const contract=fixture(),hash='b'.repeat(64),fw=contract.frameworks[0].id;
  contract.scos.push({id:'test-sco',frameworkId:fw,role:'entry',source:{buildSha256:hash}});
  contract.questions.push({id:'question',maxPoints:1});
  contract.assessments.push({id:'test',frameworkId:fw,scoId:'test-sco',phase:'entry',banks:[{id:'bank',runtimeBankId:111,targetCourseId:'opaque-dig',domainId:'domain',questionIds:['question'],maxPoints:1}]});
  const state=createState(contract);state.scoStates['test-sco']={frameworkId:fw,fingerprint:hash,payload:'opaque',values:{},native:null};
  const attempt={attemptId:'attempt',frameworkId:'known-old-framework',assessmentId:'old-test',phase:'entry',completed:true,completedAt:'2026-10-26T19:00:00Z',score:0,maxScore:1,banks:{bank:{score:0,maxScore:1}},courses:{'opaque-dig':{score:0,maxScore:1}},domains:{domain:{score:0,maxScore:1}},questions:{question:{score:0,maxScore:1}}};
  const envelope={packageId:'old-package',revision:'old-r1',fingerprints:{'old-test':hash},data:{assessmentAttempts:{'old-test':{attempt}}}};
  const plan={id:'migrate-tests',confirmed:true,targetPackageId:contract.package.id,sourcePackageId:'old-package',sourceRevision:'old-r1',assessmentAliases:{'old-test':{assessmentId:'test',frameworkId:fw,sourceFrameworkId:'known-old-framework',sourceAssessmentId:'old-test',sourceFingerprint:hash,targetFingerprint:hash}}};
  return{contract,state,envelope,plan,fw};
 }
 test(root+': test migration proves original fingerprint and explicit source refs before preserving a genuine zero',()=>{
  const {contract,state,envelope,plan,fw}=setup(),m=migrateLegacy(contract,envelope,plan,state),attempt=m.state.assessmentAttempts[fw].test.attempt;
  assert.equal(attempt.score,0);assert.equal(attempt.frameworkId,fw);assert.equal(attempt.assessmentId,'test');assert.deepEqual(m.report.rejected,[]);assert.deepEqual(m.backup,envelope);
  assert.equal(hydrateState(contract,m.state).state.assessmentAttempts[fw].test.attempt.score,0);
 });
 test(root+': wrong old test fingerprint cannot borrow a compatible current SCO fingerprint',()=>{
  const {contract,state,envelope,plan,fw}=setup();envelope.fingerprints['old-test']='WRONG';const m=migrateLegacy(contract,envelope,plan,state);
  assert.equal(m.state.assessmentAttempts[fw],undefined);assert.ok(m.report.rejected.includes('assessment:old-test'));
 });
 test(root+': foreign framework/test/phase, impossible score and false group totals are rejected',()=>{
  for(const mutate of [a=>a.frameworkId='foreign',a=>a.assessmentId='foreign',a=>a.phase='final',a=>a.score=999,a=>a.maxScore=2,a=>a.banks.bank.score=1,a=>delete a.questions.question]){
   const {contract,state,envelope,plan,fw}=setup();mutate(envelope.data.assessmentAttempts['old-test'].attempt);
   const m=migrateLegacy(contract,envelope,plan,state);assert.equal(m.state.assessmentAttempts[fw]?.test?.attempt,undefined);assert.ok(m.report.rejected.includes('assessment:old-test/attempt'));
  }
 });
 test(root+': legacy result cannot overwrite an existing attempt even with matching IDs',()=>{
  const {contract,state,envelope,plan,fw}=setup();state.assessmentAttempts[fw]={test:{attempt:{keep:'current-original'}}};
  const m=migrateLegacy(contract,envelope,plan,state);assert.deepEqual(m.state.assessmentAttempts[fw].test.attempt,{keep:'current-original'});assert.ok(m.report.rejected.includes('assessment-collision:old-test/attempt'));
 });
}
