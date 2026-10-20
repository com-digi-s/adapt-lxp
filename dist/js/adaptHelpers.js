import { ResultsComponent } from './components.js'; // Adjust the import path as needed
import { addQuizBankScore, normalizeAssessmentScore } from './assessmentScores.js';
var diagnosticObservers = new WeakMap();
export function getDiagnosticResults() {
  var Adapt = window.App.SCO_FRAME.contentWindow.require('coreJS/adapt');
  var components = Adapt.components.models;
  var blocks = Adapt.blocks.models;
  var previousObserver = diagnosticObservers.get(Adapt.course);
  if (previousObserver) Adapt.stopListening(Adapt.course, 'change:_isComplete', previousObserver);
  diagnosticObservers.set(Adapt.course, calculateScores);
  Adapt.listenTo(Adapt.course, 'change:_isComplete', calculateScores);
  // Restored/completed tests do not emit a new completion transition on click.
  if (Adapt.course.get('_isComplete') === true) calculateScores();
  function calculateScores() {
    if (Adapt.course.get('_isComplete') !== true) return;
    var scorePerQuizBank;
    try {
      scorePerQuizBank = collectDiagnosticScores(components, blocks);
    } catch (error) {
      window.App.templates.template_results = function (DOMelem) {
        ReactDOM.createRoot(DOMelem).render(React.createElement('div', {
          role: 'alert'
        }, React.createElement('h3', null, 'Ergebnisbericht nicht verfügbar'), React.createElement('p', null, error.message + ' Bitte die Kursbetreuung informieren.')));
      };
      window.App.renderView(window.App.SCO_FRAME, window.App.SCO_FRAME.getAttribute('src'));
      return;
    }
    var fullScore = Object.values(scorePerQuizBank).reduce(function (accumulator, current) {
      return accumulator + current.score;
    }, 0);
    var maxScoreOverall = Object.values(scorePerQuizBank).reduce(function (accumulator, current) {
      return accumulator + current.maxScore;
    }, 0);

    // URL agnostic (moodle has some strange URLs)
    var segments = document.getElementById("sco-frame").src.split("/");
    var scosIndex = segments.indexOf('scos');
    var scoId = segments[scosIndex + 1];
    window.App.templates.template_results = function (DOMelem) {
      var root = ReactDOM.createRoot(DOMelem);
      root.render(React.createElement(ResultsComponent, {
        scoId: scoId,
        fullScore: fullScore,
        maxScoreOverall: maxScoreOverall,
        scorePerQuizBank: scorePerQuizBank
      }));
    };

    // console.log(scorePerQuizBank);

    window.App.renderView(window.App.SCO_FRAME, window.App.SCO_FRAME.getAttribute('src'));
  }
}
var calculateMCQScore = function (userInput, items, scoreIncrement) {
  var isCorrectArray = items.map(function (item) {
    return item && item._shouldBeSelected === true;
  });
  var maxScore = isCorrectArray.filter(Boolean).length * scoreIncrement;
  var questionScore = 0;
  isCorrectArray.forEach(function (shouldBeSelected, index) {
    var userChoice = userInput[index] === true;
    // If it should be selected and the user selected it
    if (shouldBeSelected && userChoice) {
      questionScore += scoreIncrement;
    }
    // If it shouldn't be selected but the user selected it
    if (!shouldBeSelected && userChoice) {
      questionScore -= scoreIncrement;
    }
  });
  return {
    questionScore: questionScore,
    maxScore: maxScore
  };
};
var calculateMatchingScore = function (userInput, items, scoreIncrement) {
  var isCorrectArray = items.flatMap(function (question) {
    return question && Array.isArray(question._options) ? question._options.map(function (option) {
      return option && option._isCorrect === true;
    }) : [];
  });
  // MatchingModel stores a flattened boolean option vector, not per-row indices.
  var questionScore = isCorrectArray.filter(function (isCorrect, index) {
    return isCorrect && userInput[index] === true;
  }).length * scoreIncrement;
  var maxScore = isCorrectArray.filter(Boolean).length * scoreIncrement;
  return {
    questionScore: questionScore,
    maxScore: maxScore
  };
};
var calculateDragDropScore = function (userInput, items, scoreIncrement) {
  var questionScore = 0;
  var globalIndex = 0;
  var isCorrectArray = items.map(function (item) {
    return item && Array.isArray(item.accepted) ? item.accepted.map(function () {
      return globalIndex++;
    }) : [];
  });
  var maxScore = isCorrectArray.flat().length * scoreIncrement;
  isCorrectArray.forEach(function (acceptedIndices, index) {
    if (acceptedIndices.includes(userInput[index])) {
      questionScore += scoreIncrement;
    }
  });
  return {
    questionScore: questionScore,
    maxScore: maxScore
  };
};
export function calculateComponentScore(component) {
  var scoreIncrement = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
  var _ref = component.attributes || {},
    userInput = _ref._userAnswer,
    type = _ref._component,
    items = _ref._items;
  var answers = Array.isArray(userInput) ? userInput : [];
  var questionItems = Array.isArray(items) ? items : [];
  var increment = Number.isFinite(scoreIncrement) && scoreIncrement > 0 ? scoreIncrement : 1;
  var result = {};
  switch (type) {
    case 'mcq':
    case 'gmcq':
      result = calculateMCQScore(answers, questionItems, increment);
      break;
    // Break statement added here
    case 'matching':
      result = calculateMatchingScore(answers, questionItems, increment);
      break;
    // Break statement added here
    case 'infai-dragndrop':
      result = calculateDragDropScore(answers, questionItems, increment);
      break;
    // Break statement added here
    case 'slider':
    case 'textinput':
      {
        // Adapt applies ranges, alternative answers, case/punctuation rules
        // and partial credit. Use its submitted score, not a second grader.
        var attributes = component.attributes;
        var maximum = Number.isFinite(component.maxScore) ? component.maxScore : attributes._maxScore;
        var score = attributes._isSubmitted === false ? 0 : Number.isFinite(attributes._score) ? attributes._score : component.score;
        var _normalized = normalizeAssessmentScore(score, maximum);
        if (!_normalized) throw new Error("Ung\xFCltige Adapt-Bewertung f\xFCr ".concat(type, "."));
        result = {
          questionScore: _normalized.score,
          maxScore: _normalized.maxScore
        };
        break;
      }
    default:
      // Optionally add a default case if needed
      if (component.attributes._isQuestionType) throw new Error("Nicht unterst\xFCtzte Testkomponente: ".concat(type, "."));
      result = {
        questionScore: 0,
        maxScore: 0
      };
  }
  var normalized = normalizeAssessmentScore(result.questionScore, result.maxScore);
  result = normalized ? {
    questionScore: normalized.score,
    maxScore: normalized.maxScore
  } : {
    questionScore: 0,
    maxScore: 0
  };
  return result;
}
export function collectDiagnosticScores(components, blocks) {
  var quizBanks = {};
  var seen = new Set();
  components.forEach(function (component) {
    var identity = component.get('_id') || component;
    if (seen.has(identity) || component.get('_isAvailable') === false) return;
    seen.add(identity);
    var block = blocks.find(function (candidate) {
      return candidate.get('_id') === component.get('_parentId');
    });
    var assessment = block && block.get('_assessment');
    if (!assessment || assessment._isEnabled === false) return;
    var result = calculateComponentScore(component);
    updateQuizBankScores(quizBanks, assessment._quizBankID, result.questionScore, result.maxScore);
  });
  return quizBanks;
}
function updateQuizBankScores(quizBank, idx, questionScore, maxScore) {
  return addQuizBankScore(quizBank, idx, questionScore, maxScore);
}
