
// Data related variables

/** @type {string} */
let currentDataPath;
/** @type {d3.DSVRowArray<string>} */
let currentData;
/** @type {string[]} */
let currentDataNumericAttributes;
/** @type {d3.DSVRowString<string>[]} */
let currentDataSkyline;
/** @type {d3.DSVRowString<string>[]} */
let currentDataDominated;
/** @type {d3.DSVRowString<string>[]} */
let currentDataSkylineNumericOnly;
/** @type {array[]} */
let divergingData;
// Named decisive subspaces
let decisiveSubspaces;
// The maximum number of decisive subspaces
let max_subspaces;
// Decisive subspaces in array form for Display
let decisiveSubspacesDisplay;
/**
 * Store the unique key or id field name of the data
 * @type {string}
 */
let uniqueKey;
/**
 * Store the min and max values for each numeric attribute (column).
 * @type {Object.<string, {min: number, max: number, percentage: (value: number) => number}>}
 */
let currentDataSkylineNumericOnlyMinMax;
/**
 * Store the domination score of the skyline points (`scores` property).
 * Furthermore, store the min and max domination scores.
 * @type {{min: number, max: number, scores: number[], dominatedPoints: number[][], percentage: (index: number) => number}}
 */
let currentDataSkylineDominationScores;
/**
 * Store the relative ranking of all skyline points per attribute.
 * @type {Map[]}
 */
let currentDataSkylineNumericOnlyRelativeRankings;
/** @type {number[]} */
let selectedSkylinePointIndices;

/**
 * The column index to use for tooltip titles
 * @type {number}
 */
let PointNameColumnIndex;

// HTML Elements

/** @type {d3.Selection<any, any, SVGSVGElement, any>} */
let projectionView;
/** @type {d3.Selection<any, any, HTMLElement, any>} */
let comparisonView;
/** @type {d3.Selection<any, any, HTMLElement, any>} */
let tabularView;
/** @type {d3.Selection<any, any, HTMLElement, any>} */
let attributeTable;
/** @type {d3.Selection<any, any, HTMLDivElement, any>} */
let projectionViewTooltip;
/** @type {d3.Selection<any, any, HTMLDivElement, any>}  */
let comparisonViewOverlay;
/** @type {d3.Selection<any, any, SVGSVGElement, any>}  */
let comparisonViewOverlaySvg;

// Other variables

/** @type {number[][]} */
let projectionViewPositions;
/** @type {number} */
let projectionViewSelectedIndex;

// Cell properties for the tabularView
/** @type {number} */
const cellWidth = 400;
/** @type {number} */
const cellHeight = 40;
/** @type {number} */
const detailCellHeight = 20;

/**
 * Colors for the detail matrix in the tabular view
 * @type {string[]} The hex codes
 */
const MatrixColors = [
  '#2065aa',
  '#4190c1',
  '#92c4dd',
  '#d0e4ef',
  '#f7f7f7',
  '#fcdac7',
  '#f4a481',
  '#d65f4d',
  '#b21729',
];

//
// Main file content
//

// Add all listeners that are necessary for the application to work.
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', () => {
  drawProjectionView(true, true);
  buildComparisonView();
});

/**
 * Perform initial configuration.
 */
async function init() {
  document.getElementById('select-available-data').selectedIndex = -1;
  currentDataPath = '';
  projectionView = d3.select('#projection-view');
  comparisonView = d3.select('#comparison-view');
  tabularView = d3.select('#tabular-view');
  attributeTable = d3.select('#attribute-table');
  projectionViewTooltip = d3.select('#projection-view-tooltip');
  comparisonViewOverlay = d3.select('#comparison-view-overlay');
  comparisonViewOverlaySvg = d3.select('#comparison-view-overlay-svg');
}

/**
 * Load new data. New data is only loaded, if it is not already loaded.
 *
 * @param {string} filepath Path to the csv-file that contains the new data.
 */
async function loadData(filepath) {
  if (currentDataPath != filepath) {
    currentDataPath = filepath;
    d3.csv(filepath).then((data) => {
      currentData = data;
      currentDataNumericAttributes = undefined; // Necessary
      // Get name of id field because it is later needed for the tabular view
      uniqueKey = d3.keys(currentData[0])[0];
      // The check `index > 0` is used because the first column is the id field
      // which shall not be considered as a numeric attribute.
      currentDataNumericAttributes = currentData.columns.filter(
        (column, index) => index > 0 && isNumericAttribute(column)
      );
      selectedSkylinePointIndices = [];
      console.log(`Successfully loaded ${data.length} records.`);
      calculateSkylinePoints();
      buildAll();
      disablePlaceholders();
    });
  }
}

/**
 * Disable all placeholders.
 */
async function disablePlaceholders() {
  d3.selectAll('.view-placeholder').style('visibility', 'hidden');
}

/**
 * Calculate the skyline points of the currently loaded data.
 */
async function calculateSkylinePoints() {
  // Calculate all skyline points.
  currentDataSkyline = currentData.filter(
    (data1) => !currentData.filter((data) => data != data1).some((data2) => dominates(data2, data1))
  );
  // Calculate all dominated points.
  currentDataDominated = currentData.filter((data1) =>
    currentData.filter((data) => data != data1).some((data2) => dominates(data2, data1))
  );

  // Use first column (0) as display name in tooltips
  // if it is a nominal column, else use second column (1)
  let firstAttr = Object.keys(currentData[0])[0];
  PointNameColumnIndex = 1;
  if (isNaN(currentData[0][firstAttr])) {
    PointNameColumnIndex = 0;
  }

  subspaces = new Map(
    currentDataNumericAttributes.map((column) => [
      column,
      currentDataSkyline.filter(
        (data1) => !currentDataSkyline.filter((data) =>
          data != data1).some((data2) => data2[column] > data1[column])
      )
    ])
  );

  // Extract the numeric attributes of all skyline points.
  currentDataSkylineNumericOnly = currentDataSkyline.map((data) =>
    currentDataNumericAttributes.reduce(
      (result, column) => (result = { ...result, [column]: +data[column] }),
      {}
    )
  );
  // Find the minimum and maximum values of all numeric attributes among all skyline points.
  currentDataSkylineNumericOnlyMinMax = currentDataNumericAttributes.reduce(
    (result, column) =>
      (result = {
        ...result,
        [column]: {
          min: Math.min(...currentDataSkyline.map((data) => data[column])),
          max: Math.max(...currentDataSkyline.map((data) => data[column])),
          percentage: function (value) {
            return (value - this.min) / (this.max - this.min);
          },
        },
      }),
    {}
  );

  // Calculate the domination scores of all skyline points.
  const dominatedPoints = currentDataSkyline.map((data1) =>
    currentData.filter((data2) => data1 != data2 && dominates(data1, data2))
  );
  const dominationScores = dominatedPoints.map((points) => points.length);
  currentDataSkylineDominationScores = {
    min: Math.min(...dominationScores),
    max: Math.max(...dominationScores),
    scores: dominationScores,
    dominatedPoints,
    percentage: function (index) {
      return (this.scores[index] - this.min) / (this.max - this.min);
    },
  };

  // Calculate the relative ranking of all attributes of all skyline points among the other skyline points.
  const relativeRankings = new Map(
    currentDataNumericAttributes.map((column) => [
      column,
      currentDataSkylineNumericOnly.map((skylinePoint, index) => ({
        index,
        value: skylinePoint[column],
      })),
    ])
  );
  relativeRankings.forEach((attributeArray) => attributeArray.sort((a, b) => a.value - b.value));
  currentDataSkylineNumericOnlyRelativeRankings = currentDataSkylineNumericOnly.map(
    (skylinePoint, index) =>
      new Map(
        Object.keys(skylinePoint).map((column) => [
          column,
          relativeRankings.get(column).findIndex((ranking) => ranking.index == index) /
            currentDataSkylineNumericOnly.length,
        ])
      )
  );

  console.log(
    `Calculated ${currentDataSkyline.length} skyline points and ${currentDataDominated.length} dominated points.`
  );

  console.log(`Determining decisive subspaces...`);

  max_subspaces = 0;
  decisiveSubspaces = new Map();
  determineDecisiveSubspaces(currentDataSkyline, currentDataNumericAttributes, currentDataNumericAttributes);
  decisiveSubspacesDisplay = new Map();
  // Bring decisive subspaces into row form for detail matrix creation
  decisiveSubspaces.forEach((val, key) => {
    if (!decisiveSubspacesDisplay.has(key))
      decisiveSubspacesDisplay.set(key, new Map());
    let subs = decisiveSubspacesDisplay.get(key);
    let rowCount = 0;
    let v = new Map([...val].sort((a, b) => {
      return (a[1].length - b[1].length);
    }));
    v.forEach(c => {
      c.forEach(n => {
        if (!subs.has(n))
          subs.set(n, []);
        subs.get(n).push(rowCount);
      });
      rowCount = rowCount + 1;
      max_subspaces = Math.max(max_subspaces, rowCount);
    });
  });

  console.log(`Determined decisive subspaces.`);

  calcDivergingData();
}

