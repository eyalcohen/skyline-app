/*!
 * Copyright 2011 Mission Motors
 *
 * This code is loaded both in the web app and in the server.
 */

var _ = require('underscore');

exports.findCompatibleUnits = function(unit) {
  var category = unitToCategory[unit];
  if (category) {
    var units = exports.units[category];
    return {
      category: category,
      units: units,
      selected: findUnitDetails(unit, units),
    };
  }
}

function findUnitDetails(unit, units) {
  if (!units) return null;
  return _.find(units, function(u) {
    return u.unit == unit || u.long == unit || _.contains(u.alt || [], unit);
  });
}

exports.findConversion = function(sourceUnit, destUnit) {
  if (sourceUnit == destUnit)
    return { factor: 1, offset: 0 };
  function findDesc(unit) {
    var units = exports.findCompatibleUnits(unit);
    if (units) return findUnitDetails(unit, units.units);
  }
  var sourceDesc = findDesc(sourceUnit), destDesc = findDesc(destUnit);
  if (!sourceDesc || !destDesc)
    return null;
  // Convert from source to primary unit:
  //   p = s * sourceDesc.factor + sourceDesc.offset
  // Convert from primary unit to dest:
  //   p = d * destDesc.factor + destDesc.offset
  //   d = (p - destDesc.offset) / destDesc.factor
  // Convert from source unit to dest:
  //   d = (s * sourceDesc.factor + sourceDesc.offset - destDesc.offset) /
  //       destDesc.factor
  //     = s * (sourceDesc.factor / destDesc.factor) +
  //       (sourceDesc.offset - destDesc.offset) / destDesc.factor
  return {
    factor: (sourceDesc.factor || 1) / (destDesc.factor || 1),
    offset: ((sourceDesc.offset || 0) - (destDesc.offset || 0)) /
        (destDesc.factor || 1),
  };
}

exports.convert = function(sourceUnit, destUnit, value) {
  var conversion = exports.findConversion(sourceUnit, destUnit);
  if (!conversion) return null;
  return value * conversion.factor + conversion.offset;
}

