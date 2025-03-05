'use strict'

export class GlossaryDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showDropdown: false,
      searchQuery: '',
      searchTerms: [],
    };
    this.dropdownRef = React.createRef();
  }

  componentDidMount() {
    window.addEventListener("blur", this.handleWindowBlur);
  }

  componentWillUnmount() {
    window.removeEventListener("blur", this.handleWindowBlur);
  }

  handleWindowBlur = () => {
    this.setState({ showDropdown: false });
  };

  handleToggleDropdown = () => {
    this.setState((prevState) => ({
      showDropdown: !prevState.showDropdown,
    }));
  };

  handleHideDropdown = (event) => {
    if (!this.dropdownRef.current.contains(event.target)) {
      this.setState({ showDropdown: false });
    }
  };

  handleSearchInput = (event) => {
    const searchQuery = event.target.value;
    const searchTerms = searchQuery.split(/\s+/); // Split by whitespace
    this.setState({
      searchQuery,
      searchTerms,
    });
  };

  handleSearchSubmit = (event) => {
    event.preventDefault();
  };

	render() {
		const { showDropdown, searchQuery } = this.state;
		const { glossary } = this.props;

		return (
		  <div className="nav-item" ref={this.dropdownRef}>
			<div
			  id="navbarDropdown"
			  className="fa-solid fa-magnifying-glass fa-xl"
			  role="button"
			  aria-haspopup="true"
			  aria-expanded={showDropdown}
			  onClick={this.handleToggleDropdown}
			>
			</div>
			<ul
			  className={`dropdown-menu dropdown-menu-end ${showDropdown ? 'show' : ''}`}
			  aria-labelledby="navbarDropdown"
			  onClick={this.handleHideDropdown}
			>
			  <li className="search-form">
				<form onSubmit={this.handleSearchSubmit}>
				  <input
					type="text"
					className="form-control search-input"
					placeholder="z. B. computer software"
					aria-label="Search"
					value={searchQuery}
					onChange={this.handleSearchInput}
				  />
				</form>
			  </li>
			  {searchQuery && (
				<React.Fragment>
				  <li>
					<hr className="dropdown-divider" />
				  </li>
				  {(() => {
					const termMap = new Map();

					Object.entries(glossary).forEach(([term, { definition, taxonomy_ids }]) => {
					  const matchingTermsCount = this.state.searchTerms.filter(searchTerm => {
						const lowerTerm = term.toLowerCase();
						const lowerSearchTerm = searchTerm.toLowerCase();

						return (
						  lowerTerm.includes(lowerSearchTerm) &&
						  lowerSearchTerm.length >= 3 &&
						  lowerTerm.substring(
							lowerTerm.indexOf(lowerSearchTerm),
							lowerTerm.indexOf(lowerSearchTerm) + lowerSearchTerm.length
						  ).length >= 3
						);
					  }).length;

					  if (matchingTermsCount > 0) {
						const existingEntries = termMap.get(term) || { taxonomies: [], definition: '', matches: 0 };
						taxonomy_ids.forEach(({ taxonomy, _id }) => existingEntries.taxonomies.push({ taxonomy, _id }));
						existingEntries.definition = definition;
						existingEntries.matches = matchingTermsCount;
						termMap.set(term, existingEntries);
					  }
					});

					const listItems = Array.from(termMap)
					  .sort((a, b) => b[1].matches - a[1].matches || a[0].localeCompare(b[0]))
					  .map(([term, { taxonomies, definition }], index) => (
						<li className="glossary-term" key={index} data-term={term.toLowerCase().replace(/\s+/g, '-')}>
						  <a className="dropdown-item" href={`#${term.toLowerCase().replace(/\s+/g, '-')}`}>{term}</a>
						  <p className="glossary-definition">{definition}</p>
						  <p>
							{taxonomies.map(({ taxonomy, _id }, index) => (
							  <div key={_id}>
								<a href="#" onClick={() => window.App.launchSCO("M" + taxonomy.substring(0, 3), _id)}>{taxonomy}</a>
							  </div>
							))}
						  </p>
						</li>
					  ));

					return <ul>{listItems}</ul>;
				  })()}
				</React.Fragment>
			  )}
			</ul>
		  </div>
		);
	}
}

export class CoursePathway extends React.Component {
  handleCourseClick = (courseId) => {
    window.App.launchSCO(courseId);
  };
  
