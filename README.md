# Overview

## Shared multi-framework product runtime (opt-in)

The exporter selects the new runtime explicitly with
`config.MULTI_FRAMEWORK_CONTRACT = "lxp-contract.json"`. That file must be a
production `adapt-lxp-multi-framework@1` contract (`exampleOnly: false`). Missing,
unsupported or inconsistent contracts stop with a visible error; they never
fall back to the legacy course catalogue. Packages without this property retain
the existing legacy runtime.

One wrapper presents framework cards, framework-specific courses, diagnostics,
results/PDF/JSON reports, configured domain radar, pathways and glossary links.
All relationships use explicit IDs. Each course runs below an API-bearing host
frame with its own immutable launch context. This preserves a genuine outer LMS
API and keeps late child unload calls bound to their original course/attempt.
Native bootstraps can continue calling
`parent.App.attachAdaptPersistence(Adapt, window)`. `App.SCO_FRAME` is the actual
course iframe, not its bridge host.

Completion requires **every required learning course across all frameworks**,
with at least one required course. Tests and optional courses are not denominator
terms. The outer LMS gets incomplete/completed, never a fabricated score100 or
cross-framework competency score. Missing diagnostics have no invented score.

State v1 carries package/revision, explicit per-framework bookmarks, opaque native
SCO payloads, component fingerprints and test/attempt identities. Local keys are
scoped to package/schema/profile/attempt; optional `LOCAL_PROFILE_ID` and
`LOCAL_ATTEMPT_ID` select explicit local contexts. The default shared-device
profile is not multi-user protection. Old global `cmi.*` localStorage values are
never imported. The dashboard offers a guarded migration of a proven old package
envelope plus explicit, confirmed alias/fingerprint plan. It preserves a backup,
rejects alias collisions and does not repeat an applied migration.

Regular relevant changes save immediately, with idempotent outer finalization.
A real SCORM1.2 API must accept and return the exact compressed suspend payload;
failed initialization/read/write/commit/readback is visible. The conservative
4096-character budget rejects remote writes without truncation and preserves a
downloadable local/in-memory backup. Explicit local use can store larger state
while visibly withholding LMS release; local success is never reported as remote
success. No target-LMS conformance is claimed by the local or API-harness tests.

Run `npm run build:multi` to publish byte-identical new runtime modules/CSS and
regenerate `adapt-multi-framework-capabilities.json` with hashes of the actual
delivered implementation, then `npm test`. The opt-in build deliberately leaves
existing legacy JSX/transpiled files intact. The old `build` script is a legacy
watch command; it is not the new runtime build. Exporters must validate the
capability values **and** all declared implementation hashes before freezing a
wrapper. Do not add the marker to an old, unimplemented wrapper.

