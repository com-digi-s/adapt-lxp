'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

import * as adaptHelpers from './adaptHelpers.js';
import * as jQuery from '../libraries/jquery-2.2.4.min.js';

import { timeIntToString } from './utils.js';
import { GlossaryDropdown, CoursePathway, Card, CollapsibleCard, CourseStats, XP } from './components.js';
import { pulseChart, radarChart } from './charts.js';

/** Class with the main functionalities of the app */
export var App = function () {
	/**
  * Creates an instance of App.
  * @memberof App
  */
	function App() {
		_classCallCheck(this, App);

		window.$ = window.jQuery = jQuery;

		this.adaptHelpers = adaptHelpers;
		this.DATA = window.CONF.DEFAULT_DATA;
		this.SCORM_API = window.pipwerks.SCORM;
		this.SESSION_START = new Date();
		this.SCO_FRAME = window.document.getElementById('sco-frame');
		this.lmsConnection = this.SCORM_API.init();

		/*const connectionStatusElement = document.getElementById('connection-status');
  
           if (!this.lmsConnection) {
               console.info('started application in offline mode')
  	connectionStatusElement.classList.add('offline');
  	connectionStatusElement.innerText = 'Offline';
           } else {
               console.info('started application in online mode')
  	connectionStatusElement.classList.add('online');
  	connectionStatusElement.innerText = 'Online';
           }*/
	}

	/**
  *
  * Initializes the app (sets up templates and APIs)
  * @memberof App
  */


	_createClass(App, [{
		key: 'init',
		value: function init() {
			this.templates = {
				template_glossary: function (DOMelem) {
					var root = ReactDOM.createRoot(DOMelem);
					root.render(React.createElement(GlossaryDropdown, {
						glossary: window.CONF.glossary
					}));
				}.bind(this),

				template_xp: function (DOMelem) {
					var root = ReactDOM.createRoot(DOMelem);
					root.render(React.createElement(XP, {
						xp: this.calculateXP()
					}));
				}.bind(this),

				template_entryTest: function (DOMelem) {
					var _this = this;

					// Extract the first SCO card meta
					var firstCardMeta = {
						launchSCO: function launchSCO(scoId, location) {
							return _this.launchSCO(scoId, location);
						},
						first: true,
						last: false,
						mod: Object.keys(window.CONF.SCOS)[0],
						scores: _this.calculateCourseScoresOfModule(Object.keys(window.CONF.SCOS)[0]),
						bookmark: _this.DATA['cmi.suspend_data'].bookmark
					};

					// Render the first SCO using template_card
					ReactDOM.createRoot(DOMelem).render(React.createElement(Card, Object.assign({ key: firstCardMeta.mod }, firstCardMeta)));
				}.bind(this),

				template_courseSelector: function (DOMelem) {
					var _this = this;

					var root = ReactDOM.createRoot(DOMelem);
					var cardsMeta = Object.keys(window.CONF.SCOS).map(function (mod, idx) {
						return {
							launchSCO: function launchSCO(scoId, location) {
								return _this.launchSCO(scoId, location);
							},
							first: idx === 0,
							last: idx === Object.keys(window.CONF.SCOS).length - 1,
							mod: mod,
							scores: _this.calculateCourseScoresOfModule(mod),
							bookmark: _this.DATA['cmi.suspend_data'].bookmark
						};
					});

					// Filter out the first and last SCOs
					var middleCardsMeta = cardsMeta.slice(1, -1);

					root.render(React.createElement(
						'div',
						{ className: 'middle-scos' },
						middleCardsMeta.map(function (meta, idx) {
							return React.createElement(CollapsibleCard, Object.assign({ key: idx + 1 }, meta));
						})
					));
				}.bind(this),

				template_finalTest: function (DOMelem) {
					var _this = this;

					// Extract the last SCO card meta
					var lastCardMeta = {
						launchSCO: function launchSCO(scoId, location) {
							return _this.launchSCO(scoId, location);
						},
						first: false,
						last: true,
						mod: Object.keys(window.CONF.SCOS)[Object.keys(window.CONF.SCOS).length - 1],
						scores: _this.calculateCourseScoresOfModule(Object.keys(window.CONF.SCOS)[Object.keys(window.CONF.SCOS).length - 1]),
						bookmark: _this.DATA['cmi.suspend_data'].bookmark
					};

					// Render the last SCO using template_card
					ReactDOM.createRoot(DOMelem).render(React.createElement(Card, Object.assign({ key: lastCardMeta.mod }, lastCardMeta)));
				}.bind(this),

				template_coursePathways: function (DOMelem) {
					var root = ReactDOM.createRoot(DOMelem);
					root.render(React.createElement(CoursePathway, {
						pathways: window.CONF.pathways,
						SCOS: window.CONF.SCOS
					}));
				}.bind(this),

				/* template_courseStats: function (DOMelem) {
    const root = ReactDOM.createRoot(DOMelem)
    root.render(React.createElement(CourseStats, { courseStats: this.calculateCourseStats() }))
    }.bind(this), */
				template_pulse: function (DOMelem) {
					return pulseChart(this.DATA['cmi.suspend_data'].customData['learning-experience'], DOMelem);
				}.bind(this),

				template_radar: function (DOMelem) {
					return radarChart(this.calculateAverageModuleScores(), DOMelem);
				}.bind(this)
			};

			this.SCORM_API.set = function (parameter, value) {
				this.DATA[parameter] = value;

				if (window.CONF.LOCAL_STORAGE || this.lmsConnection) {
					if (parameter === 'cmi.suspend_data') {
						var bookmark = this.DATA['cmi.suspend_data'].bookmark;
						var adaptData = this.DATA['cmi.suspend_data'].adaptData;
						var customData = this.DATA['cmi.suspend_data'].customData;

						value = this._compressSuspendData(bookmark + window.CONF.SUSPEND_DATA_DELIMITER + JSON.stringify(adaptData) + window.CONF.SUSPEND_DATA_DELIMITER + JSON.stringify(customData));
					}
					if (window.CONF.LOCAL_STORAGE) {
						window.localStorage.setItem(parameter, value);
					}
					if (this.lmsConnection) {
						this.SCORM_API.data.set(parameter, value);
					}
				}
			}.bind(this);

			this.SCORM_API.get = function (parameter) {
				/* save only last cmi.interaction in offline mode */
				if (!this.lmsConnection && parameter.startsWith('cmi.interactions.')) return 0;
				if (parameter === 'cmi.suspend_data') {
					return this._getSuspendData(this.DATA[parameter]);
				} else {
					// this.DATA works only in current session; LMSGetValue only with LMSConnection and has bandwidth limitations; localStorage only works on local device + time for parsing strings -> objects
					return this.DATA[parameter] || (this.lmsConnection ? this.SCORM_API.data.get(parameter) : window.CONF.LOCAL_STORAGE ? window.localStorage.getItem(parameter) : '') || window.CONF.DEFAULT_DATA[parameter];
				}
			}.bind(this);
		}
	}, {
		key: 'handleAPI',
		value: function handleAPI(subAPI) {
			var _this2 = this;

			// Check if subAPI is ready
			if (!this.SCORM_API) {
				console.warn('Main SCORM API is not available.');
				return;
			}

			subAPI.LMSInitialize = function () {
				return "true";
			};

			// Only has access to simple API not to API-Wrapper
			subAPI.LMSGetValue = function (parameter) {
				if (parameter === 'cmi.suspend_data') {
					// Make subAPI "believe" that it is the only one receiving suspend_data
					return JSON.stringify(this.DATA['cmi.suspend_data'].adaptData[this.DATA['cmi.suspend_data'].bookmark] || {});
				} else {
					return this.SCORM_API.get(parameter);
				}
			}.bind(this);

			subAPI.LMSSetValue = function (parameter, value) {
				if (parameter === 'cmi.suspend_data') {
					// suspend_data is the only value that is locally different (overall score, student preferences etc. are global)
					this.DATA['cmi.suspend_data'].adaptData[this.DATA['cmi.suspend_data'].bookmark] = JSON.parse(value);
					// Convert dict to SUSPEND_DATA_DELIMITER-separated string
					this.SCORM_API.set('cmi.suspend_data', this.DATA['cmi.suspend_data']);
				} else if (parameter === 'cmi.core.lesson_status') {
					return true;
				} else if (parameter.endsWith('.id')) {
					this.SCORM_API.set(parameter, this.DATA['cmi.suspend_data'].bookmark + '#' + value);
				} else {
					this.SCORM_API.set(parameter, value);
				}
			}.bind(this);

			subAPI.LMSCommit = function () {
				_this2.SCORM_API.save();return "true";
			};

			subAPI.LMSFinish = function () {
				return "true";
			};

			subAPI.LMSGetLastError = function () {
				return "0";
			};

			subAPI.LMSGetErrorString = function (errorCode) {
				return "No error";
			};

			subAPI.LMSGetDiagnostic = function (errorCode) {
				return "No error";
			};
		}
	}, {
		key: 'stopApp',
		value: function stopApp() {
			// The course is completed when all courses are completed
			var completed = this.checkAllCoursesCompletion();
			if (completed) {
				this.SCORM_API.set('cmi.core.score.raw', 100);
				this.SCORM_API.set('cmi.core.lesson_status', 'completed');
			} else {
				this.SCORM_API.set('cmi.core.lesson_status', 'incomplete');
			}

			// don't depend on the LMS to track the session_time by itself
			var sessionTime = timeIntToString(new Date() - this.SESSION_START);
			this.SCORM_API.set('cmi.core.session_time', sessionTime);

			var today = new Date();
			today = String(today.getMonth() + 1).padStart(2, '0') + '/' + String(today.getDate()).padStart(2, '0') + '/' + String(today.getFullYear()).slice(-2);

			var learningExperience = this.DATA['cmi.suspend_data'].customData['learning-experience'];

			if (typeof learningExperience !== 'undefined') {
				var lastEntry = learningExperience[learningExperience.length - 1];
				var daySessionTime = timeIntToString(new Date() - this.SESSION_START);

				if (typeof lastEntry !== 'undefined') {
					if (lastEntry[0] === today) {
						daySessionTime = timeIntToString(new Date('1970-01-01T' + lastEntry[1] + 'Z').getTime() + new Date('1970-01-01T' + sessionTime + 'Z').getTime());
						learningExperience.pop();
					}
				}

				learningExperience.push([today, daySessionTime, this.calculateXP()]);
			}

			this.DATA['cmi.suspend_data'].customData['learning-experience'] = learningExperience;

			this.SCORM_API.set('cmi.suspend_data', this.DATA['cmi.suspend_data']);
			this.SCORM_API.save();
			this.SCORM_API.quit();
		}
	}, {
		key: 'scoIdExists',
		value: function scoIdExists(scoId) {
			var scoIdSplit = scoId.split('.');
			if (scoIdSplit.length === 1) {
				return typeof window.CONF.SCOS[scoId] !== 'undefined' && typeof window.CONF.SCOS[scoId].courses === 'undefined';
			}
			return window.CONF.SCOS[scoIdSplit[0]].courses.some(function (course) {
				return course["id"] === scoIdSplit[1];
			}) || false;
		}
	}, {
		key: 'setCustomInteraction',
		value: function setCustomInteraction(interactionId) {
			var n = this.SCORM_API.get('cmi.interactions._count');
			this.SCORM_API.set('cmi.interactions.' + n + '.id', interactionId);
			this.SCORM_API.set('cmi.interactions.' + n + '.time', timeIntToString(new Date(), new Date().getTimezoneOffset() / 60));
			this.SCORM_API.set('cmi.interactions.' + n + '.type', 'choice');
			this.SCORM_API.save();
		}
	}, {
		key: 'toAlphaNumeric',
		value: function toAlphaNumeric(label) {
			// Handle null or undefined labels
			if (!label) {
				return 'unnamed'; // or return a default label if preferred
			}

			// Normalize the string and remove diacritics
			var normalizedLabel = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

			// Remove non-alphanumeric characters, except spaces
			var cleanedLabel = normalizedLabel.replace(/[^a-zA-Z0-9 ]/g, '');

			// Split the string by spaces and capitalize each word except the first
			var words = cleanedLabel.split(' ');
			for (var i = 1; i < words.length; i++) {
				words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
			}

			// Join the words to form a camelCase string
			return words.join('');
		}
	}, {
		key: 'addEventListenersToElements',
		value: function addEventListenersToElements(that, elements, getAttributeFn) {
			for (var i = 0; i < elements.length; i++) {
				var element = elements[i];
				// Check if the listener has already been added
				if (!element.__listenerAdded) {
					element.addEventListener('click', function (event) {
						var attribute = getAttributeFn(event.currentTarget);
						that.setCustomInteraction(that.toAlphaNumeric(attribute));
					});
					// Mark the listener as added
					element.__listenerAdded = true;
				}
			}
		}
	}, {
		key: 'getAttributeForButton',
		value: function getAttributeForButton(btn) {
			var classes = btn.className;

			// Mapping class names to specific actions
			switch (classes) {
				case "btn-icon abs__btn-arrow is-left":
					return "clickPreviousBlock";
				case "btn-icon abs__btn-arrow is-right":
					return "clickNextBlock";
				case "btn-icon abs__btn-arrow is-right last-next":
					return "clickLastBlock";
				case "btn-icon nav__btn nav__toc-btn js-nav-toc-btn toc-navigation":
					return "openTableOfContents";
				case "btn-icon drawer__btn drawer__close-btn js-drawer-close-btn":
					return "closeDrawer";
				default:
					// Checking for specific selectors within the parent component
					if (btn.matches('.component > .show-user-answer > .btn__action')) {
						return 'showCorrectAnswer#' + btn.closest('.component').getAttribute('data-adapt-id');
					}
					if (btn.matches('.component > .show-correct-answer > .btn__action')) {
						return 'showUserAnswer#' + btn.closest('.component').getAttribute('data-adapt-id');
					}
					if (btn.matches('.component .btn__response-container > .btn__action')) {
						return 'clickSubmit#' + btn.closest('.component').getAttribute('data-adapt-id');
					}
					if (btn.matches('.component .btn__response-container > .btn__feedback')) {
						return 'showFeedback#' + btn.closest('.component').getAttribute('data-adapt-id');
					}
					// Default case if none of the above matches
					return btn.getAttribute('aria-label');
			}
		}
	}, {
		key: 'waitForElementAndExecute',
		value: function waitForElementAndExecute(parentElement, elementSelector, callback) {
			var checkInterval = 100; // interval in milliseconds to check for the element
			var maxAttempts = 50; // maximum number of attempts to check for the element
			var attempts = 0;

			function checkForElement() {
				attempts++;
				var element = parentElement.querySelector(elementSelector);
				if (element) {
					callback(element); // element found, execute the callback
				} else if (attempts < maxAttempts) {
					setTimeout(checkForElement, checkInterval); // element not found, check again after some time
				}
			}

			checkForElement(); // start checking for the element
		}
	}, {
		key: 'launchSCO',
		value: function launchSCO(scoId) {
			var _this3 = this;

			var contentPath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

			if (this.scoIdExists(scoId)) {
				this.SCO_FRAME.onload = function () {
					var subAPI = _this3.SCO_FRAME.contentWindow.API;

					if (subAPI) {
						_this3.handleAPI(subAPI);
					}

					var that = _this3;
					// Flag zur Überprüfung, ob Eventlistener bereits hinzugefügt wurden
					that.eventListenersAdded = false;

					// Funktion zum Hinzufügen der Eventlistener
					function addKeyboardListeners(iframeDoc) {
						if (that.eventListenersAdded) {
							// Listener wurden bereits hinzugefügt
							return;
						}

						// Definieren der Handler-Funktionen
						that.keyupHandler = function (event) {
							var key = event.key;

							if (key !== 'ArrowRight' && key !== 'ArrowLeft') {
								return; // Ignoriere andere Tasten
							}

							// Optional: Verhindern des Standardverhaltens der Pfeiltasten
							event.preventDefault();

							if (!iframeDoc) {
								console.warn('Das iframe-Dokument ist nicht verfügbar.');
								return;
							}

							if (key === 'ArrowRight') {
								// Finden des aktuell ausgewählten Tabs
								var selectedTab = iframeDoc.querySelector('.abs__btn-tab.is-selected');
								if (selectedTab) {
									// Finden des nächsten Geschwisterelements
									var nextSibling = selectedTab.nextElementSibling;
									if (nextSibling && nextSibling.classList.contains('abs__btn-tab')) {
										// Klicken auf das nächste Geschwisterelement
										nextSibling.click();
										console.log('ArrowRight losgelassen: Nächstes Tab wurde geklickt.');
									} else {
										console.warn('Kein nächstes Geschwisterelement nach dem ausgewählten Tab gefunden.');
									}
								} else {
									console.warn('Kein Element mit der Klasse "abs__btn-tab is-selected" gefunden.');
								}
							}

							if (key === 'ArrowLeft') {
								// Finden des aktuell ausgewählten Tabs
								var _selectedTab = iframeDoc.querySelector('.abs__btn-tab.is-selected');
								if (_selectedTab) {
									// Finden des vorherigen Geschwisterelements
									var previousSibling = _selectedTab.previousElementSibling;
									if (previousSibling && previousSibling.classList.contains('abs__btn-tab')) {
										// Klicken auf das vorherige Geschwisterelement
										previousSibling.click();
										console.log('ArrowLeft losgelassen: Vorheriges Tab wurde geklickt.');
									} else {
										console.warn('Kein vorheriges Geschwisterelement vor dem ausgewählten Tab gefunden.');
									}
								} else {
									console.warn('Kein Element mit der Klasse "abs__btn-tab is-selected" gefunden.');
								}
							}
						};

						// Hinzufügen des keyup Event-Listeners zur iframe-Dokument
						iframeDoc.addEventListener('keyup', that.keyupHandler);

						that.eventListenersAdded = true;
						console.log('Keyboard-Eventlistener wurden hinzugefügt (keyup).');
					}

					// Funktion zum Initialisieren der Eventlistener, sobald die erforderlichen Elemente vorhanden sind
					function initializeListeners(iframeDoc) {
						// Finden des 'wrapper' Elements
						var wrapper = iframeDoc.querySelector('#wrapper');
						if (!wrapper) {
							console.warn('Kein Element mit der ID "wrapper" gefunden.');
							return;
						}

						// Finden des '.page' Elements innerhalb des 'wrapper'
						var page = wrapper.querySelector('.page');
						if (!page) {
							console.warn('Kein Element mit der Klasse "page" gefunden.');
							return;
						}

						// Hinzufügen der Eventlistener
						addKeyboardListeners(iframeDoc);
					}

					// Funktion zum Beobachten von Änderungen im DOM und Initialisieren der Listener
					function observeDOM(iframeDoc) {
						var wrapper = iframeDoc.querySelector('#wrapper');
						if (!wrapper) {
							console.warn('Kein Element mit der ID "wrapper" gefunden. Beobachtung gestartet.');
							return;
						}

						// Initialisieren, falls die Elemente bereits vorhanden sind
						initializeListeners(iframeDoc);

						// Set up MutationObserver to watch for the '.page' element
						var observer = new MutationObserver(function (mutationsList, observer) {
							var _iteratorNormalCompletion = true;
							var _didIteratorError = false;
							var _iteratorError = undefined;

							try {
								for (var _iterator = mutationsList[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
									var mutation = _step.value;

									if (mutation.type === 'childList') {
										var page = wrapper.querySelector('.page');
										if (page) {
											// Sobald '.page' gefunden wurde, füge die Listener hinzu und beende den Observer
											initializeListeners(iframeDoc);
											observer.disconnect();
											break;
										}
									}
								}
							} catch (err) {
								_didIteratorError = true;
								_iteratorError = err;
							} finally {
								try {
									if (!_iteratorNormalCompletion && _iterator.return) {
										_iterator.return();
									}
								} finally {
									if (_didIteratorError) {
										throw _iteratorError;
									}
								}
							}
						});

						// Beobachten von Änderungen innerhalb des 'wrapper'
						observer.observe(wrapper, { childList: true, subtree: true });
					}

					// Initialer Versuch, die Listener hinzuzufügen, falls die Elemente bereits vorhanden sind
					var initialIframeDoc = that.SCO_FRAME.contentDocument || that.SCO_FRAME.contentWindow.document;
					if (initialIframeDoc) {
						initializeListeners(initialIframeDoc);
						if (!that.eventListenersAdded) {
							// Falls die Listener noch nicht hinzugefügt wurden, setze den MutationObserver
							observeDOM(initialIframeDoc);
						}
					}

					// Setzen des MutationObservers für zukünftige Änderungen
					that.waitForElementAndExecute(that.SCO_FRAME.contentDocument, '#wrapper', function (wrapper) {
						observeDOM(initialIframeDoc);
					});
				};

				this.DATA['cmi.suspend_data'].bookmark = scoId;

				this.SCORM_API.set('cmi.suspend_data', this.DATA['cmi.suspend_data']);

				this.setCustomInteraction('launchSco#' + scoId);

				this.SCORM_API.save();

				var path = 'scos/' + scoId.replace('.', '/') + '/index.html#' + contentPath;

				this.SCO_FRAME.setAttribute('src', path);

				console.log('started SCO ' + scoId);
			} else {
				console.log('could not locate SCO ' + scoId);
			}
		}
	}, {
		key: 'getComponentStates',
		value: function getComponentStates(courseId) {
			return window.SCORMSuspendData.deserialize(this.DATA['cmi.suspend_data'].adaptData[courseId].q);
		}
	}, {
		key: 'calculateScore',
		value: function calculateScore(id) {
			var absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

			if (typeof this.DATA['cmi.suspend_data'].adaptData[id] !== 'undefined') {
				if (typeof this.DATA['cmi.suspend_data'].adaptData[id].q !== 'undefined') {
					var score = 0;

					var componentStates = this.getComponentStates(id);
					componentStates.forEach(function (q) {
						score += q[2][1].filter(Boolean).length / q[2][1].length;
					});

					return absolute ? score : score / componentStates.length;
				}
			}

			return 0;
		}
	}, {
		key: 'isCompleted',
		value: function isCompleted(courseId) {
			return this.calculateScore(courseId) >= window.CONF["COMPLETION_THRESHOLD"];
		}
	}, {
		key: 'calculateCourseScoresOfModule',
		value: function calculateCourseScoresOfModule(id) {
			var _this4 = this;

			var absolute = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

			var scores = {};
			// get all courses for module from config
			if (typeof window.CONF.SCOS[id].courses !== 'undefined') {
				window.CONF.SCOS[id].courses.forEach(function (course) {
					var compCourseId = id + '.' + course.id;
					scores[course.id] = _this4.calculateScore(compCourseId, absolute);
				});
			} else {
				scores = {
					0: this.calculateScore(id, absolute)
				};
			}

			return scores;
		}
	}, {
		key: 'calculateAverageModuleScores',
		value: function calculateAverageModuleScores() {
			var _this5 = this;

			var averageModuleScores = {};

			Object.values(window.CONF.SCOS).forEach(function (module) {
				var progressModule = _this5.calculateCourseScoresOfModule(module.id);
				var averageScore = 0;

				Object.values(progressModule).forEach(function (courseScore) {
					averageScore += courseScore;
				});

				averageModuleScores[module.id] = averageScore / Object.values(progressModule).length;
			});

			return averageModuleScores;
		}
	}, {
		key: 'checkAllCoursesCompletion',
		value: function checkAllCoursesCompletion() {
			var adaptData = this.DATA["cmi.suspend_data"].adaptData;
			var allCoursesCompleted = true;

			for (var courseId in adaptData) {
				if (adaptData.hasOwnProperty(courseId)) {
					var isCourseCompleted = this.isCompleted(courseId);

					if (!isCourseCompleted) {
						allCoursesCompleted = false;
					}
				}
			}

			return allCoursesCompleted;
		}
	}, {
		key: 'calculateXP',
		value: function calculateXP() {
			var _this6 = this;

			var scores = {};

			Object.keys(window.CONF.SCOS).forEach(function (id) {
				scores[id] = Object.values(_this6.calculateCourseScoresOfModule(id, true)).reduce(function (a, b) {
					return a + b;
				});
			});

			var xp = Object.values(scores).reduce(function (a, b) {
				return a + b;
			});

			return xp.toFixed(0);
		}
	}, {
		key: 'calculateCourseStats',
		value: function calculateCourseStats() {
			var _this7 = this;

			var stats = [0, 0];

			Object.keys(window.CONF.SCOS).forEach(function (id) {
				var courseScores = Object.values(_this7.calculateCourseScoresOfModule(id, false));
				var _ref = [stats[0] + courseScores.filter(function (courseScore) {
					return courseScore > 0;
				}).length, stats[1] + courseScores.filter(function (courseScore) {
					return courseScore === 1;
				}).length];
				stats[0] = _ref[0];
				stats[1] = _ref[1];
			});

			return stats;
		}
	}, {
		key: 'fillTemplate',
		value: function fillTemplate(id, iframeDocument) {
			var DOMelem = iframeDocument.getElementById(id);
			if (DOMelem) {
				this.templates[id](DOMelem);
			}
		}
	}, {
		key: 'fillTemplates',
		value: function fillTemplates(iframeDocument) {
			var _this8 = this;

			Object.keys(this.templates).forEach(function (id) {
				_this8.fillTemplate(id, iframeDocument);
			});
			return true;
		}
	}, {
		key: 'renderView',
		value: function renderView(destFrame, viewPath) {
			this.setCustomInteraction('render_' + viewPath);
			this.SCORM_API.save();

			document.style = destFrame.style = 'opacity: 0; filter: blur(1rem);';
			if (destFrame.getAttribute('src') !== viewPath) {
				destFrame.setAttribute('src', viewPath);

				destFrame.onload = function () {
					var iframeDocument = destFrame.contentDocument;
					this.fillTemplates(document);
					this.fillTemplates(iframeDocument);
				}.bind(this);
			} else {
				var iframeDocument = destFrame.contentDocument;
				this.fillTemplates(document);
				this.fillTemplates(iframeDocument);
			}
			document.style = destFrame.style = 'opacity: 1; filter: blur(0); transition: all 50ms linear;';
		}

		// compression is used for the cmi.suspend_data string as it is limited to 4096 characters

	}, {
		key: '_decompressSuspendData',
		value: function _decompressSuspendData(input) {
			return window.Base64.btou(window.RawDeflate.inflate(window.Base64.fromBase64(input)));
		}
	}, {
		key: '_compressSuspendData',
		value: function _compressSuspendData(input) {
			return window.Base64.toBase64(window.RawDeflate.deflate(window.Base64.utob(input)));
		}
	}, {
		key: '_getSuspendData',
		value: function _getSuspendData(suspendData) {
			if (suspendData) {
				return suspendData;
			} else {
				var rawSuspendData = this.lmsConnection ? this.SCORM_API.data.get('cmi.suspend_data') : window.CONF.LOCAL_STORAGE ? window.localStorage.getItem('cmi.suspend_data') : false;
				if (rawSuspendData) {
					var _suspendData = this._decompressSuspendData(rawSuspendData).split(window.CONF.SUSPEND_DATA_DELIMITER);
					var suspendDataDict = {
						bookmark: _suspendData[0],
						adaptData: JSON.parse(_suspendData[1]),
						customData: JSON.parse(_suspendData[2])

						// DEFAULT_DATA acts as a scheme for customData, updates have to be considered accordingly
					};Object.keys(window.CONF.DEFAULT_DATA['cmi.suspend_data'].customData).forEach(function (key) {
						if (!(key in suspendDataDict.customData)) {
							suspendDataDict.customData[key] = window.CONF.DEFAULT_DATA['cmi.suspend_data'].customData[key];
						}
					});

					return suspendDataDict;
				} else {
					return window.CONF.DEFAULT_DATA['cmi.suspend_data'];
				}
			}
		}
	}]);

	return App;
}();

export default App;