  render() {
    return (
		<div className="pathway-container">
		  {this.props.pathways.map((pathway) => (
			<div key={pathway.id} className="pathway">
			  <h5 className="pathway-title">{pathway.name}</h5>
			  <ul className="list-inline">
				{pathway.courses.map((courseId, idx) => {
				  var modAndCourse = courseId.split('.');
				  const course = this.props.SCOS[modAndCourse[0]]['courses'][modAndCourse[1]-1];
				  // Check if course data exists and is not disabled
				  console.log(course);
				  if (course && !course.disabled) {
					return (
					  <li
						key={courseId}
						className={`list-inline-item milestone ${
						  idx < pathway.courses.length - 1 ? 'milestone-with-line' : ''
						}`}
						onClick={() => this.handleCourseClick(courseId)}
					  >
						<div className={`milestone-icon ${window.App.calculateScore(courseId) > 0.99 ? 'completed' : ''}`}>
						  <i className="fa fa-flag text-secondary" aria-hidden="true"></i>
						</div>
						<div className="milestone-label">{courseId}</div>
					  </li>
					);
				  }
				  // Handle the case where the course is disabled or undefined
				  return (
					<li
					  key={courseId}
					  className={`list-inline-item milestone ${
						idx < pathway.courses.length - 1 ? 'milestone-with-line' : ''
					  } disabled deactivation`}
					>
					  <div className="milestone-icon disabled deactivation">
						<i className="fa fa-flag text-secondary deactivation" aria-hidden="true"></i>
					  </div>
						<div className="milestone-label deactivation text-muted">{courseId}</div>
					</li>
				  );
				})}
			  </ul>
			</div>
		  ))}
		</div>
    );
  }
}

function ProgressBar (score) {
  return <span className="progress mb-n1 mr-3 progress-custom">
    <span id="progressbar"
    className="progress-bar bg-success"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    style={{ width: `${score * 100}%` }}
    aria-valuenow={score * 100}>
    </span>
  </span>
}

export class XP extends React.Component {
  render () {
    return <span>
      {this.props.xp} XP
    </span>
  }
}