/**
 * Calculate differences between the given point and all others
 * for the current attribute (column) and remember the index of
 * the point for later highlighting. The calculation is according
 * to the papers equation in section 6.2 Tabular View
 */
async function calcDivergingData() {
  // Pre-calc the divisor for the diverging point formula in
  // the paper, 6.2 Tabular View, for every numeric column
  let divisors = new Object();
  d3.keys(currentData[0]).forEach((d) => {
    if (isNumericAttribute(d)) {
      var mean = d3.mean(currentData, (p) => +p[d]);
      var div = 0;
      currentData.forEach((dat, i) => {
        div += Math.pow(+dat[d] - mean, 2);
      });
      divisors[d] = Math.sqrt(div / currentData.length);
    }
  });

  // Interpolate between colors
  let step = d3.scaleLinear().domain([0, 8]).range([0, 8]);
  let color = d3
    .scaleLinear()
    .domain([1, step(2), step(3), step(4), step(5), step(6), step(7), step(8)])
    .range(MatrixColors.slice().reverse())
    .interpolate(d3.interpolateHcl);

  divergingData = [];
  d3.keys(currentData[0]).forEach((col, colIdx) => {
    var obj = {};
    obj[col] = [];
    divergingData.push(obj);
    if (isNumericAttribute(col)) {
      // Sort column ascending for divergence calculation
      let sortedColumn = currentData.slice().sort((a, b) => d3.ascending(+a[col], +b[col]));
      currentData.forEach((row, rowIdx) => {
        obj = {};
        obj[uniqueKey] = currentData[rowIdx][uniqueKey];
        obj['data'] = []
        divergingData[colIdx][col].push(obj);
        let mid = sortedColumn.map((e) => e[uniqueKey]).indexOf(obj[uniqueKey]);
        let point = row;
        for (let i in sortedColumn) {
          let id = sortedColumn[i][uniqueKey];
          let row = [];
          for (let n in divisors) {
            row.push((sortedColumn[i][n] - +point[n]) / divisors[n]);
          }
          obj = {};
          obj[uniqueKey] = id;
          obj['value'] = d3.sum(row, (r) => r);
          let input = i;
          let idx = 5;
          // Remap index to color range
          if (input >= mid) {
            const output_start = 5;
            const output_end = 8;
            const input_start = mid;
            let input_end = currentData.length;
            idx = output_start + ((output_end - output_start) / (input_end - input_start)) * (input - input_start)
            idx = Math.min(Math.max(Math.round(idx), output_start), output_end);
          } else if (input < mid) {
            const output_start = 0;
            const output_end = 5;
            const input_start = 0;
            let input_end = mid;
            idx =
              output_start +
              ((output_end - output_start) / (input_end - input_start)) * (input - input_start);
            idx = Math.min(Math.max(Math.round(idx), output_start), output_end);
          }
          obj['color'] = color(idx);
          divergingData[colIdx][col][rowIdx]['data'].push(obj);
        }
      });
    }
  });

  console.log(`Calculated diverging data.`);
}

/**
 * Determine decisive subspaces for every skyline point.
 * The algorithm is based on:
 * J. Pei, W. Jin, M. Ester, and Y. Tao. Catching the best views of skyline:
 * A semantic approach based on decisive subspaces. In Proceedings of the
 * 31st International Conference on Very Large Data Bases, pages 253–264.
 * VLDB Endowment, 2005
 *
 * @param skyline The current skyline of all points
 * @param subspace The subspace to search
 * @param parentSubspace The subspace of the parent
 */
function determineDecisiveSubspaces(skyline, subspace, parentSubspace) {
  // Calculate skyline for subspace
  let subspaceSkyline = currentDataSkyline.filter(
    (data1) => !currentDataSkyline.filter((data) => data != data1).some((data2) => {
      let point1 = data2; let point2 = data1;
      return (
        subspace.every((column) => +point1[column] >= +point2[column]) &&
        subspace.every((column) => +point1[column] > +point2[column])
      );
    })
  );
  if (skyline.length !== subspaceSkyline.length) {
    // Identify objects that are in parent skyline but not in current
    let x = skyline.filter(d => !subspaceSkyline.some(i => i[uniqueKey] === d[uniqueKey]));
    x.forEach(p => {
      // Create new decisive subspace list for point
      if (!decisiveSubspaces.has(p[uniqueKey]))
        decisiveSubspaces.set(p[uniqueKey], new Map());
      let subs = decisiveSubspaces.get(p[uniqueKey]);

      // Determine if subspace is superspace of already
      // existing subspaces and remove superspaces of
      // subspace
      let isSuperSpace = false;
      subs.forEach((val, key) => {
        let v = parentSubspace.every(v => val.includes(v));
        if (v)
          subs.delete(key);
        else
          isSuperSpace = val.every(v => parentSubspace.includes(v));
      })

      // Add decisive subspace if it is not a superspace
      if (!isSuperSpace)
        subs.set(parentSubspace.join(','), parentSubspace);
    });
  }
  // Search all subspaces of subspace by removing one dimension
  subspace.forEach(d => {
    determineDecisiveSubspaces(subspaceSkyline, subspace.filter(val => val !== d), subspace);
  })
}

/**
 * Build all views. Should be called when new data is loaded or
 * if the current data (or its layout) has changed
 * (e.g. when rearranging the attribute table).
 */
async function buildAll() {
  buildAttributeTable();
  buildProjectionView();
  buildComparisonView();
  buildTabularView();

  // Fix height of table (I'm not able to do it with pure CSS for some reason...)
  const tableTitleHeight = tabularView
    .node()
    .parentElement.querySelector('h2')
    .getBoundingClientRect().height;
  tabularView.classed('h-100', false);
  tabularView.style('height', `calc(100% - ${tableTitleHeight}px - 0.5em)`);
}

/**
 * Build the attribute table.
 * At first, any existing entries are removed and then
 * the table is filled with the attributes of the currently
 * loaded data.
 */
async function buildAttributeTable() {
  attributeTable.selectAll('*').remove();
  attributeTable
    .append('thead')
    .append('tr')
    .selectAll()
    .data(['Attribute Name', 'Attribute Type'])
    .enter()
    .append('th')
    .text((d) => d);
  attributeTable
    .append('tbody')
    .selectAll()
    .data(currentData.columns)
    .enter()
    .append('tr')
    .selectAll()
    .data((column) => [
      column,
      isNumericAttribute(column) ? `num: ${findMinMax(column)}` : 'nominal',
    ])
    .enter()
    .append('td')
    .text((column) => column);
}

/**
 * Build the projection view.
 *
 * DISCLAIMER: The code for the creation of the t-SNE algorithm was inspired by
 * https://bl.ocks.org/Fil/b07d09162377827f1b3e266c43de6d2a and
 * https://bl.ocks.org/Fil/33066cb4f74d35a737355f3b7a2c26b1.
 */
async function buildProjectionView() {
  const { width, height } = projectionView.node().getBoundingClientRect();
  // Calculate positions using t-SNE.
  const model = new tsnejs.tSNE();
  model.initDataDist(
    currentDataSkylineNumericOnly
      .map((data) => Object.values(data))
      .map((data1) =>
        currentDataSkylineNumericOnly
          .map((data) => Object.values(data))
          .map((data2) => d3.geoDistance(data1, data2))
      )
  );

  const dataForceSimulation = currentDataSkylineNumericOnly;
  d3.forceSimulation(dataForceSimulation.map((d) => ({ x: width / 2, y: height / 2, ...d })))
    .alpha(0.1)
    .force('tsne', (alpha) => {
      /*for (let i = 0; i < 5; i++)*/ model.step();
      projectionViewPositions = model.getSolution();
      const { centerX, centerY } = getProjectionViewProps();
      dataForceSimulation.forEach((data, index) => {
        data.x += alpha * (centerX(projectionViewPositions[index][0]) - data.x);
        data.y += alpha * (centerY(projectionViewPositions[index][1]) - data.y);
      });
    })
    .force(
      'collide',
      d3.forceCollide().radius((data) => data.r)
    )
    .on('tick', drawProjectionView)
    .on('end', () => drawProjectionView(true, true));

  model.step();
  projectionViewPositions = model.getSolution();
  drawProjectionView(false);
}

/**
 * Draw the projection view with positions given in {@link projectionViewPositions}.
 *
 * @param {boolean} update If true, the projection view gets updated. If false, the
 * projection view gets recreated.
 * @param {boolean} end If true, all listeners are added (false by default to increase performance during simulation).
 */
