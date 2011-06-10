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
  context.initializeMouseDown(event, g, context);
  if (event.altKey || event.shiftKey) {
    Dygraph.startZoom(event, g, context);
  } else {
    Dygraph.startPan(event, g, context);
  }
}

function moveV3(event, g, context) {
  if (context.isPanning) {
    Dygraph.movePan(event, g, context);
  } else if (context.isZooming) {
    for (var i = 0, len = g.siblings.length; i < len; i++) {
      Dygraph.moveZoom(event, g.siblings[i], context, g);
    }
  }
}

function upV3(event, g, context) {
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
  var yAxes = g.yAxisRanges();
  var newYAxes = [];
  for (var i = 0; i < yAxes.length; i++) {
    newYAxes[i] = adjustAxis(yAxes[i], zoomInPercentage, yBias);
  }

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



