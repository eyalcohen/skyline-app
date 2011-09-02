/*!
 * Copyright 2011 Mission Motors
 * Author Sander Pick <sander.pick@ridemission.com>
 */

define({
  orange: '#ff931a',
  blue: '#55f5f2',
  green: '#00f62e',
  red: '#fe110e',
  yellow: '#befe11',
  purple: '#5a1ada',
  mapStylez: [
    {
      featureType: 'administrative',
      elementType: 'all',
      stylers: [ { visibility: 'off' } ]
    },
    {
      featureType: 'landscape',
      elementType: 'all',
      stylers: [ { saturation: 100 } ]
    },
    {
      featureType: 'poi',
      elementType: 'all',
      stylers: [ { saturation: 100 } ]
    },
    {
      featureType: 'road',
      elementType: 'all',
      stylers: [ { saturation: -100 } ]
    },
    {
      featureType: 'transit',
      elementType: 'all',
      stylers: [ { visibility: 'off' } ]
    },
    {
      featureType: 'water',
      elementType: 'all',
      stylers: [ { saturation: -100 } ]
    },
  ],
  mapStyledOptions: {
    name: 'GrayScale',
  },
});