async function drawProjectionView(update = true, end = false) {
  if (projectionViewPositions == undefined) return;

  const { centerX, centerY } = getProjectionViewProps();
  const dominationScoreColorMin = '#fdf7ed';
  const dominationScoreColorMax = '#91191c';
  const attributeDifferenceBest = '#2662a2';
  const attributeDifferenceWorst = '#a91f2d';
  const attributeDifferenceMiddle = '#f7f8f8';
  const attributeBaseColor = '#9970ab';

  if (!update) {
    projectionView.selectAll('*').remove();
    projectionView
      .selectAll()
      .data(
        currentDataSkyline.map((data, index) => ({
          ...data,
          x: centerX(projectionViewPositions[index][0]),
          y: centerY(projectionViewPositions[index][1]),
        }))
      )
      .enter()
      .append('g')
      .attr('data-index', (d, i) => i)
      .append('circle')
      .attr('r', 4)
      .attr('cx', 0)
      .attr('cy', 0)
      .style('fill', (d, i) =>
        d3.interpolateRgb(
          dominationScoreColorMin,
          dominationScoreColorMax
        )(currentDataSkylineDominationScores.percentage(i))
      );
    projectionView
      .selectAll('g')
      .selectAll()
      .data(d3.pie()(currentDataNumericAttributes.map(() => 1)))
      .enter()
      .append('path')
      .style('fill', function (d, i) {
        if (projectionViewSelectedIndex === undefined) return attributeBaseColor;

        const column = currentDataNumericAttributes[i];
        const index = +d3.select(this.parentNode).attr('data-index');
        const value = currentDataSkylineNumericOnly[index][column];
        const minMax = currentDataSkylineNumericOnlyMinMax[column];
        const valueSelected = currentDataSkylineNumericOnly[projectionViewSelectedIndex][column];
        const valuePercentage = minMax.percentage(value);
        const valueSelectedPercentage = minMax.percentage(valueSelected);
        if (index == projectionViewSelectedIndex) return attributeBaseColor;
        if (value < valueSelected)
          return d3.interpolateRgb(
            attributeDifferenceWorst,
            attributeDifferenceMiddle
          )(valuePercentage / valueSelectedPercentage);
        else
          return d3.interpolateRgb(
            attributeDifferenceMiddle,
            attributeDifferenceBest
          )((valuePercentage - valueSelectedPercentage) / (1 - valueSelectedPercentage));
      })
      .attr(
        'd',
        d3
          .arc()
          .padAngle(0.04)
          .innerRadius(4.5)
          .outerRadius(function (d, i) {
            const column = currentDataNumericAttributes[i];
            const index = +d3.select(this.parentNode).attr('data-index');
            const value = currentDataSkylineNumericOnly[index][column];
            const minMax = currentDataSkylineNumericOnlyMinMax[column];
            return 4.5 + 12 * minMax.percentage(value);
          })
      );
  }

  projectionView.selectAll('g').attr('transform', function () {
    const index = +d3.select(this).attr('data-index');
    const x = centerX(projectionViewPositions[index][0]);
    const y = centerY(projectionViewPositions[index][1]);
    return `translate(${x},${y})`;
  });

  if (end) {
    projectionView
      .selectAll('g')
      .style('cursor', 'pointer')
      .on('mouseover', function (d) {
        const index = +d3.select(this).attr('data-index');
        const x = centerX(projectionViewPositions[index][0]);
        const y = centerY(projectionViewPositions[index][1]);
        d3.select(this).attr('transform', `translate(${x}, ${y}) scale(4)`);
        d3.select(this.parentNode)
          .selectAll('g')
          .sort((a, b) => (a == d ? 1 : -1));
        projectionViewTooltip.selectAll('*').remove();
        projectionViewTooltip.append('div').text(`${Object.keys(d)[PointNameColumnIndex]}: ${d[Object.keys(d)[PointNameColumnIndex]]}`);
        projectionViewTooltip
          .append('div')
          .text(`Domination score: ${currentDataSkylineDominationScores.scores[index]}`);
        projectionViewTooltip.style('display', 'block');

        const { width, height } = projectionViewTooltip.node().getBoundingClientRect();
        projectionViewTooltip
          .style('left', `${x - width / 2}px`)
          .style('top', `${y - height - 25}px`);

        // Scroll tabularView to matched entry
        let r = tabularView.select("[key='" + d[uniqueKey] + "']");
        r.node().scrollIntoView(true);
        // Account for fixed header and scroll back a bit
        let div = tabularView.select('.table-responsive');
        div.node().scrollBy(0, -100);
      })
      .on('mouseout', function () {
        const index = +d3.select(this).attr('data-index');
        const x = centerX(projectionViewPositions[index][0]);
        const y = centerY(projectionViewPositions[index][1]);
        d3.select(this).attr('transform', `translate(${x},${y}) scale(1)`);
        projectionViewTooltip.style('display', 'none');
      })
      .on('click', (d, i) => selectSkylinePoint(i))
      .on('dblclick', function (d, i) {
        projectionViewSelectedIndex = projectionViewSelectedIndex === undefined ? i : undefined;
        drawProjectionView(false, true);
      });
  }
}

/**
 * Calculates the properties needed to build, draw and process the projeciton view.
 *
 * @returns {{
 * centerX: d3.ScaleLinear<number, number>,
 * centerY: d3.ScaleLinear<number, number>
 * }} projection view properties
 */
function getProjectionViewProps() {
  const { width, height } = projectionView.node().getBoundingClientRect();
  const margin = 15;
  return {
    centerX: d3
      .scaleLinear()
      .range([margin, width - margin])
      .domain(d3.extent(projectionViewPositions.map((pos) => pos[0]))),
    centerY: d3
      .scaleLinear()
      .range([margin, height - margin])
      .domain(d3.extent(projectionViewPositions.map((pos) => pos[1]))),
  };
}

/**
 * Build the comparison view.
 */
