import { readFile } from 'node:fs/promises';
export async function loadModule(name, root = '../js') {
    let source = await readFile(new URL(`${root}/${name}.js`, import.meta.url), 'utf8');
    const matches = [...source.matchAll(/from '(\.\/[^']+\.js)'/g)];
    for (const match of matches) {
        const dependency = await moduleURL(match[1].slice(2, -3), root);
        source = source.replace(match[1], dependency);
    }
    source += `\n//# sourceURL=lxp-test-${root.includes('dist') ? 'dist' : 'source'}-${name}.js\n`;
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
async function moduleURL(name, root) {
    let source = await readFile(new URL(`${root}/${name}.js`, import.meta.url), 'utf8');
    for (const match of [...source.matchAll(/from '(\.\/[^']+\.js)'/g)]) source = source.replace(match[1], await moduleURL(match[1].slice(2, -3), root));
    source += `\n//# sourceURL=lxp-test-${root.includes('dist') ? 'dist' : 'source'}-${name}.js\n`;
    return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}
export function fixture() {
    const hash = 'a'.repeat(64), framework = id => ({ id, prefix: id, label: id, version: '2026', diagnostics: {entry:{intent:'omit',status:'notProvided',reason:'not-requested'},final:{intent:'omit',status:'notProvided',reason:'not-requested'}} });
    const course = (id, frameworkId) => ({id,frameworkId,moduleId:'module-'+frameworkId,number:'10',role:'learning',label:id,requiredForCompletion:true,source:{kind:'aat-published',originId:'tenant',courseId:id,title:id,publishedTitle:id,language:'de',buildSha256:hash,catalogueSha256:hash,manifest:{sha256:hash,resourceId:'resource',href:'index_lms.html'}},launch:{root:'scos/'+id,entry:'index_lms.html',manifestHref:'index_lms.html'}});
    return {format:'adapt-lxp-multi-framework',version:1,exampleOnly:false,package:{id:'package',revision:'r1',title:'Both frameworks',catalogueRevision:'r1',outerScorm:'1.2',targetProfileId:'scorm-1.2-conservative',manifestLaunch:'index.html'},frameworks:[framework('fw-dig'),framework('fw-ai')],modules:[{id:'module-fw-dig',frameworkId:'fw-dig',number:'5',label:'DigComp module'},{id:'module-fw-ai',frameworkId:'fw-ai',number:'1',label:'AILit module'}],scos:[course('opaque-dig','fw-dig'),course('opaque-ai','fw-ai')],domains:[],questions:[],assessments:[],pathways:[{id:'path-ai',frameworkId:'fw-ai',label:'AI path',courseIds:['opaque-ai']}],glossary:[{id:'term-ai',frameworkId:'fw-ai',term:'Example',targets:[{scoId:'opaque-ai',contentId:'page-1'}]}],completion:{policy:'all-required-learning-courses',outerScorePolicy:'no-cross-framework-score'}};
}
