'use strict'

import { calculateMinutes, floatToPercentage, germanDateFormat } from './utils.js'

const colors = ['#ff8c00', '#28a745', '#333333', '#c3e6cb', '#dc3545', '#6c757d']

const options = {
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
}

function updateOrMakeChart (chartConfig, chartKey) {
  let chart = window.Chart.getChart(chartKey)

  if (typeof chart !== 'undefined') {
    Object.entries(chartConfig).forEach((key, val) => {
      chart[key] = val
    })
    chart.update()
  } else {
    chart = new window.Chart(chartKey, chartConfig)
  }

  return chart
}

// Pulse-window.Chart
const optionsLearningPulse = JSON.parse(JSON.stringify(options))

optionsLearningPulse.plugins = {
  legend: {
    onClick: legendClickHandler,
    labels: { generateLabels: (chart) => labelHandler(chart) }
  }
}

const pulseChartConfig = (learningExperience) => ({
  type: 'line',
  data: {
    labels: learningExperience.map(x => germanDateFormat(x[0])),
    datasets: [
      {
        label: 'Lernaktivität - XP (kumuliert)',
        hidden: true,
        data: learningExperience.map(x => parseInt(x[2])),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      },
      {
        label: 'Lernaktivität - XP (neu)',
        hidden: true,
        data: Array.from(learningExperience.map(x => parseInt(x[2])).values()).map((_, i, array) => !isNaN(array[i] - array[i - 1]) ? array[i] - array[i - 1] : array[i]),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      },
      {
        label: 'Lernaktivität - Zeit (Minuten)',
        hidden: false,
        data: learningExperience.map(x => calculateMinutes(x[1])),
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
        pointBackgroundColor: colors[0]
      }
    ]
  },
  options: optionsLearningPulse
})

export const pulseChart = function (learningExperience, pulseElement) {
  const config = pulseChartConfig(learningExperience)

  return updateOrMakeChart(config, pulseElement)
}

// Radar-window.Chart

const optionsRadar = JSON.parse(JSON.stringify(options))

optionsRadar.scales = {
  r: {
    beginAtZero: true,
    suggestedMax: 1,
    ticks: {
      min: 0,
      max: 100,
      callback: (value) => floatToPercentage(value)
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
}

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
      label: function (context) {
        let label = context.dataset.label || ''

        if (label) {
          label += ': '
        }
        if (context.parsed.r) {
          label += floatToPercentage(context.parsed.r)
        }
        return label
      }
    }
  }
}

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
}

export const radarChart = function (averageModuleScores, radarElement) {
  delete averageModuleScores.M0 // project-specific requirement
  delete averageModuleScores.MX // project-specific requirement
  
  const config = radarChartConfig(averageModuleScores)

  return updateOrMakeChart(config, radarElement)
}

// source: https://stackoverflow.com/questions/69803206/how-to-show-only-one-line-in-time-in-a-multiple-datasets-in-line-chart-js
function legendClickHandler (e, legendItem, legend) {
  const index = legendItem.datasetIndex
  const ci = legend.chart

  legend.legendItems.forEach(function (_, idx) {
    if (idx === index) {
      if (ci.isDatasetVisible(idx)) {
        ci.hide(idx)
        legendItem.hidden = true
      } else {
        ci.show(idx)
        legendItem.hidden = false
      }
    } else {
      ci.hide(idx)
      legendItem.hidden = true
    }
  })
}

// source: https://github.com/chartjs/window.window.Chart.js/issues/4438
function labelHandler (chart) {
  const baseItems = window.window.Chart.defaults.plugins.legend.labels.generateLabels(chart)

  baseItems.forEach(item => {
    if (item.hidden) {
      item.hidden = false // prevent strike-through
      item.fillStyle = window.window.Chart.helpers.color(item.fillStyle).alpha(0.5).rgbString()
    }
  })
  return baseItems
}