async function buildComparisonView() {
  const glyphAttributes = [
    [{ x: 0.5, y: 0.5, scale: 1.0, color: '#5199cd' }],
    [
      { x: 0.5, y: 0.8, scale: 0.5, color: '#5199cd' },
      { x: 0.5, y: 0.2, scale: 0.5, color: '#f57466' },
    ],
    [
      { x: 0.5, y: 0.8, scale: 0.33, color: '#5199cd' },
      { x: 0.8, y: 0.2, scale: 0.33, color: '#f57466' },
      { x: 0.2, y: 0.2, scale: 0.33, color: '#968cd4' },
    ],
    [
      { x: 0.5, y: 0.875, scale: 0.25, color: '#5199cd' },
      { x: 0.875, y: 0.5, scale: 0.25, color: '#f57466' },
      { x: 0.5, y: 0.125, scale: 0.25, color: '#968cd4' },
      { x: 0.125, y: 0.5, scale: 0.25, color: '#f6ab55' },
    ],
  ];
  const { width, height } = comparisonView.node().getBoundingClientRect();
  const lineLength = 150;
  const textMargin = 25;
  const circleMaxRadius = 15;

  const linePosX = (index) => Math.sin((index / currentDataNumericAttributes.length) * 2 * Math.PI);
  const linePosY = (index) =>
    -Math.cos((index / currentDataNumericAttributes.length) * 2 * Math.PI);

  const xPosOf = (index) => glyphAttributes[selectedSkylinePointIndices.length - 1][index].x;
  const yPosOf = (index) => glyphAttributes[selectedSkylinePointIndices.length - 1][index].y;
  const scaleOf = (index) => glyphAttributes[selectedSkylinePointIndices.length - 1][index].scale;
  const colorOf = (index) => glyphAttributes[selectedSkylinePointIndices.length - 1][index].color;
  const scaleCorrection = (scale) => 1.0 / ((1.0 - scale) * 0.75 + scale);

  comparisonView.selectAll('*').remove();

  const comparisonViewGroupsWithData = comparisonView
    .selectAll()
    .data(selectedSkylinePointIndices)
    .enter()
    .append('g')
    .attr(
      'transform',
      (d, i) => `translate(${width * xPosOf(i)}, ${height * yPosOf(i)}) scale(${0.8 * scaleOf(i)})`
    )
    .attr('pointer-events', 'bounding-box')
    .on('mouseenter', (d, i) =>
      buildComparisonViewOverlay(
        [i],
        [currentDataSkylineDominationScores.scores[selectedSkylinePointIndices[i]]]
      )
    )
    .on('mousemove', updatePositionComparisionViewOverlay)
    .on('mouseleave', (d, i) => closeComparisonViewOverlay());
  const comparisonViewGroupsWithAttributeData = comparisonViewGroupsWithData
    .selectAll()
    .data((d, index) =>
      currentDataNumericAttributes.map((column) => ({
        column,
        indexSkylineAll: d,
        color: colorOf(index),
        scale: scaleOf(index),
      }))
    )
    .enter();
  // Radial lines for each attribute.
  comparisonViewGroupsWithAttributeData
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('y2', (d, i) => lineLength * linePosY(i))
    .attr('x2', (d, i) => lineLength * linePosX(i))
    .style('stroke-width', (d) => 3 * scaleCorrection(d.scale))
    .style('stroke', '#dee2e6');
  // Circle that indicates the domination score.
  comparisonViewGroupsWithData
    .append('circle')
    .attr('r', (d) => lineLength * currentDataSkylineDominationScores.percentage(d))
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('stroke', (d, i) => colorOf(i))
    .attr('stroke-width', (d) => 5 * scaleCorrection(scaleOf(0)))
    .attr(
      'stroke-dasharray',
      (d) => `${5 * scaleCorrection(scaleOf(0))} ${5 * scaleCorrection(scaleOf(0))}`
    )
    .attr('fill', 'none');
  // Line that connects all attribute values.
  comparisonViewGroupsWithData
    .append('path')
    .attr('d', (d) => {
      const linePositions = currentDataNumericAttributes.map((column, i) => [
        lineLength *
          linePosX(i) *
          currentDataSkylineNumericOnlyMinMax[column].percentage(
            currentDataSkylineNumericOnly[d][column]
          ),
        lineLength *
          linePosY(i) *
          currentDataSkylineNumericOnlyMinMax[column].percentage(
            currentDataSkylineNumericOnly[d][column]
          ),
      ]);
      return d3.line()(
        linePositions.length > 0 ? [...linePositions, linePositions[0]] : linePositions
      );
    })
    .attr('stroke', (d, i) => colorOf(i))
    .attr('stroke-width', (d) => 4 * scaleCorrection(scaleOf(0)))
    .attr('fill', 'none');
  // One circle per attribute.
  // The position of the circle along the attribute axis represents
  // the the absolute attribute value (between the min and the max value of the attribute).
  // The radius of the circle represents the relative ranking of the attribute.
  comparisonViewGroupsWithAttributeData
    .append('circle')
    .attr(
      'r',
      (d) =>
        circleMaxRadius *
        currentDataSkylineNumericOnlyRelativeRankings[d.indexSkylineAll].get(d.column)
    )
    .attr(
      'cx',
      (d, i) =>
        lineLength *
        linePosX(i) *
        currentDataSkylineNumericOnlyMinMax[d.column].percentage(
          currentDataSkylineNumericOnly[d.indexSkylineAll][d.column]
        )
    )
    .attr(
      'cy',
      (d, i) =>
        lineLength *
        linePosY(i) *
        currentDataSkylineNumericOnlyMinMax[d.column].percentage(
          currentDataSkylineNumericOnly[d.indexSkylineAll][d.column]
        )
    )
    .attr('fill', (d) => d.color);
  // Labels for the attributes.
  comparisonViewGroupsWithAttributeData
    .append('text')
    .text((d) => d.column)
    .attr('x', (d, i) => (lineLength + textMargin) * linePosX(i))
    .attr('y', (d, i) => (lineLength + textMargin) * linePosY(i))
    .attr('text-anchor', 'middle')
    .attr('fill', 'black')
    .attr('font-size', (d) => 18 * scaleCorrection(d.scale));
  // Identifier (e.g. name) of the glyph.
  comparisonViewGroupsWithData
    .append('text')
    .text((d) => currentDataSkyline[d][currentData.columns[PointNameColumnIndex]])
    .attr('x', (d) => -lineLength - 75)
    .attr('y', (d) => -lineLength - 75)
    .attr('text-anchor', 'start')
    .attr('fill', (d, i) => colorOf(i))
    .attr('font-size', (d) => 36 * scaleCorrection(scaleOf(0)));

  // Domination glyphs and the lines connecting them.
  if (selectedSkylinePointIndices.length > 1) {
    const dominationGlyphBuildAttributes = [
      [{ nodes: [0, 1], offsetX: 0, offsetY: 0 }],
      [
        { nodes: [0, 1], offsetX: 0, offsetY: 0 },
        { nodes: [0, 2], offsetX: 0, offsetY: 0 },
        { nodes: [1, 2], offsetX: 0, offsetY: 0 },
        { nodes: [0, 1, 2], offsetX: 0, offsetY: 0 },
      ],
      [
        { nodes: [0, 1], offsetX: 0, offsetY: 0 },
        { nodes: [1, 2], offsetX: 0, offsetY: 0 },
        { nodes: [2, 3], offsetX: 0, offsetY: 0 },
        { nodes: [3, 0], offsetX: 0, offsetY: 0 },
        { nodes: [0, 2], offsetX: 0.1, offsetY: 0 },
        { nodes: [1, 3], offsetX: -0.1, offsetY: 0 },
        { nodes: [0, 1, 2], offsetX: 0.1, offsetY: 0 },
        { nodes: [0, 1, 3], offsetX: 0, offsetY: 0.1 },
        { nodes: [0, 2, 3], offsetX: -0.1, offsetY: 0 },
        { nodes: [1, 2, 3], offsetX: 0, offsetY: -0.1 },
        { nodes: [0, 1, 2, 3], offsetX: 0, offsetY: 0 },
      ],
    ];
    const dominationGlyphAttributes = dominationGlyphBuildAttributes[
      selectedSkylinePointIndices.length - 2
    ].map((buildAttributes) => ({
      x:
        buildAttributes.nodes.reduce((glyphPosX, nodeIndex) => glyphPosX + xPosOf(nodeIndex), 0) /
          buildAttributes.nodes.length +
        buildAttributes.offsetX,
      y:
        buildAttributes.nodes.reduce((glyphPosY, nodeIndex) => glyphPosY + yPosOf(nodeIndex), 0) /
          buildAttributes.nodes.length +
        buildAttributes.offsetY,
      colors: buildAttributes.nodes.map((nodeIndex) => colorOf(nodeIndex)),
      dominationScores: buildAttributes.nodes.map(
        (nodeIndex) =>
          currentDataSkylineDominationScores.scores[selectedSkylinePointIndices[nodeIndex]]
      ),
      exclusiveDominationScores: buildAttributes.nodes.map(
        (nodeIndex) =>
          currentDataSkylineDominationScores.dominatedPoints[
            selectedSkylinePointIndices[nodeIndex]
          ].filter(
            (dominatedPoint) =>
              !buildAttributes.nodes
                .filter((i) => i != nodeIndex)
                .some((i) =>
                  currentDataSkylineDominationScores.dominatedPoints[
                    selectedSkylinePointIndices[i]
                  ].includes(dominatedPoint)
                )
          ).length
      ),
      nodes: buildAttributes.nodes,
    }));

    // Lines connecting domination glyphs with glyphs of selected points.
    comparisonView
      .selectAll()
      .data(
        dominationGlyphAttributes.map((glyphAttributes) =>
          glyphAttributes.nodes.map((nodeIndex) => ({
            _pos1: new Victor(glyphAttributes.x, glyphAttributes.y),
            _pos2: new Victor(xPosOf(nodeIndex), yPosOf(nodeIndex)),
            dir: function () {
              return this._pos2
                .clone()
                .subtract(this._pos1)
                .multiply(new Victor(width, height))
                .normalize();
            },
            pos1: function () {
              return this._pos1
                .clone()
                .multiply(new Victor(width, height))
                .add(this.dir().multiply(new Victor(15, 15)));
            },
            pos2: function () {
              return this._pos2
                .clone()
                .multiply(new Victor(width, height))
                .subtract(
                  this.dir()
                    .multiply(new Victor(lineLength + textMargin, lineLength + textMargin))
                    .multiply(new Victor(scaleOf(0), scaleOf(0)))
                );
            },
          }))
        )
      )
      .enter()
      .append('g')
      .selectAll()
      .data((d) => d)
      .enter()
      .append('line')
      .attr('x1', (d) => d.pos1().x)
      .attr('y1', (d) => d.pos1().y)
      .attr('x2', (d) => d.pos2().x)
      .attr('y2', (d) => d.pos2().y)
      .style('stroke-width', 2)
      .style('stroke', '#dee2e6');

    // Domination glyphs.
    const dominationGlyphsWithData = comparisonView
      .selectAll()
      .data(dominationGlyphAttributes)
      .enter()
      .append('g')
      .attr('data-index', (d, i) => i)
      .attr('transform', (d) => `translate(${width * d.x}, ${height * d.y})`);
    // Inner pie chart representing domination scores.
    dominationGlyphsWithData
      .selectAll()
      .data((d) => d3.pie().sort(null)(d.dominationScores))
      .enter()
      .append('path')
      .style('fill', function (d, i) {
        const index = +d3.select(this.parentNode).attr('data-index');
        return dominationGlyphAttributes[index].colors[i];
      })
      .attr('d', d3.arc().padAngle(0.04).innerRadius(0).outerRadius(15))
      .on('mouseenter', function (d) {
        const index = +d3.select(this.parentNode).attr('data-index');
        const nodes = dominationGlyphAttributes[index].nodes;
        buildComparisonViewOverlay(
          nodes,
          nodes.map(
            (nodeIndex) =>
              currentDataSkylineDominationScores.scores[selectedSkylinePointIndices[nodeIndex]]
          )
        );
      })
      .on('mousemove', updatePositionComparisionViewOverlay)
      .on('mouseleave', closeComparisonViewOverlay);
    // Outer pie chart reprsenting exclusive domination scores.
    dominationGlyphsWithData
      .selectAll()
      .data((d) =>
        d3.pie().sort(null)(
          d.exclusiveDominationScores.reduce(
            (result, current, index) => [
              ...result,
              (d.dominationScores[index] - current) / 2,
              current,
              (d.dominationScores[index] - current) / 2,
            ],
            []
          )
        )
      )
      .enter()
      .append('path')
      .style('fill', function (d, i) {
        if (i % 3 != 1) return 'transparent';
        const glyphIndex = +d3.select(this.parentNode).attr('data-index');
        const index = (i - 1) / 3;
        return dominationGlyphAttributes[glyphIndex].colors[index];
      })
      .attr('d', d3.arc().padAngle(0.04).innerRadius(16).outerRadius(20))
      .on('mouseover', function (d) {
        const index = +d3.select(this.parentNode).attr('data-index');
        const nodes = dominationGlyphAttributes[index].nodes;
        buildComparisonViewOverlay(
          nodes,
          dominationGlyphAttributes[index].exclusiveDominationScores
        );
      })
      .on('mousemove', updatePositionComparisionViewOverlay)
      .on('mouseleave', closeComparisonViewOverlay);
  }

  function buildComparisonViewOverlay(nodeIndices, values) {
    const mousePos = d3.mouse(comparisonViewOverlay.node().parentElement);
    comparisonViewOverlaySvg.selectAll('*').remove();
    comparisonViewOverlaySvg.attr('width', '400px').attr('height', '450px');
    comparisonViewOverlay
      .style('width', '400px')
      .style('height', '450px')
      .style('left', `${mousePos[0] + 10}px`)
      .style('top', `${mousePos[1] + 10}px`);
    const overlayGroup = comparisonViewOverlaySvg
      .append('g')
      .attr('transform', `translate(200, 275) scale(0.8)`);
    const overlayGroupWithData = overlayGroup
      .selectAll()
      .data(nodeIndices.map((nodeIndex) => selectedSkylinePointIndices[nodeIndex]))
      .enter();
    const overlayGroupWithAttributeData = overlayGroupWithData
      .selectAll()
      .data((d, index) =>
        currentDataNumericAttributes.map((column) => ({
          column,
          indexSkylineAll: d,
          color: colorOf(nodeIndices[index]),
        }))
      )
      .enter();

    // The following density plot was inspired by https://www.d3-graph-gallery.com/graph/density_basic.html
    overlayGroup
      .selectAll()
      .data(
        currentDataNumericAttributes.map((column) =>
          currentDataSkylineNumericOnly.map((point) => +point[column]).sort()
        )
      )
      .enter()
      .each(function (d, i) {
        const chartHeight = d3.scaleLinear().domain([1, 20]).range([30, 10])(
          currentDataNumericAttributes.length
        );

        // Calculate the max x-value of parameter by including the first
        // two fraction-digits
        const xMin = Math.round(Math.min(...d) * 100.0) / 100.0;
        const xMax = Math.round(Math.max(...d) * 100.0) / 100.0;
        const xScale = d3.scaleLinear().domain([xMin, xMax]).nice().range([0, lineLength]);

        // The y-Axis represents the value distribution of all
        // the data which is calculated using d3's historam
        const hist = d3
          .histogram()
          .domain(xScale.domain())
          .thresholds(xScale.ticks(d.length / 2))
          .value((d) => d);

        // The max value of the y-Axis is the length of the bin
        const yMax = d3.max(hist(d), (d) => d.length);
        const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([chartHeight, 0]);

        // Add a rect, containing an area chart showing the distribution
        // of the all the data
        d3.select(this)
          .append('path')
          .attr(
            'd',
            d3
              .area()
              .x((d) => xScale(+d.x0))
              .y0(chartHeight)
              .y1((d) => yScale(+d.length))(hist(d))
          )
          .attr('width', lineLength)
          .attr('height', chartHeight)
          .attr('fill', '#9a9da1')
          .attr('opacity', 0.5)
          .style(
            'transform',
            `rotate(${
              360 * (i / currentDataNumericAttributes.length) - 90
            }deg) translate(0px, -${chartHeight}px)`
          );
        d3.select(this)
          .append('path')
          .attr(
            'd',
            d3
              .area()
              .x((d) => xScale(+d.x0))
              .y0(chartHeight)
              .y1((d) => yScale(+d.length))(hist(d))
          )
          .attr('width', lineLength)
          .attr('height', chartHeight)
          .attr('fill', '#9a9da1')
          .attr('opacity', 0.5)
          .style(
            'transform',
            `rotate(${
              360 * (i / currentDataNumericAttributes.length) - 90
            }deg) scaleY(-1) translate(0px, -${chartHeight}px)`
          );
      });

    // Radial lines for each attribute.
    overlayGroup
      .selectAll()
      .data(currentDataNumericAttributes)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('y2', (d, i) => lineLength * linePosY(i))
      .attr('x2', (d, i) => lineLength * linePosX(i))
      .style('stroke-width', 2)
      .style('stroke', '#9a9da1');
    // Line that connects all attribute values.
    overlayGroupWithData
      .append('path')
      .attr('d', (d) => {
        const linePositions = currentDataNumericAttributes.map((column, i) => [
          lineLength *
            linePosX(i) *
            currentDataSkylineNumericOnlyMinMax[column].percentage(
              currentDataSkylineNumericOnly[d][column]
            ),
          lineLength *
            linePosY(i) *
            currentDataSkylineNumericOnlyMinMax[column].percentage(
              currentDataSkylineNumericOnly[d][column]
            ),
        ]);
        return d3.line()(
          linePositions.length > 0 ? [...linePositions, linePositions[0]] : linePositions
        );
      })
      .attr('stroke', (d, i) => colorOf(nodeIndices[i]))
      .attr('stroke-width', 4)
      .attr('fill', 'none');

    if (nodeIndices.length == 1) {
      // Circle that indicates the domination score.
      overlayGroupWithData
        .append('circle')
        .attr('r', (d) => lineLength * currentDataSkylineDominationScores.percentage(d))
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('stroke', (d, i) => colorOf(nodeIndices[i]))
        .attr('stroke-width', 5)
        .attr('stroke-dasharray', '5 5')
        .attr('fill', 'none');
      // One circle per attribute.
      // The position of the circle along the attribute axis represents
      // the the absolute attribute value (between the min and the max value of the attribute).
      // The radius of the circle represents the relative ranking of the attribute.
      overlayGroupWithAttributeData
        .append('circle')
        .attr(
          'r',
          (d) =>
            circleMaxRadius *
            currentDataSkylineNumericOnlyRelativeRankings[d.indexSkylineAll].get(d.column)
        )
        .attr(
          'cx',
          (d, i) =>
            lineLength *
            linePosX(i) *
            currentDataSkylineNumericOnlyMinMax[d.column].percentage(
              currentDataSkylineNumericOnly[d.indexSkylineAll][d.column]
            )
        )
        .attr(
          'cy',
          (d, i) =>
            lineLength *
            linePosY(i) *
            currentDataSkylineNumericOnlyMinMax[d.column].percentage(
              currentDataSkylineNumericOnly[d.indexSkylineAll][d.column]
            )
        )
        .attr('fill', (d) => d.color);
    }

    // Labels for the attributes.
    overlayGroup
      .selectAll()
      .data(currentDataNumericAttributes)
      .enter()
      .append('text')
      .text((d) => d)
      .attr('x', (d, i) => (lineLength + textMargin) * linePosX(i))
      .attr('y', (d, i) => (lineLength + textMargin) * linePosY(i))
      .attr('text-anchor', 'middle')
      .attr('fill', 'black')
      .attr('font-size', 18);

    const overlayTextGroup = comparisonViewOverlaySvg
      .append('g')
      .attr('transform', `translate(0, ${(4 - nodeIndices.length) * 12.5})`)
      .selectAll()
      .data(
        nodeIndices.map((nodeIndex) => ({
          nodeIndex,
          data: currentDataSkyline[selectedSkylinePointIndices[nodeIndex]],
        }))
      )
      .enter();
    overlayTextGroup
      .append('text')
      .text((d) => d.data[Object.keys(d.data)[PointNameColumnIndex]])
      .attr('x', 25)
      .attr('y', (d, i) => 25 + i * 25)
      .attr('text-anchor', 'start')
      .attr('fill', (d) => colorOf(d.nodeIndex))
      .attr('font-size', 16)
      .attr('font-weight', 'bold');
    overlayTextGroup
      .append('text')
      .text((d, i) => values[i])
      .attr('x', 400 - 25)
      .attr('y', (d, i) => 25 + i * 25)
      .attr('text-anchor', 'end')
      .attr('fill', (d) => colorOf(d.nodeIndex))
      .attr('font-size', 16)
      .attr('font-weight', 'bold');

    comparisonViewOverlay.style('display', 'block');
  }

  function updatePositionComparisionViewOverlay() {
    const mousePos = d3.mouse(comparisonViewOverlay.node().parentElement);
    comparisonViewOverlay
      .style('left', `${mousePos[0] + 10}px`)
      .style('top', `${mousePos[1] + 10}px`);
  }

  function closeComparisonViewOverlay() {
    comparisonViewOverlay.style('display', 'none');
  }

  // The following two functions were taken from https://www.d3-graph-gallery.com/graph/density_basic.html
  // Function to compute density
  function kernelDensityEstimator(kernel, X) {
    return function (V) {
      return X.map(function (x) {
        return [
          x,
          d3.mean(V, function (v) {
            return kernel(x - v);
          }),
        ];
      });
    };
  }
  function kernelEpanechnikov(k) {
    return function (v) {
      return Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
    };
  }
}

