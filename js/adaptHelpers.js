import { ResultsComponent } from './components.js'; // Adjust the import path as needed

export function getDiagnosticResults() {
    const Adapt = window.App.SCO_FRAME.contentWindow.require('coreJS/adapt');
	const components = Adapt.components.models;
	const blocks = Adapt.blocks.models;

    Adapt.listenTo(Adapt.course, 'change:_isComplete', calculateScores);

    function calculateScores() {
        const scoreIncrement = 1;
        const scorePerQuizBank = initializeQuizBankScores();

		components.forEach(component => {
			const result = calculateComponentScore(component, scoreIncrement);
			const parentId = component.get('_parentId');
			const parentBlock = blocks.find(block => block.get('_id') === parentId);

			if (parentBlock && parentBlock.get('_assessment')) {
				const quizBankID = parentBlock.get('_assessment')._quizBankID; // Directly access the property
				updateQuizBankScores(scorePerQuizBank, quizBankID, result.questionScore, result.maxScore);
			}
		});
		
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
    const isCorrectArray = items.map(item => item._shouldBeSelected);
    const maxScore = isCorrectArray.filter(Boolean).length;
    let questionScore = 0;

    isCorrectArray.forEach((shouldBeSelected, index) => {
        const userChoice = userInput[index];
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
            question._options.map(option => option._isCorrect));
    let questionScore = isCorrectArray.filter((isCorrect, index) => isCorrect && userInput[index]).length * scoreIncrement;
    const maxScore = isCorrectArray.filter(Boolean).length;

    return {
        questionScore,
        maxScore
    };
};

const calculateDragDropScore = (userInput, items, scoreIncrement) => {
    let questionScore = 0;
    let globalIndex = 0;
    const isCorrectArray = items.map(item => item.accepted.map(() => globalIndex++));
    const maxScore = isCorrectArray.flat().length;

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

function initializeQuizBankScores() {
    // Initialize with quiz bank IDs if available, otherwise return an empty object
    // Replace the IDs below with actual quiz bank IDs and their initial state
    return {};
}

function calculateComponentScore(component, scoreIncrement) {
    const {
        _userAnswer: userInput,
        _component: type,
        _items: items
    } = component.attributes;
	
	let result = {};

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
		default: // Optionally add a default case if needed
			result = {
				questionScore: 0,
				maxScore: 0
			}
	}

	// Ensuring that if result.questionScore is undefined, it's set to 0 before comparison
	result.questionScore = Math.max(result.questionScore || 0, 0);

	return result;
}

// Reusing the original scoring functions, assuming they are correct

function updateQuizBankScores(quizBank, idx, questionScore, maxScore) {
    if (quizBank[idx]) {
        quizBank[idx].score += questionScore;
        quizBank[idx].questionCount += (maxScore == 0) ? 0 : 1;
        quizBank[idx].maxScore += maxScore;
    } else {
        quizBank[idx] = {
            score: questionScore,
            questionCount: 0,
            maxScore: maxScore
        };
    }
}
