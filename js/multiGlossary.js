// Preserve the established glossary search: each meaningful word can match a
// term, and terms matching more words appear first. The caller supplies only
// the active framework's entries; neither IDs nor definitions decide scope.
export function searchGlossary(terms, query) {
    const words = [...new Set(String(query || '').trim().toLocaleLowerCase().split(/\s+/).filter(word => word.length >= 3))];
    if (!words.length) return [];
    return terms.map((entry, index) => ({entry, index, matches: words.filter(word => String(entry.term || '').toLocaleLowerCase().includes(word)).length}))
        .filter(result => result.matches > 0)
        .sort((left, right) => right.matches - left.matches || left.entry.term.localeCompare(right.entry.term) || left.index - right.index)
        .map(result => result.entry);
}
