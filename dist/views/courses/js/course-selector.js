import { CONF } from '../../../js/conf.js';

var SCOSelector = function ($) {
  'use strict';

  var _$scoListEl = document.getElementById('sco-list');

  function SCOSelector() {}

  SCOSelector.prototype = {

    initialize: function initialize() {
      _$scoListEl.innerHTML = this.renderList(CONF.SCOS);
      this.restoreSelection();

      return this;
    },

    renderList: function renderList(scos) {
      var _this = this;

      // CONSOLE.debug("Rendering SCO list...");

      var result = '';

      // diagnostic
      var firstKey = Object.keys(scos)[0];
      var sco = scos[firstKey];
      var scoId = sco.id;

      result += '<li class="sco" style="height: 4rem; margin-right: 0rem;' + (sco.disabled ? 'pointer-events: none; opacity: 0.5;' : '') + '" ' + 'id="' + scoId + '" onclick="window.parent.launchSCO(' + "'" + scoId + "'" + ')" ' + (sco.disabled ? 'disabled>' : '>') + '<div>' + '<div style="width:95%;" ' + (sco.disabled ? 'disabled>' : '>') + scoId + ' – ' + sco.label + '</div>' + '</div>' + '</li>';
      // diagnostic

      // without first sco (assumption == diagnostic)
      Object.values(scos).slice(1).forEach(function (module) {
        result += _this.renderListItem(module);
      });

      return result;
    },

    renderListItem: function renderListItem(item, score) {
      var _this2 = this;

      var parentId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';

      var result = '';

      var progressModule = void 0;
      var averageScore = 0;

      if (item.courses) {
        progressModule = calculateScoreOfModule(window.parent, item.id);
        Object.values(progressModule).forEach(function (courseScore) {
          averageScore += courseScore;
        });

        averageScore = averageScore / Object.values(progressModule).length * 100;

        result += '<div class="accordion-item">';

        result += '<h2' + ' id=' + item.id + ' class=' + 'accordion-header' + ' ' + (item.disabled ? 'disabled>' : '>');

        result += '<button' + ' class=' + '"accordion-button collapsed bg-light"' + ' type=' + 'button' + ' data-bs-toggle=' + 'collapse' + ' data-bs-target=' + '#' + 'collapse' + item.id + ' aria-expanded=' + 'false' + ' aria-controls=' + 'collapse' + item.id + ' ' + (item.disabled ? 'disabled>' : '>') + '<div style="width:90%;">' + item.id + ' – ' + item.label + '</div>' + '<div class="progress mb-n1 mr-3 progress-custom">' + '<div id="progressbar" class="progress-bar bg-success" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' + 'style="width: ' + averageScore + '%" aria-valuenow="' + averageScore + '">' + '</div></div>' + '</button>' + '</h2>';

        result += '<div' + ' id=' + 'collapse' + item.id + ' class=' + '"accordion-collapse collapse"' + ' aria-labelledby=' + item.id + ' data-bs-parent=' + 'sco-list' + ' ' + (item.disabled ? 'disabled>' : '>');

        result += '<div class="accordion-body p-0">' + '<ul>';

        item.courses.forEach(function (course) {
          result += _this2.renderListItem(course, score = progressModule[course.id] * 100, parentId = item.id);
        });

        result += '</ul>';

        result += '</div>'.repeat(3);
      } else {
        var scoId = parentId + '.' + item.id;

        result += '<li class="sco" style="height: 4rem; margin-right: 0rem;' + (item.disabled ? 'pointer-events: none; opacity: 0.5;' : '') + '" ' + 'id="' + scoId + '" onclick="window.parent.App.launchSCO(' + "'" + scoId + "'" + ')" ' + (item.disabled ? 'disabled>' : '>') + '<div>' + '<div style="width:95%;">' + scoId + ' – ' + item.label + '</div>' + '<div class="progress progress-custom" style="margin-right: 2.5rem">' + '<div id="progressbar" class="progress-bar bg-success" role="progressbar" aria-valuemin="0" aria-valuemax="100" ' + 'style="width: ' + score + '%" aria-valuenow="' + score + '">' + '</div>' + '</li>';
      }

      return result;
    },

    restoreSelection: function restoreSelection() {
      // CONSOLE.debug("Restoring previous selection...");
      var selection = window.parent.App.DATA['cmi.suspend_data'].bookmark;
      if (selection) {
        // CONSOLE.debug("Previous selection found: " + selection);
        var selSplit = selection.split('.');
        document.getElementById(selSplit[0]).classList.toggle('bookmarked');
        document.getElementById(selection).classList.toggle('bookmarked');
      }
    }
  };

  return SCOSelector;
}(jQuery);

$(document).on('ready', function () {
  new SCOSelector().initialize();
});