// usage: log('inside coolFunc', this, arguments);
// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function(){
  log.history = log.history || [];  
  log.history.push(arguments);
  arguments.callee = arguments.callee.caller;  
  if(this.console) console.log( Array.prototype.slice.call(arguments) );
};
(function(b){function c(){}for(var d="assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),a;a=d.pop();)b[a]=b[a]||c})(window.console=window.console||{});

/** @license jQuery Easing v1.3: Copyright (c) 2008 George McGinley Smith | BSD License: http://www.opensource.org/licenses/bsd-license.php
*/

/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 * 
 * Open source under the BSD License. 
 * 
 * Copyright Â© 2008 George McGinley Smith
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
jQuery.easing['jswing'] = jQuery.easing['swing'];

jQuery.extend( jQuery.easing,
{
  def: 'easeOutQuad',
  swing: function (x, t, b, c, d) {
    //alert(jQuery.easing.default);
    return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
  },
  easeInQuad: function (x, t, b, c, d) {
    return c*(t/=d)*t + b;
  },
  easeOutQuad: function (x, t, b, c, d) {
    return -c *(t/=d)*(t-2) + b;
  },
  easeInOutQuad: function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t + b;
    return -c/2 * ((--t)*(t-2) - 1) + b;
  },
  easeInCubic: function (x, t, b, c, d) {
    return c*(t/=d)*t*t + b;
  },
  easeOutCubic: function (x, t, b, c, d) {
    return c*((t=t/d-1)*t*t + 1) + b;
  },
  easeInOutCubic: function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t + b;
    return c/2*((t-=2)*t*t + 2) + b;
  },
  easeInQuart: function (x, t, b, c, d) {
    return c*(t/=d)*t*t*t + b;
  },
  easeOutQuart: function (x, t, b, c, d) {
    return -c * ((t=t/d-1)*t*t*t - 1) + b;
  },
  easeInOutQuart: function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
    return -c/2 * ((t-=2)*t*t*t - 2) + b;
  },
  easeInQuint: function (x, t, b, c, d) {
    return c*(t/=d)*t*t*t*t + b;
  },
  easeOutQuint: function (x, t, b, c, d) {
    return c*((t=t/d-1)*t*t*t*t + 1) + b;
  },
  easeInOutQuint: function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
    return c/2*((t-=2)*t*t*t*t + 2) + b;
  },
  easeInSine: function (x, t, b, c, d) {
    return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
  },
  easeOutSine: function (x, t, b, c, d) {
    return c * Math.sin(t/d * (Math.PI/2)) + b;
  },
  easeInOutSine: function (x, t, b, c, d) {
    return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
  },
  easeInExpo: function (x, t, b, c, d) {
    return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
  },
  easeOutExpo: function (x, t, b, c, d) {
    return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
  },
  easeInOutExpo: function (x, t, b, c, d) {
    if (t==0) return b;
    if (t==d) return b+c;
    if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
    return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
  },
  easeInCirc: function (x, t, b, c, d) {
    return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
  },
  easeOutCirc: function (x, t, b, c, d) {
    return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
  },
  easeInOutCirc: function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
    return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
  },
  easeInElastic: function (x, t, b, c, d) {
    var s=1.70158;var p=0;var a=c;
    if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
    if (a < Math.abs(c)) { a=c; var s=p/4; }
    else var s = p/(2*Math.PI) * Math.asin (c/a);
    return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
  },
  easeOutElastic: function (x, t, b, c, d) {
    var s=1.70158;var p=0;var a=c;
    if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
    if (a < Math.abs(c)) { a=c; var s=p/4; }
    else var s = p/(2*Math.PI) * Math.asin (c/a);
    return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
  },
  easeInOutElastic: function (x, t, b, c, d) {
    var s=1.70158;var p=0;var a=c;
    if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
    if (a < Math.abs(c)) { a=c; var s=p/4; }
    else var s = p/(2*Math.PI) * Math.asin (c/a);
    if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
    return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
  },
  easeInBack: function (x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c*(t/=d)*t*((s+1)*t - s) + b;
  },
  easeOutBack: function (x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
  },
  easeInOutBack: function (x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158; 
    if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
    return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
  },
  easeInBounce: function (x, t, b, c, d) {
    return c - jQuery.easing.easeOutBounce (x, d-t, 0, c, d) + b;
  },
  easeOutBounce: function (x, t, b, c, d) {
    if ((t/=d) < (1/2.75)) {
      return c*(7.5625*t*t) + b;
    } else if (t < (2/2.75)) {
      return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
    } else if (t < (2.5/2.75)) {
      return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
    } else {
      return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
    }
  },
  easeInOutBounce: function (x, t, b, c, d) {
    if (t < d/2) return jQuery.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
    return jQuery.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
  }
});

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 * 
 * Open source under the BSD License. 
 * 
 * Copyright Â© 2001 Robert Penner
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
 */
 
/*
 * jQuery Hotkeys Plugin
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Based upon the plugin by Tzury Bar Yochay:
 * http://github.com/tzuryby/hotkeys
 *
 * Original idea by:
 * Binny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/
*/

