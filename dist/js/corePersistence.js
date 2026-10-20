// Local LXP persistence for genuine Adapt Core models when no Spoor extension
// is present. This is not an LMS conformance claim and does not grade answers.
var BOOLEAN_KEYS = ['_isComplete', '_isInteractionComplete', '_isVisited', '_isSubmitted', '_isCorrect'];
var NUMBER_KEYS = ['_score', '_attemptsLeft'];
var ACTIVE_TYPES = ['mcq', 'gmcq', 'matching'];
function answerValue(value) {
  return value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isFinite(value) || Array.isArray(value) && value.every(answerValue);
}
export function allowedAttemptState(value) {
  var result = {};
  BOOLEAN_KEYS.forEach(function (key) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  });
  NUMBER_KEYS.forEach(function (key) {
    if (Number.isFinite(value[key])) result[key] = value[key];
  });
  if (answerValue(value._userAnswer)) result._userAnswer = JSON.parse(JSON.stringify(value._userAnswer));
  return result;
}
function fingerprint(model) {
  var fields = ['_component', 'title', 'body', '_questionWeight', '_selectable', '_correctAnswer', '_correctRange', '_answers'];
  var config = {};
  fields.forEach(function (key) {
    config[key] = model.get(key);
  });
  config.items = (model.get('_items') || []).map(function (item) {
    return {
      text: item.text,
      _shouldBeSelected: item._shouldBeSelected,
      _answers: item._answers,
      answers: item.answers,
      _options: (item._options || []).map(function (option) {
        return {
          text: option.text,
          _isCorrect: option._isCorrect
        };
      })
    };
  });
  var text = JSON.stringify(config);
  var hash = 2166136261;
  for (var index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}
function children(model) {
  var collection = typeof model.getChildren === 'function' && model.getChildren();
  return collection && collection.models ? collection.models : [];
}
export function attachCorePersistence(app, Adapt, childWindow, scoId) {
  if (Adapt.__lxpCorePersistence) return Adapt.__lxpCorePersistence;
  var controller = {
    mode: 'waiting',
    format: 1
  };
  Adapt.__lxpCorePersistence = controller;
  function begin() {
    if (controller.mode !== 'waiting') return;
    var loader = childWindow.require;
    if (loader && loader.defined && loader.defined('extensions/adapt-contrib-spoor/js/scorm/wrapper')) {
      controller.mode = 'spoor';
      return;
    }
    var models = Adapt.components && Adapt.components.models;
    if (!models || !models.length) return;
    if (!models.every(function (model) {
      return typeof model.getAttemptObject === 'function' && typeof model.setAttemptObject === 'function';
    })) {
      controller.mode = 'unsupported-core';
      console.error('LXP: Core persistence requires native attempt-state APIs.');
      return;
    }
    var custom = app.DATA['cmi.suspend_data'].customData;
    if (!custom.nativeAdapt) custom.nativeAdapt = {};
    var previous = custom.nativeAdapt[scoId];
    var records = previous && previous.format === 1 ? previous.components : {};
    var signatures = {};
    models.forEach(function (model) {
      var id = model.get('_id');
      signatures[id] = fingerprint(model);
      var record = records && records[id];
      if (!record || record.fingerprint !== signatures[id]) return;
      var state = allowedAttemptState(record.state || {});
      model.setAttemptObject(state, false);
      if (state._isSubmitted === true) {
        model.restoreUserAnswers();
      } else {
        if (ACTIVE_TYPES.indexOf(model.get('_component')) !== -1 && Array.isArray(record.active)) {
          children(model).forEach(function (item, index) {
            var originalIndex = Number.isInteger(item.get('_index')) ? item.get('_index') : index;
            item.toggleActive(record.active[originalIndex] === true);
          });
        }
        if (model.get('_component') === 'textinput' && Array.isArray(record.draftText)) {
          (model.get('_items') || []).forEach(function (item, index) {
            if (typeof record.draftText[index] === 'string') item.userAnswer = record.draftText[index];
          });
        }
        if (model.get('_component') === 'slider' && Number.isFinite(record.draftSlider)) {
          var selected = (model.get('_items') || []).find(function (item) {
            return item.value === record.draftSlider;
          });
          if (selected) {
            model.deselectAllItems();
            selected.selected = true;
            model.set('_selectedItem', selected);
          }
        }
      }
    });
    controller.mode = 'core-local';
    var timer;
    function save() {
      clearTimeout(timer);
      var components = {};
      models.forEach(function (model) {
        var id = model.get('_id');
        var ancestors = typeof model.getAncestorModels === 'function' ? model.getAncestorModels() : [];
        var required = model.get('_isAvailable') !== false && model.get('_isOptional') !== true && ancestors.every(function (ancestor) {
          return ancestor.get('_isAvailable') !== false && ancestor.get('_isOptional') !== true;
        });
        var record = {
          fingerprint: signatures[id],
          state: allowedAttemptState(model.getAttemptObject()),
          required: required
        };
        if (ACTIVE_TYPES.indexOf(model.get('_component')) !== -1) {
          record.active = [];
          children(model).forEach(function (item, index) {
            var originalIndex = Number.isInteger(item.get('_index')) ? item.get('_index') : index;
            record.active[originalIndex] = item.get('_isActive') === true;
          });
        }
        if (model.get('_component') === 'textinput') record.draftText = (model.get('_items') || []).map(function (item) {
          return typeof item.userAnswer === 'string' ? item.userAnswer : '';
        });
        if (model.get('_component') === 'slider') {
          var selected = model.get('_selectedItem');
          if (selected && Number.isFinite(selected.value)) record.draftSlider = selected.value;
        }
        components[id] = record;
      });
      custom.nativeAdapt[scoId] = {
        format: 1,
        components: components
      };
      app.SCORM_API.set('cmi.suspend_data', app.DATA['cmi.suspend_data']);
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(save, 0);
    }
    models.forEach(function (model) {
      model.on('change', schedule);
      var items = typeof model.getChildren === 'function' && model.getChildren();
      if (items && items.on) items.on('change', schedule);
    });
    childWindow.document.addEventListener('input', schedule, true);
    childWindow.document.addEventListener('change', schedule, true);
    childWindow.addEventListener('beforeunload', save);
    controller.save = save;
  }
  Adapt.on('app:dataReady', begin);
  if (Adapt.components && Adapt.components.models && Adapt.components.models.length) begin();
  return controller;
}
export function nativeCourseProgress(data, scoId, absolute) {
  var custom = data && data['cmi.suspend_data'] && data['cmi.suspend_data'].customData;
  var record = custom && custom.nativeAdapt && custom.nativeAdapt[scoId];
  if (!record || record.format !== 1 || !record.components) return null;
  var components = Object.values(record.components).filter(function (component) {
    return component && component.required !== false && component.state && typeof component.state._isComplete === 'boolean';
  });
  if (!components.length) return 0;
  var completed = components.filter(function (component) {
    return component.state._isComplete;
  }).length;
  return absolute ? completed : completed / components.length;
}
