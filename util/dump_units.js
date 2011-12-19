#!/usr/bin/env node

var units = require('../units.js').units;
var _ = require('underscore');

console.log('<ul>');
_.each(units, function(category, categoryName) {
  console.log('  <li><b>' + _.escape(categoryName) + '</b>:</li>');
  console.log('  <ul>');
  _.each(category, function(unit) {
    var l = '  <li><b>' + _.escape(unit.unit) + '</b>';
    if (unit.long)
      l += ' (' + _.escape(unit.long) + ')';
    l += ': '
    if (unit.offset) {
      l += '<i>x</i> ' + _.escape(unit.unit) + ' = ' +
          '(<i>x</i> * ' + (unit.factor || 1) + ' + ' + unit.offset + ') ' +
          _.escape(_.first(category).unit);
    } else if (unit.factor) {
      l += ' 1 ' + _.escape(unit.unit) + ' = ' +
          unit.factor + ' ' + _.escape(_.first(category).unit);
    } else {
      l += '<i>base unit</i>';
    }
    if (unit.alt && unit.alt.length)
      l += ' <i>(also: ' + unit.alt.map(_.escape).join(', ') + ')</i>';
    l += '</li>';
    console.log(l);
  });
  console.log('  </ul>');
});
console.log('</ul>');
