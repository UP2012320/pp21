const express = require('express');
const {sendImage} = require("./imager");

const PORT = 8080;
const app = express();

app.use(express.static('public'));

/**
 * @description Takes the specified number of elements from the beginning of an array.
 * If the amount is greater than the array length, the length of the array will be taken.
 * @template T
 * @param amount {number}
 * @returns {T[]}
 */
Array.prototype.take = function (amount) {
  if (!amount || typeof amount !== 'number') {
    return [];
  }

  if (amount > this.length) {
    amount = this.length;
  }

  const newArray = [];

  for (let i = 0; i < amount; i++) {
    newArray.push(this[i]);
  }

  return newArray;
};

class Stat {
  constructor(value) {
    this.value = value;
    this.count = 1;
    this.time = Date.now();
  }
}

/**
 *
 * @type {Stat[]}
 */
let paths = [];

/**
 *
 * @type {Stat[]}
 */
let texts = [];

/**
 *
 * @type {Stat[]}
 */
let sizes = [];

/**
 *
 * @type {Stat[]}
 */
let referrers = [];

/**
 *
 * @type {number[]}
 */
let hits = [];

/**
 *
 * @description Helper function to wrap .sort() calls. Clones the array passed to keep the original untouched.
 * @param array {Stat[]}
 * @param sortFn {function(Stat[])}
 * @return {Stat[]}
 */
function orderBy(array, sortFn) {
  if (!array || !Array.isArray(array)) {
    return array;
  }

  // Don't want to manipulate to original by reference
  const arrayClone = [...array];

  sortFn(arrayClone);

  return arrayClone;
}

/**
 *
 * @param array {Stat[]}
 * @returns {Stat[]}
 */
function orderByCount(array) {
  return orderBy(array, (array) => {
    array.sort((a, b) => {
      if (a.count < b.count) {
        return 1;
      } else if (a.count > b.count) {
        return -1;
      }

      return 0;
    });
  });
}

/**
 *
 * @param array {Stat[]}
 * @returns {Stat[]}
 */
function orderByTime(array) {
  return orderBy(array, (array) => {
    array.sort((a, b) => {
      if (a.time < b.time) {
        return 1;
      } else if (a.time > b.time) {
        return -1;
      }

      return 0;
    });
  });
}

/**
 *
 * @param array {Stat[]}
 * @param value {any}
 */
function internalAppendValue(array, value) {
  if (!array || !Array.isArray(array)) {
    return;
  }

  // Use JSON.stringify to compare any two objects as standard equality operators won't work on object types.
  const existingValue = array.find(x => JSON.stringify(x.value) === JSON.stringify(value));

  if (existingValue) {
    const indexOfExistingValue = array.indexOf(existingValue);
    array[indexOfExistingValue].count++;

    // Update the time here to indicate this value was called recently.
    array[indexOfExistingValue].time = Date.now();
  } else {
    // Push to the start of the array to keep track of order.
    array.unshift(new Stat(value));
  }
}

/**
 *
 * @param stat {'paths' | 'texts' | 'sizes' | 'referrers'}
 * @param value {any}
 */
function appendValue(stat, value) {
  switch (stat) {
    case 'paths':
      internalAppendValue(paths, value);
      break;
    case "texts":
      internalAppendValue(texts, value);
      break;
    case "referrers":
      internalAppendValue(referrers, value);
      break;
    case "sizes":
      internalAppendValue(sizes, value);
      break;
  }
}

function incrementHits() {
  hits.unshift(Date.now());
}

/**
 *
 * @param array {Stat[]}
 * @return {Stat[]}
 */
function getByTime(array) {
  return orderByTime(array)
    .map(value => value.value)
    .take(10);
}

function getRecentPaths() {
  return getByTime(paths);
}

function getRecentTexts() {
  return getByTime(texts);
}

function getRecentSizes() {
  return getByTime(sizes);
}

function getTopSizes() {
  return orderByCount(sizes)
    .map(size => ({...size.value, n: size.count}))
    .take(10);
}

function getTopReferrers() {
  return orderByCount(referrers)
    .map(referrer => ({ref: referrer.value, n: referrer.count}))
    .take(10);
}

function getHits() {
  let five = 0;
  let ten = 0;
  let fifteen = 0;

  for (const hit of hits) {
    const diff = Date.now() - hit;

    // Since all hits are pushed to the start of the array, we can assume they're already
    // ordered from most recent to oldest. As such, once we reach one that is higher than 15s
    // we know that all proceeding values will be.
    if (diff > 15000) {
      break;
    }

    if (diff <= 5000) {
      five++;
    }

    if (diff <= 10000) {
      ten++;
    }

    fifteen++;
  }

  return [
    {title: '5s', count: five},
    {title: '10s', count: ten},
    {title: '15s', count: fifteen}
  ];
}

function reset() {
  paths = [];
  texts = [];
  referrers = [];
  sizes = [];
  hits = [];
}

app.get('/img/:width/:height', async (req, res) => {
  const {width: widthParam, height: heightParam} = req.params;
  const width = parseInt(widthParam);
  const height = parseInt(heightParam);

  const squareQuery = req.query.square;
  let square = parseInt(squareQuery);

  const text = req.query.text;

  if (!width || !height) {
    res.sendStatus(400);
    return;
  }

  if (Number.isNaN(width) || Number.isNaN(height)) {
    res.sendStatus(400);
    return;
  }

  // Have to operate on string values since the parsed numbers will have any decimal places removed
  if (widthParam % 1 !== 0 || heightParam % 1 !== 0) {
    res.sendStatus(400);
    return;
  }

  if (width > 2000 || height > 2000) {
    res.sendStatus(403);
    return;
  } else if (width <= 0 || height <= 0) {
    res.sendStatus(400);
    return;
  }

  if (square && req.query.square % 1 !== 0) {
    res.sendStatus(400);
    return;
  }

  if (squareQuery !== undefined && squareQuery.length === 0) {
    res.sendStatus(400);
    return;
  }

  if (Number.isNaN(square)) {
    square = null;
  }

  if (square !== null && square <= 0) {
    res.sendStatus(400);
    return;
  }

  // Easier to just rebuild the path to ensure the correct order

  let path = req.path;

  if (square) {
    path += `?square=${square}`;
  }

  if (text) {
    path += `${square ? '&' : '?'}text=${encodeURIComponent(text)}`;
  }

  appendValue('paths', path)

  if (text) {
    appendValue('texts', text);
  }

  appendValue('sizes', {w: width, h: height});

  if (req.headers.referer) {
    appendValue('referrers', req.headers.referer);
  }

  incrementHits();

  await sendImage(res, width, height, square, text);
});

app.get('/stats/paths/recent', (req, res) => {
  const recentPaths = getRecentPaths();

  res.send(recentPaths);
});

app.get('/stats/texts/recent', (req, res) => {
  const recentTexts = getRecentTexts();

  res.send(recentTexts);
});

app.get('/stats/sizes/recent', (req, res) => {
  const recentSizes = getRecentSizes();

  res.send(recentSizes);
});

app.get('/stats/sizes/top', (req, res) => {
  const topSizes = getTopSizes();

  res.send(topSizes);
});

app.get('/stats/referrers/top', (req, res) => {
  const topReferrers = getTopReferrers();

  res.send(topReferrers);
});

app.get('/stats/hits', (req, res) => {
  const hits = getHits();

  res.send(hits);
});

app.delete('/stats', (req, res) => {
  reset();

  res.sendStatus(200);
})

app.listen(PORT, () => {
  console.debug(`Server running on port ${PORT}`);
});
