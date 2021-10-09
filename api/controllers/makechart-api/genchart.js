'use strict';

const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const TextToSVG = require("text-to-svg");
const sharp = require('sharp');

const FONT_PATH = process.env.THIS_BASE_PATH + '/font/ipaexg.ttf';
const FONT_NAME = "IPAEXG";

const CHART_COLORS = [
  '#4dc9f6',
  '#f67019',
  '#f53794',
  '#537bc4',
  '#acc236',
  '#166a8f',
  '#00a950',
  '#58595b',
  '#8549ba'
];
const FILL_ALPHA = "88";
const LINE_ALPHA = "ee";
const FILL_CLEAN = '#00000000';
const LINE_CLEAN = '#00000022';
const FONT_COLOR = "#333333aa";
const TITLE_FONT_SIZE = 24;
const CAPTION_FONT_SIZE = 72;
const CAPTION_PADDING = 20;

const BORDER_WIDTH = 2;
const CHART_PADDING = 5;

function chart_colors(i) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

const textToSVG = TextToSVG.loadSync(FONT_PATH);

class GenerateCart {
  constructor() {
  }

  makeCaption(width, height, caption){
    var fontSize = Math.min(CAPTION_FONT_SIZE, width / caption.length);

    var svgOptions = { x: 0, y: 0, anchor: "left top", attributes: { fill: FONT_COLOR } };
    do {
      svgOptions.fontSize = fontSize;
      var metrics = textToSVG.getMetrics(caption, svgOptions);
      if (metrics.width <= width * (100 - CAPTION_PADDING) / 100 && metrics.height <= height * (100 - CAPTION_PADDING) / 100)
        break;
      fontSize -= 2;
      if( fontSize <= 0 )
        throw 'unknown error';
    } while (true);

    return textToSVG.getSVG(caption, svgOptions);
  }

