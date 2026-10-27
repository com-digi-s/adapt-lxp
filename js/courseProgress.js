// Completion/XP aggregation is limited to the currently selected catalogue.
// Disabled courses may still appear greyed out, but are not denominator terms.
export function boundedCourseProgress(value) {
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

// Adapt Spoor ComponentSerializer has two explicit formats. With responses it
// stores [trackingPair, responseMetadata, attemptState]; without responses it
// stores [trackingPair, [isComplete]]. Never turn correctness/submission flags
// into fractional completion, or guess an unknown/opaque suspend-data format.
export function spoorCourseProgress(suspendData, deserialize, absolute) {
    if (!suspendData || typeof suspendData !== 'object' || typeof suspendData.q !== 'string' || !suspendData.q || typeof deserialize !== 'function') return 0;
    var states;
    try { states = deserialize(suspendData.q); } catch (_) { return 0; }
    if (!Array.isArray(states) || !states.length) return 0;
    var format = states[0] && states[0].length;
    var seen = {};
    var completed = 0;
    for (var index = 0; index < states.length; index++) {
        var state = states[index];
        if (!Array.isArray(state) || state.length !== format || !Array.isArray(state[0]) || state[0].length !== 2 ||
            !state[0].every(function (value) { return Number.isInteger(value) && value >= 0; })) return 0;
        var identity = state[0].join(':');
        if (seen[identity]) return 0;
        seen[identity] = true;
        var flags;
        if (format === 2 && Array.isArray(state[1]) && state[1].length === 1) flags = state[1];
        else if (format === 3 && Array.isArray(state[1]) && state[1].length === 3 &&
            state[1].every(function (value) { return typeof value === 'boolean'; }) &&
            Array.isArray(state[2]) && state[2].length === 3 && Array.isArray(state[2][0]) && Array.isArray(state[2][2])) flags = state[2][1];
        else return 0;
        if (!Array.isArray(flags) || !flags.length || !flags.every(function (value) { return typeof value === 'boolean'; })) return 0;
        if (flags[0]) completed++;
    }
    return absolute ? completed : completed / states.length;
}

export function courseScoresOfModule(modules, id, calculateScore, absolute) {
    var module = modules && modules[id];
    var scores = {};
    if (!module || module.disabled === true || (module.disabled === undefined && module.enabled === false)) return scores;
    function score(courseId) {
        var value = calculateScore(courseId, absolute);
        return absolute ? (Number.isFinite(value) ? Math.max(value, 0) : 0) : boundedCourseProgress(value);
    }
    if (Array.isArray(module.courses)) {
        module.courses.forEach(function (course) {
            if (course.disabled !== true && (course.disabled !== undefined || course.enabled !== false)) scores[course.id] = score(id + '.' + course.id);
        });
    } else {
        scores[0] = score(id);
    }
    return scores;
}

export function averageCourseProgress(scores) {
    var values = Object.values(scores || {});
    return values.length ? values.reduce(function (sum, value) { return sum + boundedCourseProgress(value); }, 0) / values.length : 0;
}

export function sumCourseScores(scores) {
    var total = Object.values(scores || {}).reduce(function (sum, value) {
        return sum + (Number.isFinite(value) ? Math.max(value, 0) : 0);
    }, 0);
    return Number.isFinite(total) ? total : 0;
}
