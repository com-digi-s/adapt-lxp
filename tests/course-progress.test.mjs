import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const dataURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const sourceAt = relative => readFile(new URL(relative, import.meta.url), 'utf8');

for (const root of ['../js', '../dist/js']) {
    const { courseScoresOfModule, averageCourseProgress, boundedCourseProgress, sumCourseScores } = await import(dataURL(await sourceAt(`${root}/courseProgress.js`)));
    test(`${root}: only the one selected course out of three defines module progress`, () => {
        const calls=[];
        const modules={M4:{enabled:true,courses:[{id:'1',disabled:true},{id:'2',enabled:true},{id:'3',enabled:false}]}};
        const scores=courseScoresOfModule(modules,'M4',id=>{calls.push(id);return 1;},false);
        assert.deepEqual(scores,{'2':1});
        assert.deepEqual(calls,['M4.2']);
        assert.equal(averageCourseProgress(scores),1);
    });
    test(`${root}: disabled and empty catalogue aggregates are finite zero`, () => {
        const modules={disabled:{disabled:true,courses:[{id:'1'}]},off:{enabled:false,courses:[{id:'1'}]},empty:{enabled:true,courses:[]}};
        for(const id of ['disabled','off','empty','missing']){
            const scores=courseScoresOfModule(modules,id,()=>{throw Error('Disabled score must not be queried');},false);
            assert.deepEqual(scores,{});
            assert.equal(averageCourseProgress(scores),0);
            assert.equal(sumCourseScores(scores),0);
        }
        for(const value of [undefined,null,NaN,Infinity,-Infinity,'1'])assert.equal(boundedCourseProgress(value),0);
        assert.equal(sumCourseScores({a:Infinity,b:NaN,c:-1}),0);
        assert.equal(sumCourseScores({a:Number.MAX_VALUE,b:Number.MAX_VALUE}),0);
    });
    test(`${root}: enabled diagnostics retain their own finite completion, not changed grades`, () => {
        assert.deepEqual(courseScoresOfModule({M0:{enabled:true}},'M0',()=>0.5,false),{0:0.5});
        assert.deepEqual(courseScoresOfModule({M0:{enabled:true}},'M0',()=>4,true),{0:4});
        assert.deepEqual(courseScoresOfModule({M0:{enabled:true}},'M0',()=>NaN,false),{0:0});
    });
    test(`${root}: explicit disabled flags remain authoritative over unused legacy enabled flags`, () => {
        const modules={M4:{enabled:false,disabled:false,courses:[
            {id:'1',enabled:false,disabled:false},{id:'2',enabled:true,disabled:true},{id:'3',enabled:false}
        ]}};
        assert.deepEqual(courseScoresOfModule(modules,'M4',()=>1,false),{'1':1});
        assert.equal(averageCourseProgress(courseScoresOfModule(modules,'M4',()=>1,false)),1);
    });
}

async function deliveredApp() {
    let source=await sourceAt('../dist/js/app.js');
    const stubs={
        './adaptHelpers.js':'export const ignored=true;',
        '../libraries/jquery-2.2.4.min.js':'export const ignored=true;',
        './utils.js':'export function timeIntToString(){}',
        './components.js':'export function GlossaryDropdown(){} export function CoursePathway(){} export function Card(){} export function CollapsibleCard(){} export function CourseStats(){} export function XP(){}',
        './charts.js':'export function pulseChart(){} export function radarChart(){}'
    };
    for(const name of ['scormBridge','corePersistence','courseProgress','scoLaunch'])stubs[`./${name}.js`]=await sourceAt(`../dist/js/${name}.js`);
    for(const [specifier,stub]of Object.entries(stubs))source=source.replace(JSON.stringify(specifier),JSON.stringify(dataURL(stub))).replace(`'${specifier}'`,JSON.stringify(dataURL(stub)));
    return (await import(dataURL(source))).App;
}
const App=await deliveredApp();

test('delivered App module average, XP and stats exclude disabled courses and modules consistently',()=>{
    const old=globalThis.window;
    globalThis.window={CONF:{SCOS:{
        M4:{id:'M4',enabled:true,courses:[{id:'1',disabled:true},{id:'2',enabled:true},{id:'3',disabled:true}]},
        M1:{id:'M1',disabled:true,courses:[{id:'1',enabled:true}]},
        M0:{id:'M0',enabled:true}
    }}};
    const app=Object.create(App.prototype),calls=[];
    app.calculateScore=(id,absolute)=>{calls.push(id);return id==='M4.2'?(absolute?4:1):id==='M0'?0:99;};
    try{
        assert.deepEqual(app.calculateCourseScoresOfModule('M4'),{'2':1});
        assert.deepEqual(app.calculateAverageModuleScores(),{M4:1,M1:0,M0:0});
        assert.equal(app.calculateXP(),'4');
        assert.deepEqual(app.calculateCourseStats(),[1,1]);
        assert.ok(calls.every(id=>id==='M4.2'||id==='M0'));
        window.CONF.SCOS={};
        assert.deepEqual(app.calculateAverageModuleScores(),{});
        assert.equal(app.calculateXP(),'0');
        assert.deepEqual(app.calculateCourseStats(),[0,0]);
    }finally{globalThis.window=old;}
});

test('delivered module header shows 100% for selected completed course and every disabled/empty bar stays finite',async()=>{
    const old={window:globalThis.window,React:globalThis.React};
    globalThis.React={Component:function Component(props){this.props=props;},createElement:(type,props,...children)=>({type,props,children})};
    let source=await sourceAt('../dist/js/components.js');
    for(const name of ['assessmentScores','courseProgress'])source=source.replace(`'./${name}.js'`,JSON.stringify(dataURL(await sourceAt(`../dist/js/${name}.js`))));
    try{
        const {CollapsibleCard}=await import(dataURL(source));
        window={CONF:{SCOS:{M4:{label:'Selected',courses:[{id:'1',disabled:true},{id:'2'},{id:'3',disabled:true}]}}}};
        function bars(node,result=[]){if(!node||typeof node!=='object')return result;if(node.props?.role==='progressbar')result.push(node.props);for(const child of node.children||[])if(Array.isArray(child))child.forEach(value=>bars(value,result));else bars(child,result);return result;}
        const completed=new CollapsibleCard({mod:'M4',scores:{2:1}});completed.state.isOpen=true;
        const completeBars=bars(completed.render());
        assert.equal(completeBars[0]['aria-valuenow'],100);
        assert.deepEqual(completeBars.slice(1).map(bar=>bar['aria-valuenow']),[0,100,0]);
        const empty=new CollapsibleCard({mod:'M4',scores:{}});empty.state.isOpen=true;
        assert.ok(bars(empty.render()).every(bar=>bar['aria-valuenow']===0&&bar.style.width==='0%'));
    }finally{Object.assign(globalThis,old);}
});
