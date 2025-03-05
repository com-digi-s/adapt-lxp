'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

export var GlossaryDropdown = function (_React$Component) {
  _inherits(GlossaryDropdown, _React$Component);

  function GlossaryDropdown(props) {
    _classCallCheck(this, GlossaryDropdown);

    var _this = _possibleConstructorReturn(this, (GlossaryDropdown.__proto__ || Object.getPrototypeOf(GlossaryDropdown)).call(this, props));

    _this.handleWindowBlur = function () {
      _this.setState({ showDropdown: false });
    };

    _this.handleToggleDropdown = function () {
      _this.setState(function (prevState) {
        return {
          showDropdown: !prevState.showDropdown
        };
      });
    };

    _this.handleHideDropdown = function (event) {
      if (!_this.dropdownRef.current.contains(event.target)) {
        _this.setState({ showDropdown: false });
      }
    };

    _this.handleSearchInput = function (event) {
      var searchQuery = event.target.value;
      var searchTerms = searchQuery.split(/\s+/); // Split by whitespace
      _this.setState({
        searchQuery: searchQuery,
        searchTerms: searchTerms
      });
    };

    _this.handleSearchSubmit = function (event) {
      event.preventDefault();
    };

    _this.state = {
      showDropdown: false,
      searchQuery: '',
      searchTerms: []
    };
    _this.dropdownRef = React.createRef();
    return _this;
  }

  _createClass(GlossaryDropdown, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      window.addEventListener("blur", this.handleWindowBlur);
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      window.removeEventListener("blur", this.handleWindowBlur);
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _state = this.state,
          showDropdown = _state.showDropdown,
          searchQuery = _state.searchQuery;
      var glossary = this.props.glossary;


      return React.createElement(
        'div',
        { className: 'nav-item', ref: this.dropdownRef },
        React.createElement('div', {
          id: 'navbarDropdown',
          className: 'fa-solid fa-magnifying-glass fa-xl',
          role: 'button',
          'aria-haspopup': 'true',
          'aria-expanded': showDropdown,
          onClick: this.handleToggleDropdown
        }),
        React.createElement(
          'ul',
          {
            className: 'dropdown-menu dropdown-menu-end ' + (showDropdown ? 'show' : ''),
            'aria-labelledby': 'navbarDropdown',
            onClick: this.handleHideDropdown
          },
          React.createElement(
            'li',
            { className: 'search-form' },
            React.createElement(
              'form',
              { onSubmit: this.handleSearchSubmit },
              React.createElement('input', {
                type: 'text',
                className: 'form-control search-input',
                placeholder: 'z. B. computer software',
                'aria-label': 'Search',
                value: searchQuery,
                onChange: this.handleSearchInput
              })
            )
          ),
          searchQuery && React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'li',
              null,
              React.createElement('hr', { className: 'dropdown-divider' })
            ),
            function () {
              var termMap = new Map();

              Object.entries(glossary).forEach(function (_ref) {
                var _ref2 = _slicedToArray(_ref, 2),
                    term = _ref2[0],
                    _ref2$ = _ref2[1],
                    definition = _ref2$.definition,
                    taxonomy_ids = _ref2$.taxonomy_ids;

                var matchingTermsCount = _this2.state.searchTerms.filter(function (searchTerm) {
                  var lowerTerm = term.toLowerCase();
                  var lowerSearchTerm = searchTerm.toLowerCase();

                  return lowerTerm.includes(lowerSearchTerm) && lowerSearchTerm.length >= 3 && lowerTerm.substring(lowerTerm.indexOf(lowerSearchTerm), lowerTerm.indexOf(lowerSearchTerm) + lowerSearchTerm.length).length >= 3;
                }).length;

                if (matchingTermsCount > 0) {
                  var existingEntries = termMap.get(term) || { taxonomies: [], definition: '', matches: 0 };
                  taxonomy_ids.forEach(function (_ref3) {
                    var taxonomy = _ref3.taxonomy,
                        _id = _ref3._id;
                    return existingEntries.taxonomies.push({ taxonomy: taxonomy, _id: _id });
                  });
                  existingEntries.definition = definition;
                  existingEntries.matches = matchingTermsCount;
                  termMap.set(term, existingEntries);
                }
              });

              var listItems = Array.from(termMap).sort(function (a, b) {
                return b[1].matches - a[1].matches || a[0].localeCompare(b[0]);
              }).map(function (_ref4, index) {
                var _ref5 = _slicedToArray(_ref4, 2),
                    term = _ref5[0],
                    _ref5$ = _ref5[1],
                    taxonomies = _ref5$.taxonomies,
                    definition = _ref5$.definition;

                return React.createElement(
                  'li',
                  { className: 'glossary-term', key: index, 'data-term': term.toLowerCase().replace(/\s+/g, '-') },
                  React.createElement(
                    'a',
                    { className: 'dropdown-item', href: '#' + term.toLowerCase().replace(/\s+/g, '-') },
                    term
                  ),
                  React.createElement(
                    'p',
                    { className: 'glossary-definition' },
                    definition
                  ),
                  React.createElement(
                    'p',
                    null,
                    taxonomies.map(function (_ref6, index) {
                      var taxonomy = _ref6.taxonomy,
                          _id = _ref6._id;
                      return React.createElement(
                        'div',
                        { key: _id },
                        React.createElement(
                          'a',
                          { href: '#', onClick: function onClick() {
                              return window.App.launchSCO("M" + taxonomy.substring(0, 3), _id);
                            } },
                          taxonomy
                        )
                      );
                    })
                  )
                );
              });

              return React.createElement(
                'ul',
                null,
                listItems
              );
            }()
          )
        )
      );
    }
  }]);

  return GlossaryDropdown;
}(React.Component);

