// Completion/XP aggregation is limited to the currently selected catalogue.
// Disabled courses may still appear greyed out, but are not denominator terms.
export function boundedCourseProgress(value) {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}
export function courseScoresOfModule(modules, id, calculateScore, absolute) {
  var module = modules && modules[id];
  var scores = {};
  if (!module || module.disabled === true || module.disabled === undefined && module.enabled === false) return scores;
  function score(courseId) {
    var value = calculateScore(courseId, absolute);
    return absolute ? Number.isFinite(value) ? Math.max(value, 0) : 0 : boundedCourseProgress(value);
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
  return values.length ? values.reduce(function (sum, value) {
    return sum + boundedCourseProgress(value);
  }, 0) / values.length : 0;
}
export function sumCourseScores(scores) {
  var total = Object.values(scores || {}).reduce(function (sum, value) {
    return sum + (Number.isFinite(value) ? Math.max(value, 0) : 0);
  }, 0);
  return Number.isFinite(total) ? total : 0;
}