/**
 * Filter a key/value pair according to filter string
 * @param key The key, i.e column
 * @param value The value, i.e value in column
 * @param arg The filter argument (col = val, col < val, col > val)
 * @returns {boolean}
 */
function filterData(key, value, arg) {
  let result = false;
  let op = arg.indexOf('=') > 0 ? '=' :
    arg.indexOf('>') > 0 ? '>' :
      arg.indexOf('<') > 0 ? '<' : '';

  let parts = arg.split(op);
  parts.forEach(d => d.trim())

  let k = key.toLowerCase();
  let v = value.toLowerCase();

  switch(op) {
    case '=':
      if (parts.length < 2) return false;
      if (k === (parts[0].trim())) {
        result = (v === parts[1].trim());
      }
      break;
    case '>':
      if (parts.length < 2) return false;
      if (k === (parts[0].trim())) {
        result = (+v > +parts[1].trim());
      }
      break;
    case '<':
      if (parts.length < 2) return false;
      if (k === (parts[0].trim())) {
        result = (+v < +parts[1].trim());
      }
      break;
    default:
      result = !isNumericAttribute(key) &&
        v.indexOf(arg.trim().toLowerCase()) >= 0
  }
  return result;
}

/**
 * Build the tabular view.
 */
async function buildTabularView() {
  // Remove everything from the view
  tabularView.selectAll('*').remove();

  let controls = tabularView.append('div').attr('class', 'controls');

  // dataset represents skyline and dominated points
  let dataset = currentDataSkyline.concat(currentDataDominated);

  // Create table
  let div = tabularView.append('div').attr('class', 'table-responsive table-fixed');
  let table = div.append('table').attr('class', 'table');

  let columns = buildTabularViewTable(table, dataset);
  let rows = buildTabularViewTableBody(table, columns);

  // Initially only show skyline rows
  table.selectAll('tr.dominated-row').style('display', 'none');

  // Radiobutton to show only skyline data
  controls
    .append('input')
    .attr('type', 'radio')
    .attr('class', 'tabViewRdBtn')
    .attr('checked', 'true')
    .attr('value', 'skyline')
    .attr('name', 'toggle')
    .attr('id', 'rdskyline')
    .on('click', function () {
      table.selectAll('tr.dominated-row').style('display', 'none');
      table.selectAll('tr.skyline-row').style('display', null);
      controls.select('.tabViewLblItemCount').html(currentDataSkyline.length + ' items');
    })
    .html('Skyline Data');
  controls
    .append('label')
    .attr('for', 'rdskyline')
    .attr('class', 'tabViewLbl')
    .html('Skyline Data');

  // Radiobutton to show only dominated data
  controls
    .append('input')
    .attr('type', 'radio')
    .attr('class', 'tabViewRdBtn')
    .attr('value', 'dominated')
    .attr('name', 'toggle')
    .attr('id', 'rddominated')
    .on('click', function () {
      table.selectAll('tr.dominated-row').style('display', null);
      table.selectAll('tr.skyline-row').style('display', 'none');
      controls.select('.tabViewLblItemCount').html(currentDataDominated.length + ' items');
    });
  controls
    .append('label')
    .attr('for', 'rddominated')
    .attr('class', 'tabViewLbl')
    .html('Dominated Data');

  // Radiobutton to show both, skyline and dominated data
  controls
    .append('input')
    .attr('type', 'radio')
    .attr('class', 'tabViewRdBtn')
    .attr('value', 'all')
    .attr('name', 'toggle')
    .attr('id', 'rdall')
    .on('click', function () {
      table.selectAll('tr.dominated-row').style('display', null);
      table.selectAll('tr.skyline-row').style('display', null);
      controls.select('.tabViewLblItemCount').html(currentData.length + ' items');
    });
  controls.append('label').attr('for', 'rdall').attr('class', 'tabViewLbl').html('All Data');

  // Input textbox for highlighting matched points
  let fin = controls
    .append('input')
    .attr('type', 'text')
    .attr('class', 'tabViewTxt')
    .attr('id', 'tabTxtFilter')
    .on('keyup', (ev) => {
      if (d3.event.key === 'Enter') {
        controls.select('#tabBtnFilter').node().click();
      }
    });

  // Button to highlight points that match inputted text
  controls
    .append('input')
    .attr('type', 'button')
    .attr('class', 'tabViewBtn')
    .attr('value', 'Filter Skyline')
    .attr('id', 'tabBtnFilter')
    .on('click', function () {
      let stxt = fin.node().value;
      let entry = currentData.filter((row) => {
        return d3.entries(row).some((d) => filterData(d.key, d.value, stxt));
      });
      // Remove previous colored entries
      rows.selectAll('td').classed('highlight', false);
      // Dont color anything if all or no entries match
      if (entry.length === currentData.length || entry.length === 0) return;
      // Color nominal values of matches in red
      entry.forEach((row) => {
        let r = rows.selectAll("[key='" + row[uniqueKey] + "'] td");
        r.classed('highlight', true);
      });
      // Scroll to first matched entry
      let r = tabularView.select("[key='" + entry[0][uniqueKey] + "']");
      r.node().scrollIntoView(true);
      // Account for fixed header and scroll back a bit
      div.node().scrollBy(0, -100);
    });

  // Show number of items in table
  controls
    .append('label')
    .attr('class', 'tabViewLblItemCount')
    .html(currentDataSkyline.length + ' items');

  // Move element to front by changing the
  // order of the object. Needed to move hovered
  // lines on the distribution chart to the front
  // if they are overlapping with other points
  // From: https://gist.github.com/trtg/3922684
  d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
      this.parentNode.appendChild(this);
    });
  };
}