export var CoursePathway = function (_React$Component2) {
  _inherits(CoursePathway, _React$Component2);

  function CoursePathway() {
    var _ref7;

    var _temp, _this3, _ret;

    _classCallCheck(this, CoursePathway);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this3 = _possibleConstructorReturn(this, (_ref7 = CoursePathway.__proto__ || Object.getPrototypeOf(CoursePathway)).call.apply(_ref7, [this].concat(args))), _this3), _this3.handleCourseClick = function (courseId) {
      window.App.launchSCO(courseId);
    }, _temp), _possibleConstructorReturn(_this3, _ret);
  }

  _createClass(CoursePathway, [{
    key: 'render',
    value: function render() {
      var _this4 = this;

      return React.createElement(
        'div',
        { className: 'pathway-container' },
        this.props.pathways.map(function (pathway) {
          return React.createElement(
            'div',
            { key: pathway.id, className: 'pathway' },
            React.createElement(
              'h5',
              { className: 'pathway-title' },
              pathway.name
            ),
            React.createElement(
              'ul',
              { className: 'list-inline' },
              pathway.courses.map(function (courseId, idx) {
                var modAndCourse = courseId.split('.');
                var course = _this4.props.SCOS[modAndCourse[0]]['courses'][modAndCourse[1] - 1];
                // Check if course data exists and is not disabled
                console.log(course);
                if (course && !course.disabled) {
                  return React.createElement(
                    'li',
                    {
                      key: courseId,
                      className: 'list-inline-item milestone ' + (idx < pathway.courses.length - 1 ? 'milestone-with-line' : ''),
                      onClick: function onClick() {
                        return _this4.handleCourseClick(courseId);
                      }
                    },
                    React.createElement(
                      'div',
                      { className: 'milestone-icon ' + (window.App.calculateScore(courseId) > 0.99 ? 'completed' : '') },
                      React.createElement('i', { className: 'fa fa-flag text-secondary', 'aria-hidden': 'true' })
                    ),
                    React.createElement(
                      'div',
                      { className: 'milestone-label' },
                      courseId
                    )
                  );
                }
                // Handle the case where the course is disabled or undefined
                return React.createElement(
                  'li',
                  {
                    key: courseId,
                    className: 'list-inline-item milestone ' + (idx < pathway.courses.length - 1 ? 'milestone-with-line' : '') + ' disabled deactivation'
                  },
                  React.createElement(
                    'div',
                    { className: 'milestone-icon disabled deactivation' },
                    React.createElement('i', { className: 'fa fa-flag text-secondary deactivation', 'aria-hidden': 'true' })
                  ),
                  React.createElement(
                    'div',
                    { className: 'milestone-label deactivation text-muted' },
                    courseId
                  )
                );
              })
            )
          );
        })
      );
    }
  }]);

  return CoursePathway;
}(React.Component);

