import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadModule} from './multi-fixture.mjs';

for (const root of ['../js', '../dist/js']) {
    const label = root.includes('dist') ? 'dist' : 'source';
    test(label + ': glossary preserves wordwise search and relevance instead of requiring one phrase', async () => {
        const {searchGlossary} = await loadModule('multiGlossary', root);
        const terms = ['Software', 'Computer', 'Computersoftware', 'Hardware', 'Internetsoftware'].map((term, index) => ({id: 'opaque-' + index, term}));
        const before = structuredClone(terms);
        assert.deepEqual(searchGlossary(terms, 'computer software').map(entry => entry.term), ['Computersoftware', 'Computer', 'Internetsoftware', 'Software']);
        assert.deepEqual(searchGlossary(terms, '  SOFTWARE  computer computer ').map(entry => entry.term), ['Computersoftware', 'Computer', 'Internetsoftware', 'Software']);
        assert.deepEqual(searchGlossary(terms, 'internet software').map(entry => entry.term), ['Internetsoftware', 'Computersoftware', 'Software']);
        assert.deepEqual(terms, before, 'Searching does not reorder or modify the catalogue');
    });
    test(label + ': glossary keeps every matching entry and accepts only meaningful term tokens', async () => {
        const {searchGlossary} = await loadModule('multiGlossary', root);
        const terms = Array.from({length: 144}, (_, index) => ({id: String(index), term: 'Datenbegriff ' + String(index).padStart(3, '0')}));
        assert.equal(searchGlossary(terms, 'daten').length, 144, 'Results are not silently truncated to 25');
        assert.deepEqual(searchGlossary(terms, 'd da  '), []);
        assert.deepEqual(searchGlossary(terms, ''), []);
        assert.deepEqual(searchGlossary(terms, 'xy daten').map(entry => entry.id), terms.map(entry => entry.id));
        assert.deepEqual(searchGlossary([{term: 'Andere', definition: 'Daten'}], 'daten'), [], 'Definitions do not displace the established term lookup');
        assert.deepEqual(searchGlossary([], 'daten'), [], 'Only caller-provided, framework-scoped entries are searched');
    });
}
