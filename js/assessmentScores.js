// Shared validation for diagnostic totals and the downloadable result report.
// These are scores, not completion flags: a zero maximum is never a question.
export function normalizeAssessmentScore(score, maxScore) {
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;
    return { score: Math.min(Math.max(score, 0), maxScore), maxScore: maxScore };
}

export function assessmentPercentage(score, maxScore) {
    var normalized = normalizeAssessmentScore(score, maxScore);
    return normalized ? normalized.score / normalized.maxScore * 100 : null;
}

export function addQuizBankScore(quizBank, id, score, maxScore) {
    var normalized = normalizeAssessmentScore(score, maxScore);
    // Missing IDs and object keys must not silently create an assessment bank.
    if (!normalized || (typeof id !== 'string' && typeof id !== 'number')) return false;
    var key = String(id).trim();
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
    if (!Object.prototype.hasOwnProperty.call(quizBank, key)) {
        quizBank[key] = { score: 0, questionCount: 0, maxScore: 0 };
    }
    quizBank[key].score += normalized.score;
    quizBank[key].maxScore += normalized.maxScore;
    quizBank[key].questionCount += 1;
    return true;
}

export function aggregateQuizBankScores(quizBanks, modules) {
    var moduleScores = {};
    var domainScores = {};
    var unmappedQuizBanks = [];
    Object.entries(quizBanks || {}).forEach(function (entry) {
        var id = entry[0];
        var data = entry[1];
        var normalized = data && normalizeAssessmentScore(data.score, data.maxScore);
        if (!normalized) return;
        // Preserve the existing DigComp numeric mapping only. Future identifiers
        // need an explicit mapping; guessing from their first/last letters is unsafe.
        if (!/^[1-9]\d[1-3]$/.test(id) || !modules || !modules['M' + id.charAt(0)]) {
            unmappedQuizBanks.push(id);
            return;
        }
        var module = id.charAt(0);
        var domain = id.charAt(id.length - 1);
        if (!moduleScores[module]) moduleScores[module] = { score: 0, maxScore: 0 };
        if (!domainScores[domain]) domainScores[domain] = { score: 0, maxScore: 0 };
        moduleScores[module].score += normalized.score;
        moduleScores[module].maxScore += normalized.maxScore;
        domainScores[domain].score += normalized.score;
        domainScores[domain].maxScore += normalized.maxScore;
    });
    return { moduleScores: moduleScores, domainScores: domainScores, unmappedQuizBanks: unmappedQuizBanks };
}