function ProgressBar(score) {
  return React.createElement(
    'span',
    { className: 'progress mb-n1 mr-3 progress-custom' },
    React.createElement('span', { id: 'progressbar',
      className: 'progress-bar bg-success',
      role: 'progressbar',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      style: { width: score * 100 + '%' },
      'aria-valuenow': score * 100 })
  );
}

export var XP = function (_React$Component3) {
  _inherits(XP, _React$Component3);

  function XP() {
    _classCallCheck(this, XP);

    return _possibleConstructorReturn(this, (XP.__proto__ || Object.getPrototypeOf(XP)).apply(this, arguments));
  }

  _createClass(XP, [{
    key: 'render',
    value: function render() {
      return React.createElement(
        'span',
        null,
        this.props.xp,
        ' XP'
      );
    }
  }]);

  return XP;
}(React.Component);

// Card Component (as before)
export function Card(props) {
  var launchSCO = props.launchSCO,
      first = props.first,
      last = props.last,
      mod = props.mod,
      scores = props.scores,
      bookmark = props.bookmark;
  var _window$CONF$SCOS$mod = window.CONF.SCOS[mod],
      disabled = _window$CONF$SCOS$mod.disabled,
      courses = _window$CONF$SCOS$mod.courses;


  return React.createElement(
    'div',
    { className: 'card border-0 ' + (disabled ? 'deactivation' : ''), key: mod },
    React.createElement(
      'div',
      { className: 'card-body p-2' },
      courses ? React.createElement(
        'div',
        { className: 'mb-2 course-grid row' },
        courses.map(function (course) {
          return React.createElement(
            'div',
            {
              key: course.id,
              className: 'course col-sm ' + (mod + '.' + course.id === bookmark ? 'border border-success' : 'border-0') + ' ' + (course.disabled ? 'deactivation' : '') + ' ' + (course.disabled ? 'text-muted' : ''),
              onClick: function onClick() {
                return course.disabled ? null : window.App.launchSCO(mod + '.' + course.id, '');
              }
            },
            React.createElement(
              'a',
              { className: 'course-label text-muted' },
              course.id + '. ' + course.label
            ),
            React.createElement(
              'div',
              { className: 'pt-2' },
              ProgressBar(scores[course.id], 'small')
            )
          );
        })
      ) : React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'mt-2 mb-1 text-muted' },
          window.CONF.SCOS[mod].description
        ),
        React.createElement(
          'button',
          { className: 'btn btn-success px-3', onClick: function onClick() {
              return window.App.launchSCO('' + mod);
            }, disabled: disabled },
          window.CONF.SCOS[mod].callToAction
        )
      )
    )
  );
}