(function(jQuery){
  
  jQuery.hotkeys = {
    version: "0.8",

    specialKeys: {
      8: "backspace", 9: "tab", 13: "return", 16: "shift", 17: "ctrl", 18: "alt", 19: "pause",
      20: "capslock", 27: "esc", 32: "space", 33: "pageup", 34: "pagedown", 35: "end", 36: "home",
      37: "left", 38: "up", 39: "right", 40: "down", 45: "insert", 46: "del", 
      96: "0", 97: "1", 98: "2", 99: "3", 100: "4", 101: "5", 102: "6", 103: "7",
      104: "8", 105: "9", 106: "*", 107: "+", 109: "-", 110: ".", 111 : "/", 
      112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6", 118: "f7", 119: "f8", 
      120: "f9", 121: "f10", 122: "f11", 123: "f12", 144: "numlock", 145: "scroll", 191: "/", 224: "meta"
    },
  
    shiftNums: {
      "`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", 
      "8": "*", "9": "(", "0": ")", "-": "_", "=": "+", ";": ": ", "'": "\"", ",": "<", 
      ".": ">",  "/": "?",  "\\": "|"
    }
  };

  function keyHandler( handleObj ) {
    // Only care when a possible input has been specified
    if ( typeof handleObj.data !== "string" ) {
      return;
    }
    
    var origHandler = handleObj.handler,
      keys = handleObj.data.toLowerCase().split(" ");
  
    handleObj.handler = function( event ) {
      // Don't fire in text-accepting inputs that we didn't directly bind to
      if ( this !== event.target && (/textarea|select/i.test( event.target.nodeName ) ||
         event.target.type === "text") ) {
        return;
      }
      
      // Keypress represents characters, not special keys
      var special = event.type !== "keypress" && jQuery.hotkeys.specialKeys[ event.which ],
        character = String.fromCharCode( event.which ).toLowerCase(),
        key, modif = "", possible = {};

      // check combinations (alt|ctrl|shift+anything)
      if ( event.altKey && special !== "alt" ) {
        modif += "alt+";
      }

      if ( event.ctrlKey && special !== "ctrl" ) {
        modif += "ctrl+";
      }
      
      // TODO: Need to make sure this works consistently across platforms
      if ( event.metaKey && !event.ctrlKey && special !== "meta" ) {
        modif += "meta+";
      }

      if ( event.shiftKey && special !== "shift" ) {
        modif += "shift+";
      }

      if ( special ) {
        possible[ modif + special ] = true;

      } else {
        possible[ modif + character ] = true;
        possible[ modif + jQuery.hotkeys.shiftNums[ character ] ] = true;

        // "$" can be triggered as "Shift+4" or "Shift+$" or just "$"
        if ( modif === "shift+" ) {
          possible[ jQuery.hotkeys.shiftNums[ character ] ] = true;
        }
      }

      for ( var i = 0, l = keys.length; i < l; i++ ) {
        if ( possible[ keys[i] ] ) {
          return origHandler.apply( this, arguments );
        }
      }
    };
  }

  jQuery.each([ "keydown", "keyup", "keypress" ], function() {
    jQuery.event.special[ this ] = { add: keyHandler };
  });

})( jQuery );



// Code for a variety of interaction models. Used in interaction.html, but split out from
// that file so they can be tested in isolation.
//
function downV3(event, g, context) {
  g.canvas_.style.cursor = "url(/graphics/openhand_8_8.bmp) 8 8, auto";
  context.initializeMouseDown(event, g, context);
  if (event.altKey || event.shiftKey) {
    Dygraph.startZoom(event, g, context);
  } else {
    // for (var i = 0, len = g.siblings.length; i < len; i++) {
    //   Dygraph.startPan(event, g.siblings[i], context);
    // }
    Dygraph.startPan(event, g, context);
  }
}

function moveV3(event, g, context) {
  if (context.isPanning) {
    g.canvas_.style.cursor = "url(/graphics/closedhand_8_8.bmp) 8 8, auto";
    // for (var i = 0, len = g.siblings.length; i < len; i++) {
    //   Dygraph.movePan(event, g.siblings[i], context);
    // }
    Dygraph.movePan(event, g, context);
  } else if (context.isZooming) {
    // for (var i = 0, len = g.siblings.length; i < len; i++) {
    //   Dygraph.moveZoom(event, g.siblings[i], context, g);
    // }
    Dygraph.moveZoom(event, g, context);
  } else {
    g.canvas_.style.cursor = "url(/graphics/openhand_8_8.bmp) 8 8, auto";
  }
}

function upV3(event, g, context) {
  g.canvas_.style.cursor = "url(/graphics/openhand_8_8.bmp) 8 8, auto";
  if (context.isPanning) {
    Dygraph.endPan(event, g, context);
  } else if (context.isZooming) {
    Dygraph.endZoom(event, g, context);
  }
}

// Take the offset of a mouse event on the dygraph canvas and
// convert it to a pair of percentages from the bottom left. 
// (Not top left, bottom is where the lower value is.)
function offsetToPercentage(g, offsetX, offsetY) {
  // This is calculating the pixel offset of the leftmost date.
  var xOffset = g.toDomCoords(g.xAxisRange()[0], null)[0];
  var yar0 = g.yAxisRange(0);

  // This is calculating the pixel of the higest value. (Top pixel)
  var yOffset = g.toDomCoords(null, yar0[1])[1];

  // x y w and h are relative to the corner of the drawing area,
  // so that the upper corner of the drawing area is (0, 0).
  var x = offsetX - xOffset;
  var y = offsetY - yOffset;

  // This is computing the rightmost pixel, effectively defining the
  // width.
  var w = g.toDomCoords(g.xAxisRange()[1], null)[0] - xOffset;

  // This is computing the lowest pixel, effectively defining the height.
  var h = g.toDomCoords(null, yar0[0])[1] - yOffset;

  // Percentage from the left.
  var xPct = w == 0 ? 0 : (x / w);
  // Percentage from the top.
  var yPct = h == 0 ? 0 : (y / h);

  // The (1-) part below changes it from "% distance down from the top"
  // to "% distance up from the bottom".
  return [xPct, (1-yPct)];
}

function dblClickV3(event, g, context) {
  if (!g.file_)
    return;
  // Reducing by 20% makes it 80% the original size, which means
  // to restore to original size it must grow by 25%
  var percentages = offsetToPercentage(g, event.offsetX, event.offsetY);
  var xPct = percentages[0];
  var yPct = percentages[1];

  if (event.ctrlKey) {
    zoom(g, -.25, xPct, yPct);
  } else {
    zoom(g, +.2, xPct, yPct);
  }
}

var lastClickedGraph = null;

function clickV3(event, g, context) {
  lastClickedGraph = g;
  Dygraph.cancelEvent(event);
}

function scrollV3(event, g, context) {
  if (!g.file_)
    return;
  if (lastClickedGraph != g) {
    //return;
  }
  var normal = event.detail ? -1 * event.detail / 10 : event.wheelDelta / 40;
  // For me the normalized value shows 0.075 for one click. If I took
  // that verbatim, it would be a 7.5%.
  var percentage = normal / 50;
  
  var off = !event.offsetX ? $(g.graphDiv).offset() : null;
  if (!event.offsetX && !off) return;
  var offsetX = event.offsetX || event.pageX - off.left;
  var offsetY = event.offsetY || event.pageY - off.top;
  var percentages = offsetToPercentage(g, offsetX, offsetY);
  var xPct = percentages[0];
  var yPct = percentages[1];

  zoom(g, percentage, xPct, yPct);
  Dygraph.cancelEvent(event);
}