// Card Component (as before)
export function Card(props) {
  const { launchSCO, first, last, mod, scores, bookmark } = props;
  const { disabled, courses } = window.CONF.SCOS[mod];

  return (
    <div className={`card border-0 ${disabled ? 'deactivation' : ''}`} key={mod}>
      <div className="card-body p-2">
        {courses ? (
          <div className="mb-2 course-grid row">
            {courses.map(course => (
              <div
                key={course.id}
                className={`course col-sm ${(mod+'.'+course.id === bookmark) ? 'border border-success' : 'border-0'} ${course.disabled ? 'deactivation' : ''} ${course.disabled ? 'text-muted' : ''}`}
                onClick={() => course.disabled ? null : window.App.launchSCO(`${mod}.${course.id}`, '')}
              >
                <a className={`course-label text-muted`}>{`${course.id}. ${course.label}`}</a>
                <div className="pt-2">
                  {ProgressBar(scores[course.id], 'small')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="mt-2 mb-1 text-muted">{window.CONF.SCOS[mod].description}</p>
            <button className="btn btn-success px-3" onClick={() => window.App.launchSCO(`${mod}`)} disabled={disabled}>{window.CONF.SCOS[mod].callToAction}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// CollapsibleCard Component (as before)
export class CollapsibleCard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  toggleOpen = () => {
    this.setState({ isOpen: !this.state.isOpen });
  };

  render() {
    const { launchSCO, mod, scores, bookmark } = this.props;
    const { disabled, courses } = window.CONF.SCOS[mod];
    const { isOpen } = this.state;

    return (
      <div className={`collapsible-card ${disabled ? 'deactivation' : ''}`} key={mod}>
        <div className="card-header" onClick={this.toggleOpen}>
          <h6 className={`card-title font-weight-bold mb-0 ${courses ? '' : 'mt-0'}`}>
            <div style={{float: "left", width: "90%"}}>{window.CONF.SCOS[mod].label}
			{ProgressBar(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length, 'small')}</div>
			<div style={{float: "right", color: "darkgray"}}>{isOpen ? '▲' : '▼'}</div>
          </h6>
        </div>
        {isOpen && (
          <div className="card-body p-2">
            {courses ? (
              <div className="mb-2 course-grid row">
                {courses.map(course => (
                  <div
                    key={course.id}
                    className={`course ${(mod+'.'+course.id === bookmark) ? 'border border-success' : 'border-0'} ${course.disabled ? 'deactivation' : ''} ${course.disabled ? 'text-muted' : ''}`}
                    onClick={() => course.disabled ? null : window.App.launchSCO(`${mod}.${course.id}`, '')}
                  >
                    <a className={`course-label text-muted`}>{`${course.id}. ${course.label}`}</a>
                    <div className="pt-2" style={{width: "90%"}}>
                      {ProgressBar(scores[course.id], 'small')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="mt-2 mb-1 text-muted">{window.CONF.SCOS[mod].description}</p>
                <button className="btn btn-success px-3" onClick={() => window.App.launchSCO(`${mod}`)} disabled={disabled}>{window.CONF.SCOS[mod].callToAction}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export class CardGroup extends React.Component {
  render () {
    return <div className="card-group p-1">
      {
        (this.props.cardsMeta).map(
          (elem) => (elem.score >= window.CONF.SCOS[elem.mod].scoreToPass) ? '' : Card(elem))
      }
    </div>
  }
}

export class CourseStats extends React.Component {
  render () {
    return <span>
      <h5 id="card-text coursesStarted">{this.props.courseStats[0]} <small>begonnen</small></h5>
			<h5 id="card-text coursesComplete">{this.props.courseStats[1]} <small>abgeschlossen</small></h5>
    </span>
  }
}

export class ResultsComponent extends React.Component {
  componentDidMount() {
    this.aggregateScores();
  }

  componentDidUpdate(prevProps) {
    if (this.props.scorePerQuizBank !== prevProps.scorePerQuizBank) {
      this.aggregateScores();
    }
  }
  
  aggregateScores = () => {
    const { scorePerQuizBank } = this.props;
    const aggregatedModuleScores = {};
    const aggregatedDomainScores = {};

    // Aggregate scores by module and domain
    Object.entries(scorePerQuizBank).forEach(([id, scoreData]) => {
      const module = id.substring(0, 1); // Extract the first digit as module number
      const domain = id.substring(id.length - 1); // Extract the last digit as domain number

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

    this.generatePDF(aggregatedModuleScores, aggregatedDomainScores);
  }
  
  generatePDF = (aggregatedModuleScores, aggregatedDomainScores) => {
    const doc = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [595, 842] // A4 size in pixels at 72 DPI
    });

	// Helper function to load image and return Promise with image dimensions and scaling
	const loadImage = (imgData, desiredWidth) => {
		return new Promise((resolve, reject) => {
		  const img = new Image();
		  img.onload = () => {
			const aspectRatio = img.width / img.height;
			const height = desiredWidth / aspectRatio;
			resolve({ imgData, x: desiredWidth, y: height });
		  };
		  img.onerror = reject;
		  img.src = imgData;
		});
	};

    const domainNames = {
      '1': 'Verstehen',
      '2': 'Anwenden',
      '3': 'Bewerten'
    };
	
	let studentName = window.App.SCORM_API.data.get("cmi.core.student_name");

	if (studentName === null || studentName === "null" || studentName === "") {
		studentName = "Anonym";
	}
	
    const moduleLabels = {}; // To store the labels for modules
    Object.keys(aggregatedModuleScores).forEach(module => {
      moduleLabels[module] = window.CONF['SCOS'][`M${module}`].label;
    });
	
	const testName = this.props.scoId == 'M0' ? 'Einstiegstest' : 'Abschlusstest'
    doc.setFontSize(36);
    doc.text(`ComDigiS* ${testName}`, 50, 65);

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

    const startYModules = 240;
    const startYDomains = 550;
    const drawResults = (scores, type, startX, startY) => {
      const boxWidth = 155;
      const boxHeight = 80; // Increased height for additional text
      const columnGap = 15;
      const rowGap = 15;
      let currentX = startX;
      let currentY = startY;
      let column = 1;

      doc.setFontSize(14);
      Object.entries(scores).forEach(([key, data], index) => {
        const percentageScore = ((data.score / data.maxScore) * 100).toFixed(1) + '%';
        const label = type === 'Domäne' ? domainNames[key] : `Modul ${key}`;

        // Draw box for module or domain
        doc.rect(currentX, currentY, boxWidth, boxHeight);
        doc.text(label, currentX + 10, currentY + 20);
        if (type !== 'Domäne') { // Module labels go below the module number
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
	Promise.all([
		loadImage("img/digitaks-logo.png", 100),
		loadImage("img/dtecbw-logo.png", 100),
		loadImage("img/wetek-logo.png", 100),
		loadImage("img/infai-logo.png", 100)
	]).then(images => {
		// All images loaded, now add them to the PDF
		doc.addImage(images[0].imgData, 'PNG', 480, 20, images[0].x, images[0].y);  // Top right corner
		doc.addImage(images[1].imgData, 'PNG', 480, 780, images[1].x, images[1].y); // Bottom right corner
		doc.addImage(images[2].imgData, 'PNG', 20, 780, images[2].x, images[2].y);  // Bottom left corner
		doc.addImage(images[3].imgData, 'PNG', 130, 777, images[3].x, images[3].y); // Next to the first organisation logo

		// Save the PDF after all images have been added
		doc.save('assessment-results.pdf');
	}).catch(error => {
		console.error('Failed to load images', error);
	});
  }

  render() {
    return (
      <div>
        <h3>Ihr Ergebnisbericht wird gerade erstellt...</h3>
        <p>Sie finden den Bericht als PDF in Ihrem Download-Ordner.</p>
      </div>
    );
  }
}

/* Object.entries(this.props.moduleScores).map(
        (moduleScore) => this.Card({ module: moduleScore[0], score: moduleScore[1] })
      ) */