// Unit conversion list.
exports.units = {
  // Format:
  // <unit category>: [
  //   { // First unit is primary.
  //     unit: <short>,  // Name of unit as displayed in parens.
  //     long: <long>,  // Name of unit as displayed in menu, if different.
  //     alt: [ <altnames> ],  // Optional alternate names to recognize.
  //   },
  //   { // This unit will be defined in terms of the primary unit.
  //     // To convert x of this units to primary: x * factor + offset
  //     unit: <short>, long: <long>, alt: [ <altnames> ],
  //     factor: <factor>, offset: <offset>,
  //   }, ...
  // ], ...
  'mass or force': [
    { unit: 'kg', long: 'kilogram' },
    { unit: 'g', long: 'gram', factor: 1e-3 },
    { unit: 'lb', long: 'pound', factor: 0.45359237 },
    { unit: 'oz', long: 'ounce', factor: 0.028349523 },
    { unit: 'N', long: 'newton', factor: 0.10197162 },
  ],
  'time': [
    { unit: 's', long: 'second' },
    { unit: 'ms', long: 'millisecond', factor: 1e-3 },
    { unit: 'µs', long: 'microsecond', alt: [ 'us' ], factor: 1e-6 },
    { unit: 'min', long: 'minute', factor: 60 },
    { unit: 'hour', factor: 60*60 },
    { unit: 'day', factor: 60*60*24 },
  ],
  'distance': [
    { unit: 'm', long: 'meter' },
    { unit: 'mm', long: 'millimeter', factor: 1e-3 },
    { unit: 'km', long: 'kilometer', factor: 1e3 },
    { unit: 'ft', long: 'foot', factor: 0.3048 },
    { unit: 'mile', factor: 1609.344 },
    { unit: 'NM', long: 'nautical mile', factor: 1852 },
  ],
  'current': [
    { unit: 'A', long: 'amp' },
    { unit: 'mA', long: 'milliamp', factor: 1e-3 },
  ],
  'voltage': [
    { unit: 'V', long: 'volt' },
    { unit: 'mV', long: 'millivolt', factor: 1e-3 },
  ],
  'power': [
    { unit: 'W', long: 'watt' },
    { unit: 'kW', long: 'kilowatt', factor: 1000 },
    { unit: 'hp', long: 'horsepower', factor: 745.69987 },
    { unit: 'PS', long: 'metrichorsepower', factor: 735.49875 },
  ],
  'energy': [
    { unit: 'J', long: 'joule' },
    { unit: 'Wh', long: 'watt hour', factor: 3600 },
    { unit: 'kWh', long: 'kilowatt hour', factor: 3600e3 },
    { unit: 'cal', long: 'calorie', factor: 4.1868 },
    { unit: 'kcal', long: 'kilocalorie', alt: [ 'Cal', 'Calorie' ],
      factor: 4.1868e3 },
    { unit: 'Btu', alt: [ 'btu' ], factor: 1055.0559 },
  ],
  'temperature': [
    { unit: 'K', long: 'kelvin' },
    { unit: '°C', long: 'degrees celsius',
      alt: [ 'degrees centigrade', 'C', 'degC' ],
      factor: 1, offset: 273.15 },  // X °C = (X * 1 + 273.15) K
    { unit: '°F', long: 'degrees fahrenheit', alt: [ 'F', 'degF' ],
      factor: 5/9, offset: 255.37222 },  // X °F = (X * (5/9) + 273.15) °C
  ],
  'angle': [
    { unit: 'rad', long: 'radian' },
    { unit: '°', long: 'degree', factor: Math.PI / 180 },
    { unit: 'rev', long: 'revolution', alt: [ 'turn', 'cycle', 'rot' ],
      factor: 2 * Math.PI },
    { unit: 'grad', long: 'gradian', alt: [ 'gon' ], factor: Math.PI / 200 },
  ],
  'torque': [
    { unit: 'Nm', long: 'newton meter', alt: [ 'N m' ] },
    { unit: 'lb ft', long: 'pound foot',
      alt: [ 'lbft', 'ft lb', 'ftlb', 'foot pound' ], factor: 1.3558179 },
  ],
  'rotational speed': [
    { unit: 'rad/s', long: 'radians per second', alt: [ 'radian/s' ] },
    { unit: 'rpm', long: 'revolutions per minute', alt: [ 'RPM' ],
      factor: Math.PI * 2 / 60 },
    { unit: 'rps', long: 'revolutions per second', alt: [ 'RPS' ],
      factor: Math.PI * 2 },
  ],
  'pressure': [
    { unit: 'Pa', long: 'pascal' },
    { unit: 'kPa', long: 'kilopascal', factor: 1e3 },
    { unit: 'psi', long: 'pounds per square inch', factor: 6894.7573 },
    { unit: 'bar', factor: 1e5 },
    { unit: 'atm', long: 'standard atmosphere', factor: 101325 },
    { unit: 'Torr', long: 'torr', alt: [ 'torr' ], factor: 133.32239 },
  ],
  'velocity': [
    { unit: 'm/s', long: 'meters per second' },
    { unit: 'mph', long: 'miles per hour', alt: [ 'MPH '], factor: 0.44704 },
    { unit: 'ft/s', long: 'feet per second', factor: 0.3048 },
    { unit: 'km/h', long: 'kilometers per hour', alt: [ 'kph', 'kmph' ],
      factor: 1e3/(60*60) },
    { unit: 'knot', long: 'nautical mile per hour', alt: [ 'kn' ],
      factor: 0.51444444 },
  ],
  'acceleration': [
    { unit: 'm/s^2', long: 'meters per second squared' },
    { unit: 'g', long: 'standard gravity', alt: [ 'G' ], factor: 9.80665 },
  ],
  'data': [
    { unit: 'bit', alt: [ 'b' ] },
    { unit: 'kilobit', alt: [ 'kbit', 'kb' ], factor: 1000 },
    { unit: 'megabit', alt: [ 'Mbit', 'Mb' ], factor: 1000*1000 },
    { unit: 'kibibit', alt: [ 'Kibit', 'Kib' ], factor: 1024 },
    { unit: 'mebibit', alt: [ 'Mibit', 'Mib' ], factor: 1024*1024 },
    { unit: 'byte', alt: [ 'B' ], factor: 8 },
    { unit: 'kB', long: 'kilobyte', factor: 8*1000 },
    { unit: 'MB', long: 'megabyte', factor: 8*1000*1000 },
    { unit: 'GB', long: 'gigabyte', factor: 8*1000*1000*1000 },
    { unit: 'KiB', long: 'kibibyte', factor: 8*1024 },
    { unit: 'MiB', long: 'mebibyte', factor: 8*1024*1024 },
    { unit: 'GiB', long: 'gibibyte', factor: 8*1024*1024*1024 },
  ],
  'bandwidth': [
    { unit: 'bit/s', long: 'bits per second', alt: [ 'bps' ] },
    { unit: 'kilobit/s', long: 'kilobits per second',
      alt: [ 'kbit/s', 'kb/s', 'kbps' ], factor: 1000 },
    { unit: 'megabit/s', long: 'megabits per second',
      alt: [ 'Mbit/s', 'Mb/s', 'Mbps' ], factor: 1000*1000 },
    { unit: 'kibibit/s', long: 'kibibits per second',
      alt: [ 'Kibit/s', 'Kib/s', 'Kibps' ], factor: 1024 },
    { unit: 'mebibit/s', long: 'mebibits per second',
      alt: [ 'Mibit/s', 'Mib/s', 'Mibps' ], factor: 1024*1024 },
    { unit: 'byte/s', long: 'bytes per second',
      alt: [ 'B/s', 'Bps' ], factor: 8 },
    { unit: 'kB/s', long: 'kilobytes per second',
      alt: [ 'kilobyte/s', 'kBps' ], factor: 8*1000 },
    { unit: 'MB/s', long: 'megabytes per second',
      alt: [ 'megabyte/s', 'MBps' ], factor: 8*1000*1000 },
    { unit: 'KiB/s', long: 'kibibytes per second',
      alt: [ 'kibibyte/s', 'KiBps' ], factor: 8*1024 },
    { unit: 'MiB/s', long: 'mebibytes per second',
      alt: [ 'mebibyte/s', 'MiBps' ], factor: 8*1024*1024 },
  ],
  'percentage': [
    { unit: 'frac', long: 'fraction' },
    { unit: '%', long: 'percent', alt: [ 'pct' ], factor: 0.01 },
  ],
};

var unitToCategory = {};
_.forEach(exports.units, function(catUnits, category) {
  catUnits.forEach(function(unit) {
    unitToCategory[unit.unit] = category;
    unitToCategory[unit.long] = category;
    (unit.alt || []).forEach(function(alt) {
      unitToCategory[alt] = category;
    });
  });
});