// Adjusts [x, y] toward each other by zoomInPercentage%
// Split it so the left/bottom axis gets xBias/yBias of that change and
// tight/top gets (1-xBias)/(1-yBias) of that change.
//
// If a bias is missing it splits it down the middle.
function zoom(g, zoomInPercentage, xBias, yBias) {
  xBias = xBias || 0.5;
  yBias = yBias || 0.5;
  function adjustAxis(axis, zoomInPercentage, bias) {
    var delta = axis[1] - axis[0];
    var increment = delta * zoomInPercentage;
    var foo = [increment * bias, increment * (1-bias)];
    return [ axis[0] + foo[0], axis[1] - foo[1] ];
  }
  // var yAxes = g.yAxisRanges();
  // var newYAxes = [];
  // for (var i = 0; i < yAxes.length; i++) {
  //   newYAxes[i] = adjustAxis(yAxes[i], zoomInPercentage, yBias);
  // }
  g.updateOptions({
    dateWindow: adjustAxis(g.xAxisRange(), zoomInPercentage, xBias),
    //valueRange: newYAxes[0]
    });
}

var v4Active = false;
var v4Canvas = null;

function downV4(event, g, context) {
  context.initializeMouseDown(event, g, context);
  v4Active = true;
  moveV4(event, g, context); // in case the mouse went down on a data point.
}

var processed = [];

function moveV4(event, g, context) {
  var RANGE = 7;
  
  if (v4Active) {
    var canvasx = Dygraph.pageX(event) - Dygraph.findPosX(g.graphDiv);
    var canvasy = Dygraph.pageY(event) - Dygraph.findPosY(g.graphDiv);

    var rows = g.numRows();
    // Row layout:
    // [date, [val1, stdev1], [val2, stdev2]]
    for (var row = 0; row < rows; row++) {
      var date = g.getValue(row, 0);
      var x = g.toDomCoords(date, null)[0];
      var diff = Math.abs(canvasx - x);
      if (diff < RANGE) {
        for (var col = 1; col < 3; col++) {
          // TODO(konigsberg): these will throw exceptions as data is removed.
          var vals =  g.getValue(row, col);
          if (vals == null) { continue; }
          var val = vals[0];
          var y = g.toDomCoords(null, val)[1];
          var diff2 = Math.abs(canvasy - y);
          if (diff2 < RANGE) {
            var found = false;
            for (var i in processed) {
              var stored = processed[i];
              if(stored[0] == row && stored[1] == col) {
                found = true;
                break;
              }
            }
            if (!found) {
              processed.push([row, col]);
              drawV4(x, y);
            }
            return;
          }
        }
      }
    }
  }
}

function upV4(event, g, context) {
  if (v4Active) {
    v4Active = false;
  }
}

function dblClickV4(event, g, context) {
  restorePositioning(g);
}