/**
 * Build the table of the tabular view
 *
 * @param {table} table The table to build the header for
 * @returns {columns} Returns the columns of the table
 */
function buildTabularViewTable(table) {
  // Clear head
  table.selectAll('thead').selectAll('*').remove();

  // Create table header with column names
  let columns = d3.keys(currentData[0]);
  table
    .append('thead')
    .append('tr')
    .selectAll('th')
    .data(columns)
    .enter()
    .append('th')
    .text((d) => d);

  let header = new Array();
  header.columns = currentData.columns;
  header.push(currentData[0]);

  const rowsHead = table.select('thead').selectAll().data(header).enter().append('tr');

  // Add plots to show value distribution of all data as
  // the first row (includes skyline and dominated points)
  columns.forEach((col, colIdx) => {
    // Draw chart for numeric attributes
    if (isNumericAttribute(col)) {
      let chartCol = rowsHead.append('th').attr('class', 'number');
      const svg = chartCol
        .append('svg')
        .attr('class', 'area-dist-chart')
        .attr('width', cellWidth)
        .attr('height', cellHeight);

      // Calculate the max x-value of parameter by including the first
      // two fraction-digits
      const xMax = Math.round(d3.max(currentData, (n) => +n[col]) * 100.0) / 100.0;
      const xScale = d3.scaleLinear().domain([0, xMax]).nice().range([0, cellWidth]);

      // The y-Axis represents the value distribution of all
      // the data which is calculated using d3's historam
      const hist = d3
        .histogram()
        .domain(xScale.domain())
        .thresholds(xScale.ticks(currentData.length / 2))
        .value((d) => +d[col]);

      // The max value of the y-Axis is the length of the bin
      const yMax = d3.max(hist(currentData), (d) => d.length);
      const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([cellHeight, 0]);

      // Add a rect, containing an area chart showing the distribution
      // of the all the data
      svg
        .selectAll('rect')
        .data([hist(currentData)])
        .enter()
        .append('path')
        .attr(
          'd',
          d3
            .area()
            .x((d) => xScale(+d.x0))
            .y0(cellHeight)
            .y1((d) => yScale(+d.length))
        )
        .attr('width', cellWidth)
        .attr('height', cellHeight);

      // Show all points as vertical lines
      svg
        .selectAll('rect')
        .data(currentData)
        .enter()
        .append('line')
        .attr('y1', 0)
        .attr('y2', cellHeight)
        .attr('class', (d) => 'skl' + '-' + d[uniqueKey])
        .attr('x1', (d) => xScale(+d[col]))
        .attr('x2', (d) => xScale(+d[col]));
    } else {
      // Empty td's for nominal columns
      rowsHead.append('th');
    }
  });
  return columns;
}

/**
 * Build the body of the tabular view table
 *
 * @param {table} table The table to build the body for
 * @param {columns} columns The columns of the table
 * @returns {columns} Returns the rows of the body
 */
