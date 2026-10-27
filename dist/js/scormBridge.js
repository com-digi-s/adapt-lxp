// One immutable SCO identity per API object. Late unload/commit calls must not
// be attributed to whichever SCO happens to be bookmarked next.
export function createSCOBridge(app, scoId) {
  if (typeof scoId !== 'string' || !scoId) throw new Error('Missing SCO identity');
  var lastError = '0';
  var localKeys = /^cmi\.core\.(lesson_status|lesson_location|entry|exit|session_time|total_time|score\.(raw|min|max))$/;
  function suspendData() {
    return app.DATA['cmi.suspend_data'];
  }
  function state() {
    var custom = suspendData().customData;
    if (!custom.scoState) custom.scoState = {};
    if (!custom.scoState[scoId]) custom.scoState[scoId] = {};
    return custom.scoState[scoId];
  }
  function persist() {
    app.SCORM_API.set('cmi.suspend_data', suspendData());
  }
  return {
    __adaptLXPBridge: true,
    LMSInitialize: function () {
      lastError = '0';
      return 'true';
    },
    LMSGetValue: function (parameter) {
      lastError = '0';
      if (parameter === 'cmi.suspend_data') {
        var value = suspendData().adaptData[scoId];
        return typeof value === 'string' ? value : JSON.stringify(value || {});
      }
      if (localKeys.test(parameter)) {
        var values = state();
        if (Object.prototype.hasOwnProperty.call(values, parameter)) return values[parameter];
        if (parameter === 'cmi.core.lesson_status') return 'not attempted';
        if (parameter === 'cmi.core.entry') return suspendData().adaptData[scoId] ? 'resume' : 'ab-initio';
        return '';
      }
      var result = app.SCORM_API.get(parameter);
      return result == null ? '' : String(result);
    },
    LMSSetValue: function (parameter, value) {
      try {
        if (parameter === 'cmi.suspend_data') {
          // SCORM suspend_data is opaque. Keep Adapt JSON structured
          // where possible, but do not reject another valid encoding.
          var parsed;
          try {
            parsed = JSON.parse(value);
          } catch (_) {
            parsed = null;
          }
          suspendData().adaptData[scoId] = parsed && typeof parsed === 'object' ? parsed : String(value);
          persist();
        } else if (localKeys.test(parameter)) {
          state()[parameter] = String(value);
          persist();
        } else {
          app.SCORM_API.set(parameter, parameter.endsWith('.id') ? scoId + '#' + value : value);
        }
        lastError = '0';
        return 'true';
      } catch (_) {
        lastError = '101';
        return 'false';
      }
    },
    LMSCommit: function () {
      app.SCORM_API.save();
      return 'true';
    },
    LMSFinish: function () {
      app.SCORM_API.save();
      return 'true';
    },
    LMSGetLastError: function () {
      return lastError;
    },
    LMSGetErrorString: function (code) {
      return String(code) === '0' ? 'No error' : 'General exception';
    },
    LMSGetDiagnostic: function () {
      return lastError === '0' ? 'No error' : 'Could not persist SCO data';
    }
  };
}
export function installSCOBridge(app, scoId, targetWindow) {
  var bridge = createSCOBridge(app, scoId);
  // Install only on the LXP's own window and never replace a genuine API.
  // The wrapper discovers/caches its external LMS API before the first launch.
  if (!targetWindow.API || targetWindow.API.__adaptLXPBridge) targetWindow.API = bridge;
  return bridge;
}
