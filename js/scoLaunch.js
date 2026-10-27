// Packaging must copy the SCO resource href from imsmanifest.xml to launchFile.
// Existing catalogues without that field keep the historical index.html entry.
export function validatedLaunchFile(value) {
    if (value === undefined) return 'index.html';
    if (typeof value !== 'string' || !value || value.trim() !== value || /[\\\u0000-\u001f\u007f]/.test(value)) {
        throw new Error('Invalid SCO launchFile: expected a relative package file');
    }
    var pathname = value.split(/[?#]/)[0];
    var decoded;
    try { decoded = decodeURIComponent(pathname); } catch (_) { throw new Error('Invalid SCO launchFile encoding'); }
    if (!decoded || /[\\:%\u0000-\u001f\u007f]/.test(decoded) || decoded.split('/').some(function (part) {
        return !part || part === '.' || part === '..';
    })) throw new Error('Invalid SCO launchFile: package-relative paths only');
    return value;
}

export function scoConfiguration(modules, scoId) {
    if (typeof scoId !== 'string' || !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?$/.test(scoId)) throw new Error('Invalid SCO identity');
    var parts = scoId.split('.');
    var module = modules && modules[parts[0]];
    if (!module) throw new Error('Unknown SCO identity');
    var course = parts.length === 1 ? (!Array.isArray(module.courses) && module) :
        Array.isArray(module.courses) && module.courses.find(function (candidate) { return String(candidate.id) === parts[1]; });
    if (!course) throw new Error('Unknown SCO identity');
    return course;
}

export function scoLaunchPath(modules, scoId, contentPath) {
    var launchFile = validatedLaunchFile(scoConfiguration(modules, scoId).launchFile);
    var path = 'scos/' + scoId.replace('.', '/') + '/' + launchFile;
    if (contentPath !== undefined && contentPath !== '') {
        if (typeof contentPath !== 'string') throw new Error('Invalid SCO content fragment');
        path = path.split('#')[0] + '#' + contentPath.replace(/^#/, '');
    }
    return path;
}

// Resolve once against the actual document, not a mutable global bookmark or
// an assumed index.html basename. The adapter captures this identity thereafter.
export function scoIdForLaunch(modules, childHref, parentHref) {
    var child = new URL(childHref);
    var ids = [];
    Object.keys(modules || {}).forEach(function (id) {
        var module = modules[id];
        if (Array.isArray(module.courses)) module.courses.forEach(function (course) { ids.push(id + '.' + course.id); });
        else ids.push(id);
    });
    var matches = ids.filter(function (id) {
        var expected = new URL(scoLaunchPath(modules, id), parentHref);
        return expected.origin === child.origin && expected.pathname === child.pathname && expected.search === child.search;
    });
    if (matches.length !== 1) throw new Error('Cannot identify Adapt SCO for persistence');
    return matches[0];
}