// CollapsibleCard Component (as before)
export var CollapsibleCard = function (_React$Component4) {
  _inherits(CollapsibleCard, _React$Component4);

  function CollapsibleCard(props) {
    _classCallCheck(this, CollapsibleCard);

    var _this6 = _possibleConstructorReturn(this, (CollapsibleCard.__proto__ || Object.getPrototypeOf(CollapsibleCard)).call(this, props));

    _this6.toggleOpen = function () {
      _this6.setState({ isOpen: !_this6.state.isOpen });
    };

    _this6.state = {
      isOpen: false
    };
    return _this6;
  }

  _createClass(CollapsibleCard, [{
    key: 'render',
    value: function render() {
      var _props = this.props,
          launchSCO = _props.launchSCO,
          mod = _props.mod,
          scores = _props.scores,
          bookmark = _props.bookmark;
      var _window$CONF$SCOS$mod2 = window.CONF.SCOS[mod],
          disabled = _window$CONF$SCOS$mod2.disabled,
          courses = _window$CONF$SCOS$mod2.courses;
      var isOpen = this.state.isOpen;


      return React.createElement(
        'div',
        { className: 'collapsible-card ' + (disabled ? 'deactivation' : ''), key: mod },
        React.createElement(
          'div',
          { className: 'card-header', onClick: this.toggleOpen },
          React.createElement(
            'h6',
            { className: 'card-title font-weight-bold mb-0 ' + (courses ? '' : 'mt-0') },
            React.createElement(
              'div',
              { style: { float: "left", width: "90%" } },
              window.CONF.SCOS[mod].label,
              ProgressBar(Object.values(scores).reduce(function (a, b) {
                return a + b;
              }, 0) / Object.values(scores).length, 'small')
            ),
            React.createElement(
              'div',
              { style: { float: "right", color: "darkgray" } },
              isOpen ? '▲' : '▼'
            )
          )
        ),
        isOpen && React.createElement(
          'div',
          { className: 'card-body p-2' },
          courses ? React.createElement(
            'div',
            { className: 'mb-2 course-grid row' },
            courses.map(function (course) {
              return React.createElement(
                'div',
                {
                  key: course.id,
                  className: 'course ' + (mod + '.' + course.id === bookmark ? 'border border-success' : 'border-0') + ' ' + (course.disabled ? 'deactivation' : '') + ' ' + (course.disabled ? 'text-muted' : ''),
                  onClick: function onClick() {
                    return course.disabled ? null : window.App.launchSCO(mod + '.' + course.id, '');
                  }
                },
                React.createElement(
                  'a',
                  { className: 'course-label text-muted' },
                  course.id + '. ' + course.label
                ),
                React.createElement(
                  'div',
                  { className: 'pt-2', style: { width: "90%" } },
                  ProgressBar(scores[course.id], 'small')
                )
              );
            })
          ) : React.createElement(
            'div',
            null,
            React.createElement(
              'p',
              { className: 'mt-2 mb-1 text-muted' },
              window.CONF.SCOS[mod].description
            ),
            React.createElement(
              'button',
              { className: 'btn btn-success px-3', onClick: function onClick() {
                  return window.App.launchSCO('' + mod);
                }, disabled: disabled },
              window.CONF.SCOS[mod].callToAction
            )
          )
        )
      );
    }
  }]);

  return CollapsibleCard;
}(React.Component);

export var CardGroup = function (_React$Component5) {
  _inherits(CardGroup, _React$Component5);

  function CardGroup() {
    _classCallCheck(this, CardGroup);

    return _possibleConstructorReturn(this, (CardGroup.__proto__ || Object.getPrototypeOf(CardGroup)).apply(this, arguments));
  }

  _createClass(CardGroup, [{
    key: 'render',
    value: function render() {
      return React.createElement(
        'div',
        { className: 'card-group p-1' },
        this.props.cardsMeta.map(function (elem) {
          return elem.score >= window.CONF.SCOS[elem.mod].scoreToPass ? '' : Card(elem);
        })
      );
    }
  }]);

  return CardGroup;
}(React.Component);

export var CourseStats = function (_React$Component6) {
  _inherits(CourseStats, _React$Component6);

  function CourseStats() {
    _classCallCheck(this, CourseStats);

    return _possibleConstructorReturn(this, (CourseStats.__proto__ || Object.getPrototypeOf(CourseStats)).apply(this, arguments));
  }

  _createClass(CourseStats, [{
    key: 'render',
    value: function render() {
      return React.createElement(
        'span',
        null,
        React.createElement(
          'h5',
          { id: 'card-text coursesStarted' },
          this.props.courseStats[0],
          ' ',
          React.createElement(
            'small',
            null,
            'begonnen'
          )
        ),
        React.createElement(
          'h5',
          { id: 'card-text coursesComplete' },
          this.props.courseStats[1],
          ' ',
          React.createElement(
            'small',
            null,
            'abgeschlossen'
          )
        )
      );
    }
  }]);

  return CourseStats;
}(React.Component);