function drawV4(x, y) {
  var ctx = v4Canvas;

  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#FFFF00";
  ctx.beginPath();
  ctx.arc(x,y,5,0,Math.PI*2,true);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function captureCanvas(canvas, area, g) {
  v4Canvas = canvas;
}

function restorePositioning(g) {
  g.updateOptions({
    dateWindow: null,
    valueRange: null
  });
}



/*
    jQuery-SelectBox
    
    Traditional select elements are very difficult to style by themselves, 
    but they are also very usable and feature rich. This plugin attempts to 
    recreate all selectbox functionality and appearance while adding 
    animation and stylability.
    
    This product includes software developed 
    by RevSystems, Inc (http://www.revsystems.com/) and its contributors
    
    Please see the accompanying LICENSE.txt for licensing information.
*/
(function(e,d,g){e.fn.borderWidth=function(){return e(this).outerWidth()-e(this).innerWidth()};e.fn.paddingWidth=function(){return e(this).innerWidth()-e(this).width()};e.fn.extraWidth=function(){return e(this).outerWidth(true)-e(this).width()};e.fn.offsetFrom=function(i){var h=e(i);return{left:e(this).offset().left-h.offset().left,top:e(this).offset().top-h.offset().top}};e.fn.maxWidth=function(){var h=0;e(this).each(function(){if(e(this).width()>h){h=e(this).width()}});return h};e.fn.triggerAll=function(h,i){return e(this).each(function(){e(this).triggerHandler(h,i)})};var c=Array.prototype.slice,a=function(){return Math.floor(Math.random()*999999999)};e.proto=function(){var i=arguments[0],h=arguments[1],j=h,l={},k;opts=e.extend({elem:"elem",access:"access",init:"init",instantAccess:false},arguments[2]);if(h._super){l[opts.init]=function(){};j=h.extend(l)}e.fn[i]=function(){var m,n=arguments;e(this).each(function(){var p=e(this),q=p.data(i),o=!q;if(o){q=new j();if(h._super){q[opts.init]=h.prototype.init}q[opts.elem]=p[0];if(q[opts.init]){q[opts.init].apply(q,opts.instantAccess?[]:c.call(n,0))}p.data(i,q)}if(!o||opts.instantAccess){if(q[opts.access]){q[opts.access].apply(q,c.call(n,0))}if(n.length>0){if(e.isFunction(q[n[0]])){m=q[n[0]].apply(q,c.call(n,1))}else{if(n.length===1){if(e.getObject){m=e.getObject(n[0],q)}else{m=q[n[0]]}}else{if(e.setObject){e.setObject(n[0],n[1],q)}else{q[n[0]]=n[1]}}}}else{if(m===k){m=p.data(i)}}}});if(m===k){return e(this)}return m}};var b=function(){return false},f=function(){var q=this,U={},m=null,C=null,u=null,v=null,l=null,ac=null,W="",G=null,V=null,i=null,T,Z,n,af,s,ad,Y,M,aa,w,ae,h,ab,S,Q,L,y,z,j,X,R,J,I,P,H,O,E,B,k,N,p,A,F,x,t,r,K,D;T=function(){u=e("<div class='sb "+U.selectboxClass+" "+m.attr("class")+"' id='sb"+a()+"'></div>").attr("role","listbox").attr("aria-has-popup","true").attr("aria-labelledby",C.attr("id")?C.attr("id"):"");e("body").append(u);var ag=m.children().size()>0?U.displayFormat.call(m.find("option:selected")[0],0,0):"&nbsp;";v=e("<div class='display "+m.attr("class")+"' id='sbd"+a()+"'></div>").append(e("<div class='text'></div>").append(ag)).append(U.arrowMarkup);u.append(v);l=e("<ul class='"+U.selectboxClass+" items "+m.attr("class")+"' role='menu' id='sbdd"+a()+"'></ul>").attr("aria-hidden","true");u.append(l).attr("aria-owns",l.attr("id"));if(m.children().size()===0){l.append(Z().addClass("selected"))}else{m.children().each(function(ah){var ai,aj,ak,al;if(e(this).is("optgroup")){aj=e(this);ak=e("<li class='optgroup'>"+U.optgroupFormat.call(aj[0],ah+1)+"</li>").addClass(aj.is(":disabled")?"disabled":"").attr("aria-disabled",aj.is(":disabled")?"true":"");al=e("<ul class='items'></ul>");ak.append(al);l.append(ak);aj.children("option").each(function(){ai=Z(e(this),ah).addClass(aj.is(":disabled")?"disabled":"").attr("aria-disabled",aj.is(":disabled")?"true":"");al.append(ai)})}else{l.append(Z(e(this),ah))}})}ac=l.find("li").not(".optgroup");u.attr("aria-active-descendant",ac.filter(".selected").attr("id"));l.children(":first").addClass("first");l.children(":last").addClass("last");if(!U.fixedWidth){var o=l.find(".text, .optgroup").maxWidth()+v.extraWidth()+1;u.width(U.maxWidth?Math.min(U.maxWidth,o):o)}else{if(U.maxWidth&&u.width()>U.maxWidth){u.width(U.maxWidth)}}m.before(u).addClass("has_sb").hide().show();ae();K();l.hide();if(!m.is(":disabled")){m.bind("blur.sb",af).bind("focus.sb",n);v.mouseup(J).mouseup(S).click(b).focus(z).blur(j).hover(X,R);O().click(Q).hover(X,R);l.find(".optgroup").hover(X,R).click(b);ac.filter(".disabled").click(b);if(!e.browser.msie||e.browser.version>=9){e(d).resize(e.throttle?e.throttle(100,h):ab)}}else{u.addClass("disabled").attr("aria-disabled");v.click(function(ah){ah.preventDefault()})}u.bind("close.sb",w).bind("destroy.sb",s);m.bind("reload.sb",ad);if(e.fn.tie&&U.useTie){m.bind("domupdate.sb",Y)}};ab=function(){clearTimeout(i);i=setTimeout(h,50)};h=function(){if(u.is(".open")){ae();M(true)}};Z=function(ah,o){if(!ah){ah=e("<option value=''>&nbsp;</option>");o=0}var aj=e("<li id='sbo"+a()+"'></li>").attr("role","option").data("orig",ah[0]).data("value",ah?ah.attr("value"):"").addClass(ah.is(":selected")?"selected":"").addClass(ah.is(":disabled")?"disabled":"").attr("aria-disabled",ah.is(":disabled")?"true":""),ai=e("<div class='item'></div>"),ag=e("<div class='text'></div>").html(U.optionFormat.call(ah[0],0,o+1));return aj.append(ai.append(ag))};n=function(){t();v.triggerHandler("focus")};af=function(){if(!u.is(".open")){v.triggerHandler("blur")}};s=function(o){u.remove();m.unbind(".sb").removeClass("has_sb");e(d).unbind("resize",ab);if(!o){m.removeData("sb")}};ad=function(){var ag=u.is(".open"),o=v.is(".focused");w(true);s(true);q.init(U);if(ag){m.focus();M(true)}else{if(o){m.focus()}}};Y=function(){clearTimeout(V);V=setTimeout(ad,30)};x=function(){u.removeClass("focused");w();D()};D=function(){e(document).unbind("click",x).unbind("keyup",L).unbind("keypress",r).unbind("keydown",r).unbind("keydown",y)};A=function(){e(".sb.open."+U.selectboxClass).triggerAll("close")};t=function(){e(".sb.focused."+U.selectboxClass).not(u[0]).find(".display").blur()};F=function(){e(".sb.open."+U.selectboxClass).not(u[0]).triggerAll("close")};w=function(o){if(u.is(".open")){v.blur();ac.removeClass("hover");D();l.attr("aria-hidden","true");if(o===true){l.hide();u.removeClass("open");u.append(l)}else{l.fadeOut(U.animDuration,function(){u.removeClass("open");u.append(l)})}}};P=function(){var o=null;if(U.ddCtx==="self"){o=u}else{if(e.isFunction(U.ddCtx)){o=e(U.ddCtx.call(m[0]))}else{o=e(U.ddCtx)}}return o};H=function(){return ac.filter(".selected")};O=function(){return ac.not(".disabled")};aa=function(){l.scrollTop(l.scrollTop()+H().offsetFrom(l).top-l.height()/2+H().outerHeight(true)/2)};K=function(){if(e.browser.msie&&e.browser.version<8){e("."+U.selectboxClass+" .display").hide().show()}};M=function(ag){var o,ah=P();t();u.addClass("open");ah.append(l);o=ae();l.attr("aria-hidden","false");if(ag===true){l.show();aa()}else{if(o==="down"){l.slideDown(U.animDuration,aa)}else{l.fadeIn(U.animDuration,aa)}}m.focus()};ae=function(){var aj=P(),aq=0,ah=v.offsetFrom(aj).left,ag=0,ak="",an,o,ap,ao,ai,ar,am,al;l.removeClass("above");l.show().css({maxHeight:"none",position:"relative",visibility:"hidden"});if(!U.fixedWidth){l.width(v.outerWidth()-l.extraWidth()+0)}ap=e(d).scrollTop()+e(d).height()-v.offset().top-v.outerHeight();ao=v.offset().top-e(d).scrollTop();ai=v.offsetFrom(aj).top+v.outerHeight();ar=ap-ao+U.dropupThreshold;if(l.outerHeight()<ap){aq=U.maxHeight?U.maxHeight:ap;ag=ai;ak="down"}else{if(l.outerHeight()<ao){aq=U.maxHeight?U.maxHeight:ao;ag=v.offsetFrom(aj).top-Math.min(aq,l.outerHeight());ak="up"}else{if(ar>=0){aq=U.maxHeight?U.maxHeight:ap;ag=ai;ak="down"}else{if(ar<0){aq=U.maxHeight?U.maxHeight:ao;ag=v.offsetFrom(aj).top-Math.min(aq,l.outerHeight());ak="up"}else{aq=U.maxHeight?U.maxHeight:"none";ag=ai;ak="down"}}}}an=(""+e("body").css("margin-left")).match(/^\d+/)?e("body").css("margin-left"):0;o=(""+e("body").css("margin-top")).match(/^\d+/)?e("body").css("margin-top"):0;am=e().jquery>="1.4.2"?parseInt(an):e("body").offset().left;al=e().jquery>="1.4.2"?parseInt(o):e("body").offset().top;l.hide().css({left:ah+(aj.is("body")?am:0),maxHeight:aq,position:"absolute",top:ag+(aj.is("body")?al:0),visibility:"visible"});if(ak==="up"){l.addClass("above")}return ak};S=function(o){if(u.is(".open")){w()}else{M()}return false};E=function(){var ag=e(this),o=m.val(),ah=ag.data("value");m.find("option").each(function(){this.selected=false});e(ag.data("orig")).each(function(){this.selected=true});ac.removeClass("selected");ag.addClass("selected");u.attr("aria-active-descendant",ag.attr("id"));v.find(".text").attr("title",ag.find(".text").html());v.find(".text").html(U.displayFormat.call(ag.data("orig")));if(o!==ah){m.change()}};Q=function(o){x();m.focus();E.call(this);return false};B=function(){W=""};k=function(aj){var ai,ah,o,ag=O();for(ai=0;ai<ag.size();ai++){o=ag.eq(ai).find(".text");ah=o.children().size()==0?o.text():o.find("*").text();if(aj.length>0&&ah.toLowerCase().match("^"+aj.toLowerCase())){return ag.eq(ai)}}return null};N=function(ag){var o=k(ag);if(o!==null){E.call(o[0]);return true}return false};r=function(o){if(o.ctrlKey||o.altKey){return}if(o.which===38||o.which===40||o.which===8||o.which===32){o.preventDefault()}};p=function(aj){var ai,ah,o=H(),ag=O();for(ai=ag.index(o)+1;ai<ag.size();ai++){ah=ag.eq(ai).find(".text").text();if(ah!==""&&ah.substring(0,1).toLowerCase()===aj.toLowerCase()){E.call(ag.eq(ai)[0]);return true}}return false};y=function(ah){if(ah.altKey||ah.ctrlKey){return false}var ag=H(),o=O();switch(ah.which){case 9:w();j();break;case 35:if(ag.size()>0){ah.preventDefault();E.call(o.filter(":last")[0]);aa()}break;case 36:if(ag.size()>0){ah.preventDefault();E.call(o.filter(":first")[0]);aa()}break;case 38:if(ag.size()>0){if(o.filter(":first")[0]!==ag[0]){ah.preventDefault();E.call(o.eq(o.index(ag)-1)[0])}aa()}break;case 40:if(ag.size()>0){if(o.filter(":last")[0]!==ag[0]){ah.preventDefault();E.call(o.eq(o.index(ag)+1)[0]);aa()}}else{if(ac.size()>1){ah.preventDefault();E.call(ac.eq(0)[0])}}break;default:break}};L=function(o){if(o.altKey||o.ctrlKey){return false}if(o.which!==38&&o.which!==40){W+=String.fromCharCode(o.keyCode);if(N(W)){clearTimeout(G);G=setTimeout(B,U.acTimeout)}else{if(p(String.fromCharCode(o.keyCode))){aa();clearTimeout(G);G=setTimeout(B,U.acTimeout)}else{B();clearTimeout(G)}}}};z=function(){F();u.addClass("focused");e(document).click(x).keyup(L).keypress(r).keydown(r).keydown(y)};j=function(){u.removeClass("focused");v.removeClass("active");e(document).unbind("keyup",L).unbind("keydown",r).unbind("keypress",r).unbind("keydown",y)};X=function(){e(this).addClass("hover")};R=function(){e(this).removeClass("hover")};J=function(){v.addClass("active");e(document).bind("mouseup",I)};I=function(){v.removeClass("active");e(document).unbind("mouseup",I)};this.init=function(o){if(e.browser.msie&&e.browser.version<7){return}m=e(this.elem);if(m.attr("id")){C=e("label[for='"+m.attr("id")+"']:first")}if(!C||C.size()===0){C=m.closest("label")}if(m.hasClass("has_sb")){return}U=e.extend({acTimeout:800,animDuration:200,ddCtx:"body",dropupThreshold:150,fixedWidth:false,maxHeight:false,maxWidth:false,selectboxClass:"selectbox",useTie:false,arrowMarkup:"<div class='arrow_btn'><span class='arrow'></span></div>",displayFormat:g,optionFormat:function(ag,ai){if(e(this).size()>0){var ah=e(this).attr("label");if(ah&&ah.length>0){return ah}return e(this).text()}else{return""}},optgroupFormat:function(ag){return"<span class='label'>"+e(this).attr("label")+"</span>"}},o);U.displayFormat=U.displayFormat||U.optionFormat;T()};this.open=M;this.close=w;this.refresh=ad;this.destroy=s;this.options=function(o){U=e.extend(U,o);ad()}};e.proto("sb",f)}(jQuery,window));



/*
 * jQuery miniColors: A small color selector
 *
 * Copyright 2011 Cory LaViska for A Beautiful Site, LLC. (http://abeautifulsite.net/)
 *
 * Dual licensed under the MIT or GPL Version 2 licenses
 *
 *
 * Usage:
 *
 *  1. Link to jQuery: <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.5.0/jquery.min.js"></script>
 *
 *  2. Link to miniColors: <script type="text/javascript" src="jquery.miniColors.js"></script>
 *
 *  3. Include miniColors stylesheet: <link type="text/css" rel="stylesheet" href="jquery.miniColors.css" />
 *
 *  4. Apply $([selector]).miniColors() to one or more INPUT elements
 *
 *
 * Options:
 *
 *  disabled    [true|false]
 *  readonly    [true|false]
 *
 *
 *  Specify options on creation:
 *
 *    $([selector]).miniColors({
 *
 *      optionName: value,
 *      optionName: value,
 *      ...
 *
 *    });
 *
 *
 * Methods:
 *
 *  Call a method using: $([selector]).miniColors('methodName', [value]);
 *
 *  disabled    [true|false]
 *  readonly    [true|false]
 *  value      [hex value]
 *  destroy
 *
 *
 * Events:
 *
 *  Attach events on creation:
 *
 *    $([selector]).miniColors({
 *
 *      change: function(hex, rgb) { ... }
 *
 *    });
 *
 *  change(hex, rgb)  called when the color value changes; 'this' will refer to the original input element;
 *                      hex is the string hex value of the selected color; rgb is an object with the RGB values
 *
 *
 * Change log:
 *
 *  - v0.1 (2011-02-24) - Initial release
 *
 *
 * Attribution:
 *
 *  - The color picker icon is based on an icon from the amazing Fugue icon set: 
 *    http://p.yusukekamiyamane.com/
 *
 *  - The gradient image, the hue image, and the math functions are courtesy of 
 *    the eyecon.co jQuery color picker: http://www.eyecon.ro/colorpicker/
 *
 *
*/
if(jQuery) (function($) {
  
  $.extend($.fn, {
    
    miniColors: function(o, data) {
      
      var clickCnt = 0;
      
      var create = function(input, o, data) {
        
        //
        // Creates a new instance of the miniColors selector
        //
        
        // Determine initial color (defaults to white)
        var color = cleanHex(input.val());
        if( !color ) color = 'FFFFFF';
        var hsb = hex2hsb(color);
        
        // Create trigger
        var trigger = $('<a class="miniColors-trigger" style="background-color: #' + color + '" href="#"></a>');
        trigger.insertAfter(input);
        
        // Add necessary attributes
        input.addClass('miniColors').attr('maxlength', 7).attr('autocomplete', 'off');
        
        // Set input data
        input.data('trigger', trigger);
        input.data('hsb', hsb);
        if( o.change ) input.data('change', o.change);
        
        // Handle options
        if( o.readonly ) input.attr('readonly', true);
        if( o.disabled ) disable(input);
        
        // Show selector when trigger is clicked
        trigger.bind('click.miniColors', function(event) {
          event.preventDefault();
          if (clickCnt % 2 === 0)
            input.trigger('focus');
          clickCnt++;
        });
        
        // Show selector when input receives focus
        input.bind('focus.miniColors', function(event) {
          show(input);
        });
        
        // Hide on blur
        input.bind('blur.miniColors', function(event) {
          var hex = cleanHex(input.val());
          input.val( hex ? '#' + hex : '' );
        });
        
        // Hide when tabbing out of the input
        input.bind('keydown.miniColors', function(event) {
          if( event.keyCode === 9 ) hide(input);
        });
        
        // Update when color is typed in
        input.bind('keyup.miniColors', function(event) {
          // Remove non-hex characters
          var filteredHex = input.val().replace(/[^A-F0-9#]/ig, '');
          input.val(filteredHex);
          if( !setColorFromInput(input) ) {
            // Reset trigger color when color is invalid
            input.data('trigger').css('backgroundColor', '#FFF');
          }
        });
        
        // Handle pasting
        input.bind('paste.miniColors', function(event) {
          // Short pause to wait for paste to complete
          setTimeout( function() {
            input.trigger('keyup');
          }, 5);
        });
        
      };
      
      
      var destroy = function(input) {
        
        //
        // Destroys an active instance of the miniColors selector
        //
        
        hide();
        
        input = $(input);
        input.data('trigger').remove();
        input.removeAttr('autocomplete');
        input.removeData('trigger');
        input.removeData('selector');
        input.removeData('hsb');
        input.removeData('huePicker');
        input.removeData('colorPicker');
        input.removeData('mousebutton');
        input.removeData('moving');
        input.unbind('click.miniColors');
        input.unbind('focus.miniColors');
        input.unbind('blur.miniColors');
        input.unbind('keyup.miniColors');
        input.unbind('keydown.miniColors');
        input.unbind('paste.miniColors');
        $(document).unbind('mousedown.miniColors');
        $(document).unbind('mousemove.miniColors');
        
      };
      
      
      var enable = function(input) {
        
        //
        // Disables the input control and the selector
        //
        
        input.attr('disabled', false);
        input.data('trigger').css('opacity', 1);
        
      };
      
      
      var disable = function(input) {
        
        //
        // Disables the input control and the selector
        //
        
        hide(input);
        input.attr('disabled', true);
        input.data('trigger').css('opacity', .5);
        
      };
      
      
      var show = function(input) {
        
        //
        // Shows the miniColors selector
        //
        
        if( input.attr('disabled') ) return false;
        
        // Hide all other instances
        hide();
        
        // Generate the selector
        var selector = $('<div class="miniColors-selector"></div>');
        selector.append('<div class="miniColors-colors" style="background-color: #FFF;"><div class="miniColors-colorPicker"></div></div>');
        selector.append('<div class="miniColors-hues"><div class="miniColors-huePicker"></div></div>');
        selector.css({
          top: input.is(':visible') ? input.offset().top + input.outerHeight() : input.data('trigger').offset().top,// + input.data('trigger').outerHeight(),
          left: input.is(':visible') ? input.offset().left : input.data('trigger').offset().left - 175 - 13,
          display: 'none'
        }).addClass( input.attr('class') );
        
        // Set background for colors
        var hsb = input.data('hsb');
        selector.find('.miniColors-colors').css('backgroundColor', '#' + hsb2hex({ h: hsb.h, s: 100, b: 100 }));
        
        // Set colorPicker position
        var colorPosition = input.data('colorPosition');
        if( !colorPosition ) colorPosition = getColorPositionFromHSB(hsb);
        selector.find('.miniColors-colorPicker').css('top', colorPosition.y + 'px').css('left', colorPosition.x + 'px');
        
        // Set huePicker position
        var huePosition = input.data('huePosition');
        if( !huePosition ) huePosition = getHuePositionFromHSB(hsb);
        selector.find('.miniColors-huePicker').css('top', huePosition.y + 'px');
        
        
        // Set input data
        input.data('selector', selector);
        input.data('huePicker', selector.find('.miniColors-huePicker'));
        input.data('colorPicker', selector.find('.miniColors-colorPicker'));
        input.data('mousebutton', 0);
        
        $('BODY').append(selector);
        selector.fadeIn(50);
        
        // Prevent text selection in IE
        selector.bind('selectstart', function() { return false; });
        
        $(document).bind('mousedown.miniColors', function(event) {
          input.data('mousebutton', 1);
          
          if( $(event.target).parents().andSelf().hasClass('miniColors-colors') ) {
            event.preventDefault();
            input.data('moving', 'colors');
            moveColor(input, event);
          }
          
          if( $(event.target).parents().andSelf().hasClass('miniColors-hues') ) {
            event.preventDefault();
            input.data('moving', 'hues');
            moveHue(input, event);
          }
          
          if( $(event.target).parents().andSelf().hasClass('miniColors-selector') ) {
            event.preventDefault();
            return;
          }
          
          if( $(event.target).parents().andSelf().hasClass('miniColors') ) return;
          
          if (!$(event.target).hasClass('miniColors-trigger')) {
            clickCnt++;
          }
          
          hide(input);
        });
        
        $(document).bind('mouseup.miniColors', function(event) {
          input.data('mousebutton', 0);
          input.removeData('moving');
        });
        
        $(document).bind('mousemove.miniColors', function(event) {
          if( input.data('mousebutton') === 1 ) {
            if( input.data('moving') === 'colors' ) moveColor(input, event);
            if( input.data('moving') === 'hues' ) moveHue(input, event);
          }
        });
        
      };
      
      
      var hide = function(input) {
        
        //
        // Hides one or more miniColors selectors
        //
        
        // Hide all other instances if input isn't specified
        if ( !input ) input = '.miniColors';
        
        $(input).each( function() {
          var selector = $(this).data('selector');
          $(this).removeData('selector');
          $(selector).fadeOut(50, function() {
            $(this).remove();
          });
        });
        
        $(document).unbind('mousedown.miniColors');
        $(document).unbind('mousemove.miniColors');
        
      };
      
      
      var moveColor = function(input, event) {
        
        var colorPicker = input.data('colorPicker');
        
        colorPicker.hide();
        
        var position = {
          x: event.clientX - input.data('selector').find('.miniColors-colors').offset().left + $(document).scrollLeft() - 5,
          y: event.clientY - input.data('selector').find('.miniColors-colors').offset().top + $(document).scrollTop() - 5
        };
        
        if( position.x <= -5 ) position.x = -5;
        if( position.x >= 144 ) position.x = 144;
        if( position.y <= -5 ) position.y = -5;
        if( position.y >= 144 ) position.y = 144;
        input.data('colorPosition', position);
        colorPicker.css('left', position.x).css('top', position.y).show();
        
        // Calculate saturation
        var s = Math.round((position.x + 5) * .67);
        if( s < 0 ) s = 0;
        if( s > 100 ) s = 100;
        
        // Calculate brightness
        var b = 100 - Math.round((position.y + 5) * .67);
        if( b < 0 ) b = 0;
        if( b > 100 ) b = 100;
        
        // Update HSB values
        var hsb = input.data('hsb');
        hsb.s = s;
        hsb.b = b;
        
        // Set color
        setColor(input, hsb, true);
        
      };
      
      
      var moveHue = function(input, event) {
        
        var huePicker = input.data('huePicker');
        
        huePicker.hide();
        
        var position = {
          y: event.clientY - input.data('selector').find('.miniColors-colors').offset().top + $(document).scrollTop() - 1
        };
        
        if( position.y <= -1 ) position.y = -1;
        if( position.y >= 149 ) position.y = 149;
        input.data('huePosition', position);
        huePicker.css('top', position.y).show();
        
        // Calculate hue
        var h = Math.round((150 - position.y - 1) * 2.4);
        if( h < 0 ) h = 0;
        if( h > 360 ) h = 360;
        
        // Update HSB values
        var hsb = input.data('hsb');
        hsb.h = h;
        
        // Set color
        setColor(input, hsb, true);
        
      };
      
      
      var setColor = function(input, hsb, updateInputValue) {
        
        input.data('hsb', hsb);
        var hex = hsb2hex(hsb);  
        if( updateInputValue ) input.val('#' + hex);
        input.data('trigger').css('backgroundColor', '#' + hex);
        if( input.data('selector') ) input.data('selector').find('.miniColors-colors').css('backgroundColor', '#' + hsb2hex({ h: hsb.h, s: 100, b: 100 }));
        
        if( input.data('change') ) {
          input.data('change').call(input, '#' + hex, hsb2rgb(hsb));
        }
        
      };
      
      
      var setColorFromInput = function(input) {
        
        // Don't update if the hex color is invalid
        var hex = cleanHex(input.val());
        if( !hex ) return false;
        
        // Get HSB equivalent
        var hsb = hex2hsb(hex);
        
        // If color is the same, no change required
        var currentHSB = input.data('hsb');
        if( hsb.h === currentHSB.h && hsb.s === currentHSB.s && hsb.b === currentHSB.b ) return true;
        
        // Set colorPicker position
        var colorPosition = getColorPositionFromHSB(hsb);
        var colorPicker = $(input.data('colorPicker'));
        colorPicker.css('top', colorPosition.y + 'px').css('left', colorPosition.x + 'px');
        
        // Set huePosition position
        var huePosition = getHuePositionFromHSB(hsb);
        var huePicker = $(input.data('huePicker'));
        huePicker.css('top', huePosition.y + 'px');
        
        setColor(input, hsb, false);
        
        return true;
        
      };
      
      
      var getColorPositionFromHSB = function(hsb) {
        
        var x = Math.ceil(hsb.s / .67);
        if( x < 0 ) x = 0;
        if( x > 150 ) x = 150;
        
        var y = 150 - Math.ceil(hsb.b / .67);
        if( y < 0 ) y = 0;
        if( y > 150 ) y = 150;
        
        return { x: x - 5, y: y - 5 };
        
      }
      
      
      var getHuePositionFromHSB = function(hsb) {
        
        var y = 150 - (hsb.h / 2.4);
        if( y < 0 ) h = 0;
        if( y > 150 ) h = 150;        
        
        return { y: y - 1 };
        
      }
      
      
      var cleanHex = function(hex) {
        
        //
        // Turns a dirty hex string into clean, 6-character hex color
        //
        
        hex = hex.replace(/[^A-Fa-f0-9]/, '');
        
        if( hex.length == 3 ) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        return hex.length === 6 ? hex : null;
        
      };      
      
      
      var hsb2rgb = function(hsb) {
        var rgb = {};
        var h = Math.round(hsb.h);
        var s = Math.round(hsb.s*255/100);
        var v = Math.round(hsb.b*255/100);
        if(s == 0) {
          rgb.r = rgb.g = rgb.b = v;
        } else {
          var t1 = v;
          var t2 = (255 - s) * v / 255;
          var t3 = (t1 - t2) * (h % 60) / 60;
          if( h == 360 ) h = 0;
          if( h < 60 ) { rgb.r = t1; rgb.b = t2; rgb.g = t2 + t3; }
          else if( h<120 ) {rgb.g = t1; rgb.b = t2; rgb.r = t1 - t3; }
          else if( h<180 ) {rgb.g = t1; rgb.r = t2; rgb.b = t2 + t3; }
          else if( h<240 ) {rgb.b = t1; rgb.r = t2; rgb.g = t1 - t3; }
          else if( h<300 ) {rgb.b = t1; rgb.g = t2; rgb.r = t2 + t3; }
          else if( h<360 ) {rgb.r = t1; rgb.g = t2; rgb.b = t1 - t3; }
          else { rgb.r = 0; rgb.g = 0; rgb.b = 0; }
        }
        return {
          r: Math.round(rgb.r),
          g: Math.round(rgb.g),
          b: Math.round(rgb.b)
        };
      };
      
      
      var rgb2hex = function(rgb) {
        
        var hex = [
          rgb.r.toString(16),
          rgb.g.toString(16),
          rgb.b.toString(16)
        ];
        $.each(hex, function(nr, val) {
          if (val.length == 1) hex[nr] = '0' + val;
        });
        
        return hex.join('');
      };
      
      
      var hex2rgb = function(hex) {
        var hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
        
        return {
          r: hex >> 16,
          g: (hex & 0x00FF00) >> 8,
          b: (hex & 0x0000FF)
        };
      };
      
      
      var rgb2hsb = function(rgb) {
        var hsb = { h: 0, s: 0, b: 0 };
        var min = Math.min(rgb.r, rgb.g, rgb.b);
        var max = Math.max(rgb.r, rgb.g, rgb.b);
        var delta = max - min;
        hsb.b = max;
        hsb.s = max != 0 ? 255 * delta / max : 0;
        if( hsb.s != 0 ) {
          if( rgb.r == max ) {
            hsb.h = (rgb.g - rgb.b) / delta;
          } else if( rgb.g == max ) {
            hsb.h = 2 + (rgb.b - rgb.r) / delta;
          } else {
            hsb.h = 4 + (rgb.r - rgb.g) / delta;
          }
        } else {
          hsb.h = -1;
        }
        hsb.h *= 60;
        if( hsb.h < 0 ) {
          hsb.h += 360;
        }
        hsb.s *= 100/255;
        hsb.b *= 100/255;
        return hsb;
      };      
      
      
      var hex2hsb = function(hex) {
        var hsb = rgb2hsb(hex2rgb(hex));
        // Zero out hue marker for black, white, and grays (saturation === 0)
        if( hsb.s === 0 ) hsb.h = 360;
        return hsb;
      };
      
      
      var hsb2hex = function(hsb) {
        return rgb2hex(hsb2rgb(hsb));
      };

      
      //
      // Handle calls to $([selector]).miniColors()
      //
      switch(o) {
      
        case 'readonly':
          
          $(this).each( function() {
            $(this).attr('readonly', data);
          });
          
          return $(this);
          
          break;
        
        case 'disabled':
          
          $(this).each( function() {
            if( data ) {
              disable($(this));
            } else {
              enable($(this));
            }
          });
                    
          return $(this);
      
        case 'value':
          
          $(this).each( function() {
            $(this).val(data).trigger('keyup');
          });
          
          return $(this);
          
          break;
          
        case 'destroy':
          
          $(this).each( function() {
            destroy($(this));
          });
                    
          return $(this);
        
        default:
          
          if( !o ) o = {};
          
          $(this).each( function() {
            
            // Must be called on an input element
            if( $(this)[0].tagName.toLowerCase() !== 'input' ) return;
            
            // If a trigger is present, the control was already created
            if( $(this).data('trigger') ) return;
            
            // Create the control
            create($(this), o, data);
            
          });
                    
          return $(this);
          
      }
      
      
    }

      
  });
  
})(jQuery);





/**
 * jQuery.contextMenu - Show a custom context when right clicking something
 * Jonas Arnklint, http://github.com/arnklint/jquery-contextMenu
 * Released into the public domain
 * Date: Jan 14, 2011
 * @author Jonas Arnklint
 * @version 1.3
 *
*/
// Making a local '$' alias of jQuery to support jQuery.noConflict
(function($) {
  jQuery.fn.contextMenu = function ( name, actions, options ) {
    var me = this,
    menu = $('<ul id="'+name+'" class="context-menu"></ul>').hide().appendTo('body'),
    activeElement = null, // last clicked element that responds with contextMenu
    hideMenu = function() {
      $('.context-menu:visible').each(function() {
        $(this).trigger("closed");
        $(this).hide();
        $('body').unbind('click', hideMenu);
      });
    },
    default_options = {
      disable_native_context_menu: false, // disables the native contextmenu everywhere you click
      leftClick: false // show menu on left mouse click instead of right
    },
    options = $.extend(default_options, options);
 
    $(document).bind('contextmenu', function(e) {
      if (options.disable_native_context_menu) {
        e.preventDefault();
      }
      hideMenu();
    });
 
    $.each(actions, function(me, itemOptions) {
      var menuItem = $('<li>'+me+'</li>');
 
      if (itemOptions.klass) {
        menuItem.attr("class", itemOptions.klass);
      }
 
      menuItem.appendTo(menu).bind('click', function(e) {
        itemOptions.click(activeElement);
        e.preventDefault();
      });
    });
 
 
    return me.bind('contextmenu click', function(e){
      // Hide any existing context menus
      hideMenu();
 
      if( (options.leftClick && e.button == 0) || (options.leftClick == false && e.button == 2) ){
 
        activeElement = $(this); // set clicked element
 
        if (options.showMenu) {
          options.showMenu.call(menu, activeElement);
        }
 
        // Bind to the closed event if there is a hideMenu handler specified
        if (options.hideMenu) {
          menu.bind("closed", function() {
            options.hideMenu.call(menu, activeElement);
          });
        }
 
        menu.css({
          visibility: 'hidden',
          position: 'absolute',
          zIndex: 1000
        });
 
        // include margin so it can be used to offset from page border.
        var mWidth = menu.outerWidth(true),
          mHeight = menu.outerHeight(true),
          xPos = ((e.pageX - window.scrollX) + mWidth < window.innerWidth) ? e.pageX : e.pageX - 0,//mWidth,
          yPos = ((e.pageY - window.scrollY) + mHeight < window.innerHeight) ? e.pageY : e.pageY - mHeight;
 
        menu.show(0, function() {
          $('body').bind('click', hideMenu);
        }).css({
          visibility: 'visible',
          top: yPos + 'px',
          left: xPos + 'px',
          zIndex: 1000
        });
 
        return false;
      }
    });
  }
})(jQuery);