function buildTabularViewTableBody(table, columns) {
  // Clear body
  table.selectAll('tbody').selectAll('*').remove();

  // Add body for data table
  let rows = table
    .append('tbody')
    .selectAll('tr')
    .data(currentData)
    .enter()
    .append('tr')
    .attr('key', (d) => d[uniqueKey])
    .attr('id', (d, i) => i + 1)
    .attr('class', d => {
      let idx = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
      if (idx >= 0) {
        return 'skyline-row';
      } else {
        return 'dominated-row';
      }
    });

  // Tooltip to show when numeric cell is hovered
  let tabularTooltip = d3.select('#tabular-view').append('div').attr('class', 'tool-tip');

  // Fill data table with nominal values or diverging
  // bar-charts showing the difference between skyline points
  columns.forEach((col, colIdx) => {
    // Fill numeric columns with bar-charts
    if (isNumericAttribute(col)) {
      // Fill whole column with td's
      let chartCol = rows.append('td').attr('class', 'number');

      // Create a bar-chart in each td of the column
      chartCol.each(function (row, rowIdx) {
        const svg = d3
          .select(this)
          .append('svg')
          .attr('class', 'divergence-chart')
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .on('mouseover', function (d) {
            tabularTooltip.style('display', 'block');
            // Display column name and row value in tooltip
            tabularTooltip.html(col + ': ' + d[col]);

            let c = this.getBoundingClientRect();
            let p = document.getElementById('tabular-view').getBoundingClientRect();
            const tooltipwidth = tabularTooltip.node().getBoundingClientRect().width;
            // Calculate tooltip position so that it is left of the diagram
            let left = c.left - p.left - tooltipwidth;
            let top = c.top - p.top + cellHeight / 2 - 14;
            tabularTooltip.style('left', left + 'px').style('top', top + 'px');
            d3.select(this).style('background-color', '#d3d3d3');
            d3.selectAll('.skl' + '-' + d[uniqueKey])
              .classed('highlight', true)
              .moveToFront();

            // Highlight projection view glyph
            const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (index < 0) return;
            const node = projectionView.select("[data-index='" + index + "']");
            const { centerX, centerY } = getProjectionViewProps();
            const x = centerX(projectionViewPositions[index][0]);
            const y = centerY(projectionViewPositions[index][1]);
            node.attr('transform', `translate(${x}, ${y}) scale(4)`);
            d3.select(node.node().parentNode)
              .selectAll('g')
              .sort((a, b) => (a[uniqueKey] === d[uniqueKey] ? 1 : -1) );
            projectionViewTooltip.selectAll('*').remove();
            projectionViewTooltip.append('div').text(`${Object.keys(d)[PointNameColumnIndex]}: ${d[Object.keys(d)[PointNameColumnIndex]]}`);
            projectionViewTooltip
              .append('div')
              .text(`Domination score: ${currentDataSkylineDominationScores.scores[index]}`);
            projectionViewTooltip.style('display', 'block');

            const { width, height } = projectionViewTooltip.node().getBoundingClientRect();
            projectionViewTooltip
              .style('left', `${x - width / 2}px`)
              .style('top', `${y - height - 25}px`);
          })
          .on('mouseout', function (d) {
            tabularTooltip.style('display', 'none');
            d3.select(this).style('background-color', '#FFFFFF');
            d3.selectAll('.skl' + '-' + d[uniqueKey]).classed('highlight', false);

            // De-Highlight projection view glyph
            const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (index < 0) return;
            const node = projectionView.select("[data-index='" + index + "']");
            const { centerX, centerY } = getProjectionViewProps();
            const x = centerX(projectionViewPositions[index][0]);
            const y = centerY(projectionViewPositions[index][1]);
            node.attr('transform', `translate(${x},${y}) scale(1)`);
            projectionViewTooltip.style('display', 'none');
          })
          .on('click', function (d) {
            let idx = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (idx >= 0) {
              selectSkylinePoint(
                currentDataSkyline.findIndex((r) => {
                  return r[uniqueKey] === d[uniqueKey];
                })
              );
            }
          });
        let data = divergingData[colIdx][col][rowIdx]['data'];

        // Create scale for the x-axis. Scaleband splits the range into
        // n bands where n is the number of values in the range. The
        // x-axis shows how the point performs in the other dimensions
        let xScale = d3
          .scaleBand()
          .range([0, cellWidth])
          .paddingInner(0.5)
          .domain(data.map((d, i) => i));

        // The y-Axis represents the differences in all dimensions,
        // a positive value indicates positive difference
        let yMax = Math.max(
          Math.abs(d3.min(data, (d) => d['value'])),
          Math.abs(d3.max(data, (d) => d['value']))
        );
        let yScale = d3.scaleLinear().range([0, cellHeight]).domain([yMax, -yMax]);

        const dom = currentDataDominated.indexOf(row);

        // Draw baseline (bars above are positive diffs, values below negative)
        svg
          .append('g')
          .attr('class', 'baseline')
          .append('line')
          .attr('y1', yScale(0))
          .attr('y2', yScale(0))
          .attr('x1', 0)
          .attr('x2', cellWidth);

        // Draw bars showing the differences in all dimension and
        // show the bar of the current point in a different color
        // and in full y cell height
        svg
          .selectAll('rect')
          .data(
            data.filter(e =>
              currentData.find(({uniqueKey}) =>
                e[uniqueKey] === uniqueKey
              )
            )
          )
          .enter()
          .append('rect')
          .attr('x', (d, i) => xScale(i))
          .attr('y', (d, i) => {
            if (d[uniqueKey] === row[uniqueKey]) {
              return yScale(yMax);
            } else {
              if (+d['value'] < 0) {
                return cellHeight / 2;
              } else {
                return yScale(+d['value']);
              }
            }
          })
          .attr('class', (d, i) => {
            if (dom >= 0) {
              return 'divergence-chart-bar-dominated' + ' key-' + d[uniqueKey];
            }
            if (d[uniqueKey] === row[uniqueKey]) {
              return 'divergence-chart-bar-highlight' + ' key-' + d[uniqueKey];
            } else {
              return 'divergence-chart-bar' + ' key-' + d[uniqueKey];
            }
          })
          .attr('width', Math.max(xScale.bandwidth(), 1))
          .attr('yMax', function (d) {
            return Math.max(Math.abs(d3.min(d['value'])), Math.abs(d3.max(d['value'])));
          })
          .attr('height', function (d, i) {
            // Show current point with full height of cell
            if (d[uniqueKey] === row[uniqueKey]) {
              return cellHeight;
            } else {
              return cellHeight / 2 - yScale(Math.abs(+d['value']));
            }
          });

        // Small span between summary and detail matrix
        d3.select(this)
          .append('span')
          .attr('class', 'detail-matrix detail-matrix-span')
          .style('display', 'none')
          .style('width', '100%')
          .style('height', '5px');
      });
    } else {
      // Fill nominal columns with the value (id, name, etc)
      let td = rows
        .append('td')
        .attr('class', 'nominal')
        .style('cursor', 'pointer')
        .on('click', function (d) {
          let dm = tabularView.select("[key='" + d[uniqueKey] + "']").selectAll('.detail-matrix');
          if (dm.style('display') === 'none') {
            createDetailMatrix(
              currentData,
              tabularView.select("[key='" + d[uniqueKey] + "']"),
              d[uniqueKey]
            );
            dm.style('display', 'inline-flex');
          } else {
            dm.style('display', 'none');
            tabularView
              .select("[key='" + d[uniqueKey] + "']")
              .selectAll('.detail-matrix-body')
              .remove();
          }
        })
        .on('mouseover', function (d) {
          // Highlight projection view glyph
          const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
          if (index < 0) return;
          const node = projectionView.select("[data-index='" + index + "']");
          const { centerX, centerY } = getProjectionViewProps();
          const x = centerX(projectionViewPositions[index][0]);
          const y = centerY(projectionViewPositions[index][1]);
          node.attr('transform', `translate(${x}, ${y}) scale(4)`);
          d3.select(node.node().parentNode)
            .selectAll('g')
            .sort((a, b) => (a[uniqueKey] === d[uniqueKey] ? 1 : -1) );
          projectionViewTooltip.selectAll('*').remove();
          projectionViewTooltip.append('div').text(`${Object.keys(d)[PointNameColumnIndex]}: ${d[Object.keys(d)[PointNameColumnIndex]]}`);
          projectionViewTooltip
            .append('div')
            .text(`Domination score: ${currentDataSkylineDominationScores.scores[index]}`);
          projectionViewTooltip.style('display', 'block');

          const { width, height } = projectionViewTooltip.node().getBoundingClientRect();
          projectionViewTooltip
            .style('left', `${x - width / 2}px`)
            .style('top', `${y - height - 25}px`);
        })
        .on('mouseout', function (d) {
          // De-Highlight projection view glyph
          const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
          if (index < 0) return;
          const node = projectionView.select("[data-index='" + index + "']");
          const { centerX, centerY } = getProjectionViewProps();
          const x = centerX(projectionViewPositions[index][0]);
          const y = centerY(projectionViewPositions[index][1]);
          node.attr('transform', `translate(${x},${y}) scale(1)`);
          projectionViewTooltip.style('display', 'none');
        });

      // Centered text
      td.append('span')
        .style('display', 'inline-flex')
        .style('width', '100%')
        .style('height', cellHeight + 'px')
        .style('align-items', 'center')
        .text((row) => {
          return row[col];
        });

      // Small span between summary and detail matrix
      td.append('span')
        .attr('class', 'detail-matrix')
        .style('display', 'none')
        .style('width', '100%')
        .style('height', '5px');

      if (colIdx === 0) {
        // Add all numeric attribute names on column 0 (id, index, etc)
        d3.keys(currentData[0]).forEach((c, idx) => {
          if (isNumericAttribute(c)) {
            td.append('span')
              .attr('class', 'detail-matrix detail-matrix-header')
              .style('display', 'none')
              .style('width', '100%')
              .text(c);
          }
        });
      }

      // Mark column for decisive subspace indicators
      if (colIdx === 1) {
        td.classed('subspaces', true);
      }
    }
  });
  return rows;
}

