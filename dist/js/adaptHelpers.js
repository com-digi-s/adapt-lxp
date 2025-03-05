import { ResultsComponent } from './components.js'; // Adjust the import path as needed

export function getDiagnosticResults() {
    var Adapt = window.App.SCO_FRAME.contentWindow.require('coreJS/adapt');
    var components = Adapt.components.models;
    var blocks = Adapt.blocks.models;

    Adapt.listenTo(Adapt.course, 'change:_isComplete', calculateScores);

    // TODO: Einstiegstest persistieren
    // Listen for the window load event
    /*window.addEventListener('load', function() {
    	alert(JSON.stringify(Adapt.course.attributes));
    	// Check if the course is complete
    	if (Adapt.course.attributes.get('_isComplete')) {
    		calculateScores();
    	}
    });*/

    function calculateScores() {
        var scoreIncrement = 1;
        var scorePerQuizBank = initializeQuizBankScores();

        components.forEach(function (component) {
            var result = calculateComponentScore(component, scoreIncrement);
            var parentId = component.get('_parentId');
            var parentBlock = blocks.find(function (block) {
                return block.get('_id') === parentId;
            });

            if (parentBlock && parentBlock.get('_assessment')) {
                var quizBankID = parentBlock.get('_assessment')._quizBankID; // Directly access the property
                updateQuizBankScores(scorePerQuizBank, quizBankID, result.questionScore, result.maxScore);
            }
        });

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

var calculateMCQScore = function calculateMCQScore(userInput, items, scoreIncrement) {
    var isCorrectArray = items.map(function (item) {
        return item._shouldBeSelected;
    });
    var maxScore = isCorrectArray.filter(Boolean).length;
    var questionScore = 0;

    isCorrectArray.forEach(function (shouldBeSelected, index) {
        var userChoice = userInput[index];
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

var calculateMatchingScore = function calculateMatchingScore(userInput, items, scoreIncrement) {
    var isCorrectArray = items.flatMap(function (question) {
        return question._options.map(function (option) {
            return option._isCorrect;
        });
    });
    var questionScore = isCorrectArray.filter(function (isCorrect, index) {
        return isCorrect && userInput[index];
    }).length * scoreIncrement;
    var maxScore = isCorrectArray.filter(Boolean).length;

    return {
        questionScore: questionScore,
        maxScore: maxScore
    };
};

var calculateDragDropScore = function calculateDragDropScore(userInput, items, scoreIncrement) {
    var questionScore = 0;
    var globalIndex = 0;
    var isCorrectArray = items.map(function (item) {
        return item.accepted.map(function () {
            return globalIndex++;
        });
    });
    var maxScore = isCorrectArray.flat().length;

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

function initializeQuizBankScores() {
    // Initialize with quiz bank IDs if available, otherwise return an empty object
    // Replace the IDs below with actual quiz bank IDs and their initial state
    return {};
}

function calculateComponentScore(component, scoreIncrement) {
    var _component$attributes = component.attributes,
        userInput = _component$attributes._userAnswer,
        type = _component$attributes._component,
        items = _component$attributes._items;


    var result = {};

    switch (type) {
        case 'mcq':
            result = calculateMCQScore(userInput, items, scoreIncrement);
            break; // Break statement added here
        case 'matching':
            result = calculateMatchingScore(userInput, items, scoreIncrement);
            break; // Break statement added here
        case 'infai-dragndrop':
            result = calculateDragDropScore(userInput, items, scoreIncrement);
            break; // Break statement added here
        default:
            // Optionally add a default case if needed
            result = {
                questionScore: 0,
                maxScore: 0
            };
    }

    // Ensuring that if result.questionScore is undefined, it's set to 0 before comparison
    result.questionScore = Math.max(result.questionScore || 0, 0);

    return result;
}

// Reusing the original scoring functions, assuming they are correct

function updateQuizBankScores(quizBank, idx, questionScore, maxScore) {
    if (quizBank[idx]) {
        quizBank[idx].score += questionScore;
        quizBank[idx].questionCount += maxScore == 0 ? 0 : 1;
        quizBank[idx].maxScore += maxScore;
    } else {
        quizBank[idx] = {
            score: questionScore,
            questionCount: 0,
            maxScore: maxScore
        };
    }
}