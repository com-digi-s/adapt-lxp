'use strict';

export function timeIntToString(intTime) {
  var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

  var ms = intTime % 1000;
  intTime = (intTime - ms) / 1000;
  var ss = intTime % 60;
  intTime = (intTime - ss) / 60;
  var mm = intTime % 60;
  intTime = (intTime - mm) / 60;
  var hh = intTime % 24 - offset;

  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}

// source: https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
// dec2hex :: Integer -> String
// i.e. 0-255 -> '00'-'ff'
function dec2hex(dec) {
  return dec.toString(16).padStart(2, '0');
}

// generateId :: Integer -> String
export function generateId(len) {
  var arr = new Uint8Array((len || 40) / 2);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}

export function germanDateFormat(isoDate) {
  var split = isoDate.split('/');
  return split[1] + '.' + split[0] + '.' + split[2];
}

export function calculateMinutes(stringTime) {
  var hms = stringTime.split(':').map(function (x) {
    return parseInt(x);
  });
  return hms[0] * 60 + hms[1] + hms[2] / 60;
}

export function floatToPercentage(value) {
  return (value * 100).toFixed(0) + '%';
}