  async makeChart(width, height, type, params, mimetype){
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: width,
      height: height,
      chartCallback: (ChartJS) => {
        if(!ChartJS.defaults.global)
          ChartJS.defaults.global = {};
        ChartJS.defaults.global.defaultFontFamily = FONT_NAME;
        ChartJS.defaults.global.defaultFontColor = FONT_COLOR;
      }
    });
    chartJSNodeCanvas.registerFont(FONT_PATH, { family: FONT_NAME });

    var configuration;
    switch(type){
      case 'doughnut': {
        configuration = make_chart_doughnut(params.value, params.legend, params.title, params.range);
        break;
      }
      case 'gauge': {
        configuration = make_chart_gauge(params.value, params.legend, params.title, params.range);
        break;
      }
      case 'line': {
        configuration = make_chart_line(params.datum, params.labels, params.legends, params.title, params.range);
        break;
      }
      case 'pie': {
        configuration = make_chart_pie(params.datum, params.legends, params.title);
        break;
      }
      case 'stackbar': {
        configuration = make_chart_stackbar(params.datum, params.labels, params.legends, params.title, params.range);
        break;
      }
      case 'bar': {
        configuration = make_chart_bar(params.datum, params.labels, params.title, params.range);
        break;
      }
      default:{
        throw 'unknown type';
      }
    }

    return chartJSNodeCanvas.renderToBuffer(configuration, mimetype);
  }

  async generateChart(width, height, type, chart_params, caption, bgcolor){
    var chart_image = await this.makeChart(width, height, type, chart_params, "image/png");
    var caption_image;
    if( caption )
      caption_image = Buffer.from(this.makeCaption(width, height, caption));

    var image_buffer;
    if( bgcolor ){
      var background_svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
								<path d="M0 0 L ${width} 0 L ${width} ${height} L 0 ${height}" style="fill:${bgcolor}; stroke-width:0" />
							</svg>`;
      var comps = [];
      comps.push({ input: chart_image });
      if( caption_image )
        comps.push({ input: caption_image, gravity: "center" });

      image_buffer = await sharp(Buffer.from(background_svg))
        .composite(comps)
        .png()
        .toBuffer();
    }else if( caption_image ){
      image_buffer = await sharp(chart_image)
        .composite([{
          input: caption_image,
          gravity: 'center'
        }])
        .png()
        .toBuffer();
    }else{
      image_buffer = chart_image;
    }

    return image_buffer;
  }
}

module.exports = new GenerateCart();

function make_chart_doughnut(value, legend, title, range) {
  var configuration = {
    type: 'doughnut',
    data: {
      labels: legend ? [legend] : undefined,
      datasets: [{
        data: [value, range.max - value],
        backgroundColor: [chart_colors(0) + FILL_ALPHA, FILL_CLEAN],
        borderColor: [chart_colors(0) + LINE_ALPHA, LINE_CLEAN],
        borderWidth: BORDER_WIDTH
      }]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: legend ? true : false,
        align: 'end',
      },
    }
  };

  return configuration;
}

function make_chart_gauge(value, legend, title, range) {
  var configuration = {
    type: 'horizontalBar',
    data: {
      datasets: [{
        label: legend,
        data: [value],
        backgroundColor: [
          chart_colors(0) + FILL_ALPHA,
        ],
        borderColor: [
          chart_colors(0) + LINE_ALPHA,
        ],
        borderWidth: BORDER_WIDTH
      }]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: legend ? true : false,
        align: 'end',
      },
    }
  };

  if (range) {
    configuration.options.scales = {
      xAxes: [{
        ticks: {
          min: range.min,
          max: range.max
        }
      }]
    };
  }

  return configuration;
}

function make_chart_line(datum, labels, legends, title, range) {
  var configuration = {
    type: 'line',
    data: {
      labels: labels,
      datasets: []
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: legends ? true : false,
        align: 'end',
      },
    }
  };

  for (var i = 0; i < datum.length; i++) {
    var data = {
      label: legends ? legends[i] : undefined,
      data: datum[i],
      lineTention: 0.1,
      borderColor: chart_colors(i) + LINE_ALPHA,
      fill: false
    };
    configuration.data.datasets.push(data);
  }

  if (range) {
    configuration.options.scales = {
      yAxes: [{
        ticks: {
          min: range.min,
          max: range.max
        }
      }]
    }
  }

  return configuration;
}

function make_chart_pie(datum, legends, title) {
  var configuration = {
    type: 'pie',
    data: {
      labels: legends,
      datasets: [
        {
          data: datum,
          borderColor: [],
          backgroundColor: [],
          borderWidth: BORDER_WIDTH,
        },
      ]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: legends ? true : false,
        align: 'end',
      },
    }
  };

  for (var i = 0; i < datum.length; i++) {
    configuration.data.datasets[0].backgroundColor.push(chart_colors(i) + FILL_ALPHA);
    configuration.data.datasets[0].borderColor.push(chart_colors(i) + LINE_ALPHA);
  }

  return configuration;
}

function make_chart_stackbar(datum, labels, legends, title, range) {
  var datasets = Array(legends.length);
  for (var i = 0; i < legends.length; i++) {
    datasets[i] = [];
    for (var j = 0; j < datum.length; j++) {
      datasets[i].push(datum[j][i]);
    }
  }

  var configuration = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: []
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: legends ? true : false,
        align: 'end',
      },
      scales: {
        xAxes: [{
          stacked: true
        }],
        yAxes: [{
          stacked: true,
        }]
      }
    }
  };

  for (var i = 0; i < legends.length; i++) {
    var data = {
      label: legends[i],
      data: datasets[i],
      backgroundColor: chart_colors(i) + FILL_ALPHA,
      borderColor: chart_colors(i) + LINE_ALPHA,
      borderWidth: BORDER_WIDTH
    };
    configuration.data.datasets.push(data);
  }

  if (range) {
    configuration.options.scales.yAxes[0].ticks = {
      min: range.min,
      max: range.max
    };
  }

  return configuration;
}

function make_chart_bar(datum, labels, title, range) {
  var configuration = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: datum,
        backgroundColor: [],
        borderColor: [],
        borderWidth: BORDER_WIDTH
      }]
    },
    options: {
      animation: false,
      responsive: false,
      layout: {
        padding: CHART_PADDING
      },
      title: {
        display: title ? true : false,
        text: title,
        fontSize: TITLE_FONT_SIZE
      },
      legend: {
        display: false,
        align: 'end',
      }
    }
  };

  for (var i = 0; i < datum.length; i++) {
    configuration.data.datasets[0].backgroundColor.push(chart_colors(i) + FILL_ALPHA);
    configuration.data.datasets[0].borderColor.push(chart_colors(i) + LINE_ALPHA);
  }

  if (range) {
    configuration.options.scales = {
      yAxes: [{
        ticks: {
          min: range.min,
          max: range.max
        }
      }]
    }
  }

  return configuration;
}