'use strict';

import { calculateMinutes, floatToPercentage, germanDateFormat } from './utils.js';

var colors = ['#ff8c00', '#28a745', '#333333', '#c3e6cb', '#dc3545', '#6c757d'];

var options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: {
        display: false
      }
    },
    y: {
      grid: {
        display: false
      }
    }
  }
};

function updateOrMakeChart(chartConfig, chartKey) {
  var chart = window.Chart.getChart(chartKey);

  if (typeof chart !== 'undefined') {
    Object.entries(chartConfig).forEach(function (key, val) {
      chart[key] = val;
    });
    chart.update();
  } else {
    chart = new window.Chart(chartKey, chartConfig);
  }

  return chart;
}

// Pulse-window.Chart
var optionsLearningPulse = JSON.parse(JSON.stringify(options));

optionsLearningPulse.plugins = {
  legend: {
    onClick: legendClickHandler,
    labels: { generateLabels: function generateLabels(chart) {
        return labelHandler(chart);
      } }
  }
};

var pulseChartConfig = function pulseChartConfig(learningExperience) {
  return {
    type: 'line',
    data: {
      labels: learningExperience.map(function (x) {
        return germanDateFormat(x[0]);
      }),
      datasets: [{
        label: 'Lernaktivität - XP (kumuliert)',
        hidden: true,
        data: learningExperience.map(function (x) {
          return parseInt(x[2]);
        }),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      }, {
        label: 'Lernaktivität - XP (neu)',
        hidden: true,
        data: Array.from(learningExperience.map(function (x) {
          return parseInt(x[2]);
        }).values()).map(function (_, i, array) {
          return !isNaN(array[i] - array[i - 1]) ? array[i] - array[i - 1] : array[i];
        }),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      }, {
        label: 'Lernaktivität - Zeit (Minuten)',
        hidden: false,
        data: learningExperience.map(function (x) {
          return calculateMinutes(x[1]);
        }),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      }]
    },
    options: optionsLearningPulse
  };
};

export var pulseChart = function pulseChart(learningExperience, pulseElement) {
  var config = pulseChartConfig(learningExperience);

  return updateOrMakeChart(config, pulseElement);
};

// Radar-window.Chart

var optionsRadar = JSON.parse(JSON.stringify(options));

optionsRadar.scales = {
  r: {
    beginAtZero: true,
    suggestedMax: 1,
    ticks: {
      min: 0,
      max: 100,
      callback: function callback(value) {
        return floatToPercentage(value);
      }
    },
    scaleLabel: {
      display: true,
      labelString: '%'
    },
    pointLabels: {
      font: {
        size: 15
      }
    }
  }
};

optionsRadar.elements = {
  line: {
    borderWidth: 1,
    backgroundColor: "rgba(255,140,0,0.4)",
    borderColor: colors[0]
  },
  point: {
    pointBorderColor: colors[0],
    pointBackgroundColor: colors[0]
  }
};

optionsRadar.plugins = {
  tooltip: {
    callbacks: {
      label: function label(context) {
        var label = context.dataset.label || '';

        if (label) {
          label += ': ';
        }
        if (context.parsed.r) {
          label += floatToPercentage(context.parsed.r);
        }
        return label;
      }
    }
  }
};

var radarChartConfig = function radarChartConfig(averageModuleScores) {
  return {
    type: 'radar',
    data: {
      labels: Object.keys(averageModuleScores).map(function (key) {
        return window.CONF.SCOS[key].label.split('&').map(function (line) {
          return line.trim();
        });
      }),
      datasets: [{
        label: 'Lernfortschritt',
        data: Object.values(averageModuleScores)
      }]
    },
    options: optionsRadar
  };
};

export var radarChart = function radarChart(averageModuleScores, radarElement) {
  delete averageModuleScores.M0; // project-specific requirement
  delete averageModuleScores.MX; // project-specific requirement

  var config = radarChartConfig(averageModuleScores);

  return updateOrMakeChart(config, radarElement);
};

// source: https://stackoverflow.com/questions/69803206/how-to-show-only-one-line-in-time-in-a-multiple-datasets-in-line-chart-js
function legendClickHandler(e, legendItem, legend) {
  var index = legendItem.datasetIndex;
  var ci = legend.chart;

  legend.legendItems.forEach(function (_, idx) {
    if (idx === index) {
      if (ci.isDatasetVisible(idx)) {
        ci.hide(idx);
        legendItem.hidden = true;
      } else {
        ci.show(idx);
        legendItem.hidden = false;
      }
    } else {
      ci.hide(idx);
      legendItem.hidden = true;
    }
  });
}

// source: https://github.com/chartjs/window.window.Chart.js/issues/4438
function labelHandler(chart) {
  var baseItems = window.window.Chart.defaults.plugins.legend.labels.generateLabels(chart);

  baseItems.forEach(function (item) {
    if (item.hidden) {
      item.hidden = false; // prevent strike-through
      item.fillStyle = window.window.Chart.helpers.color(item.fillStyle).alpha(0.5).rgbString();
    }
  });
  return baseItems;
}