`Adapt LXP` is an application template designed to integrate SCORM 1.2-based courses, that were developed using the [Adapt Framework](https://github.com/adaptlearning/adapt_framework), into a feature-rich Learning Experience Platform (LXP). The platform facilitates the encapsulation of Sharable Content Objects (SCOs) and augments them with LXP features.

### Use Cases and Demos

[ComDigiS*](https://lxp.creativeartefact.org/) is part of the joint project DigiTaKS*, which is being realised in cooperation with the Helmut Schmidt University, University of the Federal Armed Forces Hamburg.

### Key Features

- **API Integration**: Seamlessly integrates with SCORM 1.2 APIs of individual SCOs. The app acts as a mediator that invokes the core SCORM API based on input parameters, ensuring smooth communication between SCOs and the central LXP system.
  
- **Future Compatibility**: Plans to extend support to newer learning standards and APIs like xAPI and cmi5 are in place, following the same integration principles.

- **Flexibility**: The app can be used either as a standalone application (with data logged in the browser's localStorage) or integrated with an LMS (Learning Management System).

### Development and Testing

- **Code Standards**: JavaScript code should be written in accordance with GitHub's standard guidelines and linted according to ES6 standards.
  
- **Development Environment**: JavaScript files should reside in the top-level directory, while non-JS files should be stored in the `dist` directory.

- **Transpilation**: The application uses Babel to convert ES6+ JavaScript to ES5 for wider compatibility across different browsers. The command to transpile code is:
  
  ```
  npx babel --watch . --out-dir ./dist --presets react-app/prod --ignore .cache,.eslintrc.js,dist,libraries,node_modules,scos --verbose
  ```

- **Local Testing**: For local testing, use a simple web server, like Python's `http.server`, to serve the app from the `dist` directory:
  
  ```
  python -m http.server [port]
  ```

- **Data Storage**: When there is no LMS-API available, the app will store user data in the browser’s localStorage.

- **Accessing Content**: The main SCO can be accessed locally by visiting the URL:
  
  ```
  http://localhost:[port]/index.html
  ```

### Packaging and Deployment

- **LMS Integration**: Adapt LXP can be easily deployed to any SCORM 1.2-compatible LMS, facilitating a smooth rollout to users.

### **Architecture**:

1. **Modularization**: The app is designed with a modular structure, separating different concerns into distinct files:
   - **`app.js`**: Implements the `App` class for managing application state and interactions. It initializes the SCORM API and keeps a single instance throughout the app lifecycle.
   - **`adaptHelpers.js`**: Provides utility functions for adapting data.
   - **`utils.js`**: Provides utilities like `timeIntToString` for time formatting.
   - **`components.js`**: Houses React components (e.g. `GlossaryDropdown`).
   - **`charts.js`**: Contains charting logic like `pulseChart` and `radarChart`.
2. **Observer Pattern**: Used in the `launchSCO` method for dynamically monitoring changes in the `iframe` (e.g., for detecting keypresses and DOM changes). The `MutationObserver` listens for DOM mutations and adds event listeners only when necessary.
3. **Template Pattern**: The app uses a template pattern in the form of dynamic rendering. The templates (like `template_glossary`, `template_xp`, etc.) manage how different sections of the application are dynamically rendered with React.

### **Main Functionalities**:

1. **SCORM Interaction**: The app interacts with the SCORM API to manage course states, such as session times, bookmarks, and scores. The `SCORM_API.set` and `SCORM_API.get` methods handle reading and writing SCORM data.
2. **XP Calculation**: The app includes an XP calculation system, which is rendered in the `XP` component, calculating the learner's experience points based on their progress.
3. **Custom Interaction Tracking**: The `setCustomInteraction` method logs user interactions, which is useful for tracking choices and actions made within the LXP (outside the scope of the Adapt Framework).
4. **Event Listeners**: The app adds custom event listeners to UI elements (e.g., buttons for navigating through modules), using a helper function `addEventListenersToElements`.
5. **Dynamic Rendering**: React is used for rendering dynamic content. For instance, the `template_xp` and `template_glossary` templates render React components based on current data.

### **Session and State Management**:

- **SCORM Suspend Data**: The app heavily relies on `cmi.suspend_data` for saving progress. It checks and updates the bookmark and learning experience data.
- **Local Storage Fallback**: If the app is offline, it uses `localStorage` to store the progress.
  
### **Flow & User Interaction**:

- **SCO Launch**: The `launchSCO` method loads specific modules (SCOs) into an iframe. Event listeners are dynamically added to track user interactions with elements inside the iframe, especially for keyboard navigation (e.g., arrow keys for tab navigation).

  Packaging tools should copy the selected SCO resource's `href` from its
  `imsmanifest.xml` into that course's optional `launchFile` configuration, for
  example `{ "id": "1", "launchFile": "index_lms.html" }`. A direct module
  without a `courses` array can also define `launchFile`. Only package-relative
  paths are accepted. Older catalogues without the field retain `index.html`.
  This distinction matters: an Adapt SCORM build's `index.html` may intentionally
  start a non-persistent offline API, whereas its manifest's `index_lms.html`
  discovers the parent LMS/LXP API. Do not rewrite the standalone entry to hide
  an incorrect LMS launch path. Local persistence tests do not establish LMS
  conformance.
- **Completion Tracking**: The app tracks module completion through `isCompleted` and `calculateScore` methods, checking whether a module or course has met the required thresholds.
  
### **Other Dependencies/External Libraries**:

- **SCORM API (`pipwerks.SCORM`)**: Manages communication with the LMS.
- **React and ReactDOM**: For dynamic rendering of components.
- **jQuery**: Used for DOM manipulation and utilities.

### Funding

The research and development project „Digitale Schlüsselkompetenzen für Studium und Beruf (DigiTaKS*) – Entwicklung eines Modells zur transformativen digitalen Kompetenzentwicklung Studierender” (Digital key competences for study and work – development of a model for transformative digital competence advancement for students) started in January 2021 and runs through 2026 in two project phases. It is funded by dtec.bw and part of the research cluster OPAL. More information on the first project phase from 2021-2024 can be found here and on the dtec.bw infopage.
