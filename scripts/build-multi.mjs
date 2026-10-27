// Reproducibly publish the non-JSX shared runtime. Legacy compiled assets stay
// intact; their source/transpilation pipeline is outside this opt-in build.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const modules = ['multiContract', 'multiState', 'multiBridge', 'multiAssessment', 'multiDashboard', 'multiFramework'];
await mkdir(path.join(root, 'dist/js'), { recursive: true });
await mkdir(path.join(root, 'dist/css'), { recursive: true });
for (const name of modules) await copyFile(path.join(root, `js/${name}.js`), path.join(root, `dist/js/${name}.js`));
await copyFile(path.join(root, 'css/multi-framework.css'), path.join(root, 'dist/css/multi-framework.css'));
const files = [...modules.map(name => `js/${name}.js`), 'js/corePersistence.js', 'js/courseProgress.js', 'index.html', 'css/multi-framework.css', 'views/dashboard/css/bootstrap.min.css', 'views/dashboard/css/font-awesome.css', 'views/dashboard/css/dashboard.css'].sort();
const implementationFiles = {};
for (const file of files) implementationFiles[file] = createHash('sha256').update(await readFile(path.join(root, 'dist', file))).digest('hex');
const capability = { capability: 'multi-framework', version: 1, packageContract: 'adapt-lxp-multi-framework@1', persistenceContract: 1, launchContext: 'explicit-sco-id', implementationFiles,
    implementationSha256: createHash('sha256').update(JSON.stringify(implementationFiles)).digest('hex') };
for (const target of ['adapt-multi-framework-capabilities.json', 'dist/adapt-multi-framework-capabilities.json']) await writeFile(path.join(root, target), JSON.stringify(capability, null, 2) + '\n');
console.log(`Published ${modules.length} shared runtime modules; capability ${capability.implementationSha256}`);