export var ResultsComponent = function (_React$Component7) {
  _inherits(ResultsComponent, _React$Component7);

  function ResultsComponent() {
    var _ref8;

    var _temp2, _this9, _ret2;

    _classCallCheck(this, ResultsComponent);

    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return _ret2 = (_temp2 = (_this9 = _possibleConstructorReturn(this, (_ref8 = ResultsComponent.__proto__ || Object.getPrototypeOf(ResultsComponent)).call.apply(_ref8, [this].concat(args))), _this9), _this9.aggregateScores = function () {
      var scorePerQuizBank = _this9.props.scorePerQuizBank;

      var aggregatedModuleScores = {};
      var aggregatedDomainScores = {};

      // Aggregate scores by module and domain
      Object.entries(scorePerQuizBank).forEach(function (_ref9) {
        var _ref10 = _slicedToArray(_ref9, 2),
            id = _ref10[0],
            scoreData = _ref10[1];

        var module = id.substring(0, 1); // Extract the first digit as module number
        var domain = id.substring(id.length - 1); // Extract the last digit as domain number

        // Aggregate module scores
        if (!aggregatedModuleScores[module]) {
          aggregatedModuleScores[module] = { score: 0, maxScore: 0 };
        }
        aggregatedModuleScores[module].score += scoreData.score;
        aggregatedModuleScores[module].maxScore += scoreData.maxScore;

        // Aggregate domain scores
        if (!aggregatedDomainScores[domain]) {
          aggregatedDomainScores[domain] = { score: 0, maxScore: 0 };
        }
        aggregatedDomainScores[domain].score += scoreData.score;
        aggregatedDomainScores[domain].maxScore += scoreData.maxScore;
      });

      _this9.generatePDF(aggregatedModuleScores, aggregatedDomainScores);
    }, _this9.generatePDF = function (aggregatedModuleScores, aggregatedDomainScores) {
      var doc = new window.jspdf.jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [595, 842] // A4 size in pixels at 72 DPI
      });

      // Helper function to load image and return Promise with image dimensions and scaling
      var loadImage = function loadImage(imgData, desiredWidth) {
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () {
            var aspectRatio = img.width / img.height;
            var height = desiredWidth / aspectRatio;
            resolve({ imgData: imgData, x: desiredWidth, y: height });
          };
          img.onerror = reject;
          img.src = imgData;
        });
      };

      var domainNames = {
        '1': 'Verstehen',
        '2': 'Anwenden',
        '3': 'Bewerten'
      };

      var studentName = window.App.SCORM_API.data.get("cmi.core.student_name");

      if (studentName === null || studentName === "null" || studentName === "") {
        studentName = "Anonym";
      }

      var moduleLabels = {}; // To store the labels for modules
      Object.keys(aggregatedModuleScores).forEach(function (module) {
        moduleLabels[module] = window.CONF['SCOS']['M' + module].label;
      });

      var testName = _this9.props.scoId == 'M0' ? 'Einstiegstest' : 'Abschlusstest';
      doc.setFontSize(36);
      doc.text('ComDigiS* ' + testName, 50, 65);

      doc.setFontSize(26);
      doc.text(studentName, 50, 100);

      doc.setFontSize(16);
      doc.text('Module', 50, 140);

      // Descriptions for modules and domains
      doc.setFontSize(12);
      doc.text('ComDigiS* orientiert sich am Kompetenzrahmen DigComp 2.2 der Europäischen Kommission und ist hierarchisch aufgebaut:', 50, 160);
      doc.text('1. In fünf Modulen werden verschiedene Handlungs- und Wissensfelder abgedeckt.', 50, 175);
      doc.text('2. Die Module beinhalten Kurse, von denen jeder eine spezifische Kompetenz behandelt.', 50, 190);
      doc.text('3. Die Lerneinheiten innerhalb der Kurse beleuchten einen spezifischen Aspekt der Kompetenz im Detail.', 50, 205);
      // doc.text('Die Module beinhalten Kurse, von denen jeder eine spezifische Kompetenz behandelt.', 50, 220);
      // doc.text('', 50, 235);

      doc.setFontSize(16);
      doc.text('Domänen', 50, 450);

      doc.setFontSize(12);
      doc.text("ComDigiS* implementiert in Anlehnung an die Bloom'sche Lernzieltaxonomie drei kognitiven Domänen:", 50, 470);
      doc.text('1. Verstehen – Vermittlung eines soliden Grundverständnisses digitaler Kompetenzen.', 50, 485);
      doc.text('2. Anwenden – Anwendung von Werkzeugen und Integration digitaler Technologien.', 50, 500);
      doc.text('3. Bewerten – Kritische Reflexion und Bewertung digitaler Technologien.', 50, 515);

      var startYModules = 240;
      var startYDomains = 550;
      var drawResults = function drawResults(scores, type, startX, startY) {
        var boxWidth = 155;
        var boxHeight = 80; // Increased height for additional text
        var columnGap = 15;
        var rowGap = 15;
        var currentX = startX;
        var currentY = startY;
        var column = 1;

        doc.setFontSize(14);
        Object.entries(scores).forEach(function (_ref11, index) {
          var _ref12 = _slicedToArray(_ref11, 2),
              key = _ref12[0],
              data = _ref12[1];

          var percentageScore = (data.score / data.maxScore * 100).toFixed(1) + '%';
          var label = type === 'Domäne' ? domainNames[key] : 'Modul ' + key;

          // Draw box for module or domain
          doc.rect(currentX, currentY, boxWidth, boxHeight);
          doc.text(label, currentX + 10, currentY + 20);
          if (type !== 'Domäne') {
            // Module labels go below the module number
            doc.setFontSize(12);
            doc.text(moduleLabels[key], currentX + 10, currentY + 40);
            doc.setFontSize(14);
          }
          doc.text(percentageScore, currentX + boxWidth - 40, currentY + 60); // Aligned to the right

          if (column % 3 === 0) {
            currentX = startX; // Reset to first column
            currentY += boxHeight + rowGap;
          } else {
            currentX += boxWidth + columnGap; // Move to next column
          }
          column++;
        });
      };

      // Draw module results
      drawResults(aggregatedModuleScores, 'Modul', 50, startYModules);
      // Draw domain results
      drawResults(aggregatedDomainScores, 'Domäne', 50, startYDomains);

      doc.setFontSize(10);
      doc.text('ComDigiS* ist eine Selbstlernanwendung für digitale Kompetenzen.', 50, 700);
      doc.text('Sie wurde im Rahmen des Verbundprojekts DigiTaKS* - Digitale Schlüsselkompetenzen für Studium und Beruf entwickelt.', 50, 710);
      doc.text('Die Module und Kurse von ComDigiS* orientieren sich am Kompetenzmodell DigComp 2.2 der Europäischen Kommission.', 50, 720);

      // Load all images asynchronously
      Promise.all([loadImage("img/digitaks-logo.png", 100), loadImage("img/dtecbw-logo.png", 100), loadImage("img/wetek-logo.png", 100), loadImage("img/infai-logo.png", 100)]).then(function (images) {
        // All images loaded, now add them to the PDF
        doc.addImage(images[0].imgData, 'PNG', 480, 20, images[0].x, images[0].y); // Top right corner
        doc.addImage(images[1].imgData, 'PNG', 480, 780, images[1].x, images[1].y); // Bottom right corner
        doc.addImage(images[2].imgData, 'PNG', 20, 780, images[2].x, images[2].y); // Bottom left corner
        doc.addImage(images[3].imgData, 'PNG', 130, 777, images[3].x, images[3].y); // Next to the first organisation logo

        // Save the PDF after all images have been added
        doc.save('assessment-results.pdf');
      }).catch(function (error) {
        console.error('Failed to load images', error);
      });
    }, _temp2), _possibleConstructorReturn(_this9, _ret2);
  }

  _createClass(ResultsComponent, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.aggregateScores();
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps) {
      if (this.props.scorePerQuizBank !== prevProps.scorePerQuizBank) {
        this.aggregateScores();
      }
    }
  }, {
    key: 'render',
    value: function render() {
      return React.createElement(
        'div',
        null,
        React.createElement(
          'h3',
          null,
          'Ihr Ergebnisbericht wird gerade erstellt...'
        ),
        React.createElement(
          'p',
          null,
          'Sie finden den Bericht als PDF in Ihrem Download-Ordner.'
        )
      );
    }
  }]);

  return ResultsComponent;
}(React.Component);

/* Object.entries(this.props.moduleScores).map(
        (moduleScore) => this.Card({ module: moduleScore[0], score: moduleScore[1] })
      ) */