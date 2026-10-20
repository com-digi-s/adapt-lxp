import { ResultsComponent } from './components.js'; // Adjust the import path as needed
import { addQuizBankScore, normalizeAssessmentScore } from './assessmentScores.js';

export function getDiagnosticResults() {
    const Adapt = window.App.SCO_FRAME.contentWindow.require('coreJS/adapt');
	const components = Adapt.components.models;
	const blocks = Adapt.blocks.models;

    Adapt.listenTo(Adapt.course, 'change:_isComplete', calculateScores);

    function calculateScores() {
        const scorePerQuizBank = collectDiagnosticScores(components, blocks);
		
		const fullScore = Object.values(scorePerQuizBank).reduce((accumulator, current) => accumulator + current.score, 0);
		const maxScoreOverall = Object.values(scorePerQuizBank).reduce((accumulator, current) => accumulator + current.maxScore, 0);

		// URL agnostic (moodle has some strange URLs)
		var segments = document.getElementById("sco-frame").src.split("/");
		var scosIndex = segments.indexOf('scos');
		const scoId = segments[scosIndex + 1];
		
		window.App.templates.template_results = function (DOMelem) {
			const root = ReactDOM.createRoot(DOMelem);
			root.render(React.createElement(ResultsComponent, {
				scoId: scoId,
				fullScore: fullScore,
				maxScoreOverall: maxScoreOverall,
				scorePerQuizBank: scorePerQuizBank
			}))
		}
		
		// console.log(scorePerQuizBank);

		window.App.renderView(window.App.SCO_FRAME, window.App.SCO_FRAME.getAttribute('src'));
    }
}
	
const calculateMCQScore = (userInput, items, scoreIncrement) => {
    const isCorrectArray = items.map(item => item && item._shouldBeSelected === true);
    const maxScore = isCorrectArray.filter(Boolean).length * scoreIncrement;
    let questionScore = 0;

    isCorrectArray.forEach((shouldBeSelected, index) => {
        const userChoice = userInput[index] === true;
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
        questionScore,
        maxScore
    };
};

const calculateMatchingScore = (userInput, items, scoreIncrement) => {
    const isCorrectArray = items.flatMap(question =>
            question && Array.isArray(question._options) ? question._options.map(option => option && option._isCorrect === true) : []);
    // MatchingModel stores a flattened boolean option vector, not per-row indices.
    let questionScore = isCorrectArray.filter((isCorrect, index) => isCorrect && userInput[index] === true).length * scoreIncrement;
    const maxScore = isCorrectArray.filter(Boolean).length * scoreIncrement;

    return {
        questionScore,
        maxScore
    };
};

const calculateDragDropScore = (userInput, items, scoreIncrement) => {
    let questionScore = 0;
    let globalIndex = 0;
    const isCorrectArray = items.map(item => item && Array.isArray(item.accepted) ? item.accepted.map(() => globalIndex++) : []);
    const maxScore = isCorrectArray.flat().length * scoreIncrement;

    isCorrectArray.forEach((acceptedIndices, index) => {
        if (acceptedIndices.includes(userInput[index])) {
            questionScore += scoreIncrement;
        }
    });

    return {
        questionScore,
        maxScore
    };
};

export function calculateComponentScore(component, scoreIncrement = 1) {
    const {
        _userAnswer: userInput,
        _component: type,
        _items: items
    } = component.attributes || {};
	const answers = Array.isArray(userInput) ? userInput : [];
	const questionItems = Array.isArray(items) ? items : [];
	const increment = Number.isFinite(scoreIncrement) && scoreIncrement > 0 ? scoreIncrement : 1;
	
	let result = {};

	switch (type) {
		case 'mcq':
		case 'gmcq':
			result = calculateMCQScore(answers, questionItems, increment);
			break; // Break statement added here
		case 'matching':
			result = calculateMatchingScore(answers, questionItems, increment);
			break; // Break statement added here
		case 'infai-dragndrop':
			result = calculateDragDropScore(answers, questionItems, increment);
			break; // Break statement added here
		case 'slider':
		case 'textinput': {
			// Adapt applies ranges, alternative answers, case/punctuation rules
			// and partial credit. Use its submitted score, not a second grader.
			const attributes = component.attributes;
			const maximum = Number.isFinite(component.maxScore) ? component.maxScore : attributes._maxScore;
			const score = attributes._isSubmitted === false ? 0
				: Number.isFinite(attributes._score) ? attributes._score : component.score;
			const normalized = normalizeAssessmentScore(score, maximum);
			if (!normalized) throw new Error(`Ungültige Adapt-Bewertung für ${type}.`);
			result = { questionScore: normalized.score, maxScore: normalized.maxScore };
			break;
		}
		default: // Optionally add a default case if needed
			if (component.attributes._isQuestionType) throw new Error(`Nicht unterstützte Testkomponente: ${type}.`);
			result = {
				questionScore: 0,
				maxScore: 0
			}
	}

	const normalized = normalizeAssessmentScore(result.questionScore, result.maxScore);
	result = normalized ? { questionScore: normalized.score, maxScore: normalized.maxScore }
		: { questionScore: 0, maxScore: 0 };

	return result;
}

export function collectDiagnosticScores(components, blocks) {
    const quizBanks = {};
    const seen = new Set();
    components.forEach(component => {
        const identity = component.get('_id') || component;
        if (seen.has(identity) || component.get('_isAvailable') === false) return;
        seen.add(identity);
        const block = blocks.find(candidate => candidate.get('_id') === component.get('_parentId'));
        const assessment = block && block.get('_assessment');
        if (!assessment || assessment._isEnabled === false) return;
        const result = calculateComponentScore(component);
        updateQuizBankScores(quizBanks, assessment._quizBankID, result.questionScore, result.maxScore);
    });
    return quizBanks;
}

function updateQuizBankScores(quizBank, idx, questionScore, maxScore) {
    return addQuizBankScore(quizBank, idx, questionScore, maxScore);
}
