import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*(\/\/ Get the breadcrumb[\s\S]*?)<\/script>/)[1];
function crumbs(src){
 const children=[];let load;
 const list={set innerHTML(v){children.length=0;},appendChild(e){children.push(e);}};
 const frame={getAttribute:()=>src,addEventListener:(name,callback)=>{assert.equal(name,'load');load=callback;}};
 const document={querySelector:s=>s==='.breadcrumb-item'?list:frame,createElement:()=>({classList:{add(){}},textContent:''})};
 runInNewContext(script,{document});load();return children.map(e=>e.textContent);
}
test('breadcrumbs exclude native LMS launch filename, query and complete Adapt hash route',()=>{
 assert.deepEqual(crumbs('scos/AILit/1/index_lms.html#/id/6aa87f62'),['AILit','1']);
 assert.deepEqual(crumbs('scos/AILit/2/index_lms.html?lang=de#/id/page/child'),['AILit','2']);
});
test('legacy launch breadcrumbs and dashboard remain unchanged',()=>{
 assert.deepEqual(crumbs('scos/1/2/index.html#/id/page'),['1','2']);
 assert.deepEqual(crumbs('views/dashboard/index.html'),[]);
});