/**
 * Creates the detail matrix of an table entry below it
 *
 * @param dataset The dataset to use
 * @param row The table row where the matrix should be appended
 * @param key The unique key of the row in the data
 */
function createDetailMatrix(dataset, row, key) {
  let tabularTooltip = d3.select('#tabular-view').append('div').attr('class', 'tool-tip');
  let colCount = 0;
  d3.keys(dataset[0]).forEach((col, colIdx) => {
    if (isNumericAttribute(col)) {
      const num = row.selectAll('td.number');
      let rowCount = colCount;
      num.each(function (r, i) {
        const detailSvg = d3
          .select(this)
          .append('svg')
          .attr('class', 'detail-matrix detail-matrix-body')
          .attr('width', cellWidth)
          .attr('height', detailCellHeight);

        let o = divergingData[colIdx][col].map((e) => e[uniqueKey]).indexOf(key);
        let data = divergingData[colIdx][col][o]['data'];

        // Create scale for the x-axis. Scaleband splits the range into
        // n bands where n is the number of values in the range. The
        // x-axis shows how the point performs in the other dimensions
        let xScale = d3
          .scaleBand()
          .range([0, cellWidth])
          .paddingInner(0.5)
          .domain(data.map((d, i) => i));

        // Sort values according to divergence bar chart
        let c = d3.keys(dataset[0])[rowCount];
        let first = divergingData[rowCount][c][o]['data'].map((e) => e[uniqueKey]);
        let sorted = data.slice().sort((a, b) => {
          return first.indexOf(a[uniqueKey]) - first.indexOf(b[uniqueKey]);
        });

        detailSvg
          .selectAll('rect')
          .data(sorted)
          .enter()
          .append('rect')
          .attr('x', (d, i) => {
            let a = xScale(i);
            return xScale(i);
          })
          .attr('y', (d, i) => 0)
          .attr('class', (d, i) => {
            if (d['value'] === 0)
              return 'detail-matrix-body-bar-highlight' + ' key-' + d[uniqueKey];
            return 'detail-matrix-body-bar' + ' key-' + d[uniqueKey];
          })
          .style('fill', (d, i) => {
            if (d['value'] !== 0) return d['color'];
          })
          .attr('width', Math.max(xScale.bandwidth(), 1))
          .attr('yMax', function (d) {
            return detailCellHeight;
          })
          .attr('height', function (d, i) {
            return detailCellHeight;
          })
          .on('mouseover', function (d) {
            tabularTooltip.style('display', 'block');
            let idx = currentData.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            tabularTooltip.html('' + Object.values(currentData[idx])[PointNameColumnIndex]);

            let c = this.getBoundingClientRect();
            let p = document.getElementById('tabular-view').getBoundingClientRect();
            const tooltipwidth = tabularTooltip.node().getBoundingClientRect().width;
            // Calculate tooltip position so that it is on top of the bar
            let left = c.left - p.left - tooltipwidth / 2 + 2;
            let top = c.top - p.top - detailCellHeight - detailCellHeight / 2;
            tabularTooltip.style('left', left + 'px').style('top', top + 'px');

            // Highlight projection view glyph
            const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (index < 0) return;
            const node = projectionView.select("[data-index='" + index + "']");
            const { centerX, centerY } = getProjectionViewProps();
            const x = centerX(projectionViewPositions[index][0]);
            const y = centerY(projectionViewPositions[index][1]);
            const point = currentDataSkyline[index];
            node.attr('transform', `translate(${x}, ${y}) scale(4)`);
            d3.select(node.node().parentNode)
              .selectAll('g')
              .sort((a, b) => (a[uniqueKey] === point[uniqueKey] ? 1 : -1) );
            projectionViewTooltip.selectAll('*').remove();
            projectionViewTooltip.append('div').text(`${Object.keys(point)[PointNameColumnIndex]}: ${point[Object.keys(point)[PointNameColumnIndex]]}`);
            projectionViewTooltip
              .append('div')
              .text(`Domination score: ${currentDataSkylineDominationScores.scores[index]}`);
            projectionViewTooltip.style('display', 'block');

            const { width, height } = projectionViewTooltip.node().getBoundingClientRect();
            projectionViewTooltip
              .style('left', `${x - width / 2}px`)
              .style('top',`${y - height - 25}px`);
          })
          .on('mouseout', function (d) {
            tabularTooltip.style('display', 'none');

            // De-Highlight projection view glyph
            const index = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (index < 0) return;
            const node = projectionView.select("[data-index='" + index + "']");
            const { centerX, centerY } = getProjectionViewProps();
            const x = centerX(projectionViewPositions[index][0]);
            const y = centerY(projectionViewPositions[index][1]);
            node.attr('transform', `translate(${x},${y}) scale(1)`);
            projectionViewTooltip.style('display', 'none');
          })
          .on('click', function (d) {
            let idx = currentDataSkyline.map(e => e[uniqueKey]).indexOf(d[uniqueKey]);
            if (idx >= 0) {
              selectSkylinePoint(
                currentDataSkyline.findIndex((r) => {
                  return r[uniqueKey] === d[uniqueKey];
                })
              );
            }
          });
        rowCount = rowCount + 1;
      });
    } else {
      colCount = colCount + 1;

      let idx = currentDataSkyline.map(e => e[uniqueKey]).indexOf(key);
      // Add decisive subspace indicators
      if (colIdx === 1 && idx >= 0) {
        const nom = row.selectAll('td.nominal.subspaces');
        let subs = decisiveSubspacesDisplay.get(key);
        if (!subs) return;
        let xScale = d3
          .scaleBand()
          .range([0, 100])
          .paddingInner(0.5)
          .domain(d3.range(max_subspaces + 1));
        currentDataNumericAttributes.forEach(c => {
          const svg = nom
            .append('svg')
            .attr('class', 'detail-matrix detail-matrix-body')
            .attr('width', '100px')
            .attr('height', detailCellHeight);

          if (subs.has(c)) {
            let sub = subs.get(c);
            svg
              .selectAll('rect')
              .data(sub)
              .enter()
              .append('rect')
              .attr('x', (d, i) => {
                return xScale(d);
              })
              .attr('y', (d, i) => 0)
              .attr('class', (d, i) => {
                return 'detail-matrix-body-bar-highlight detail-matrix-body-subspace-bar-' + d;
              })
              .attr('width', Math.max(xScale.bandwidth(), 1))
              .attr('yMax', function (d) {
                return detailCellHeight;
              })
              .attr('height', function (d, i) {
                return detailCellHeight;
              })
          }
        });
      }
    }
  });
}

/**
 * Check if the column of the current data is numeric.
 *
 * @param {string} column Name of the column
 * @returns {boolean} Returns true, if the column is numeric.
 */
function isNumericAttribute(column) {
  return currentDataNumericAttributes != undefined
    ? currentDataNumericAttributes.includes(column)
    : currentData
        .map((data) => data[column])
        .every((value) => !(isNaN(+value) || isNaN(+value - 0)));
}

/**
 * Find the minimum and maximum value of the column of the current data.
 *
 * @param {string} column Name of the column
 * @returns {{min: number, max: number}} Minimum and maximum value of the column.
 */
function findMinMax(column) {
  return {
    min: Math.min(...currentDataSkyline.map((data) => parseFloat(data[column]))),
    max: Math.max(...currentDataSkyline.map((data) => parseFloat(data[column]))),
    toString() {
      return `${this.min} ~ ${this.max}`;
    },
  };
}

/**
 * Calculates the euclidean distance between two vectors.
 *
 * @param {number[]} vec1
 * @param {number[]} vec2
 * @returns {number} euclidean distance
 */
function euclideanDistance(vec1, vec2) {
  return Math.sqrt(
    vec1.reduce((previous, current, index) => (previous += current * vec2[index]), 0)
  );
}

/**
 * Checks if `point1` dominates `point2`.
 *
 * @param {d3.DSVRowString<string>} point1 Dominating point
 * @param {d3.DSVRowString<string>} point2 Dominated point
 * @return {boolean} true, if `point1` dominates `point2`.
 */
function dominates(point1, point2) {
  return (
    currentDataNumericAttributes.every((column) => +point1[column] >= +point2[column]) &&
    currentDataNumericAttributes.some((column) => +point1[column] > +point2[column])
  );
}

/**
 * Selects or deselects a skyline point. A maximum of 4 points can be selected.
 *
 * @param {d3.DSVRowString<string>} skylinePointIndex Index of the skyline point the shall be de-/selected
 */
function selectSkylinePoint(skylinePointIndex) {
  const index = selectedSkylinePointIndices.indexOf(skylinePointIndex);
  if (index > -1) {
    selectedSkylinePointIndices.splice(index, 1);
  } else {
    if (selectedSkylinePointIndices.length >= 4) return;
    selectedSkylinePointIndices.push(skylinePointIndex);
  }
  buildComparisonView();
}
