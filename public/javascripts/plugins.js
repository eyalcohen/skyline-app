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
    Dygraph.moveZoom(event, g, context);
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
 *  jQuery selectBox (version 1.0.7)
 *
 *  Copyright 2011 Cory LaViska for A Beautiful Site, LLC.
 *
 *  http://abeautifulsite.net/blog/2011/01/jquery-selectbox-plugin/
 *
 */
if(jQuery)(function($){$.extend($.fn,{selectBox:function(method,data){var typeTimer,typeSearch='';var init=function(select,data){if(navigator.userAgent.match(/iPad|iPhone|Android/i))return false;if(select.tagName.toLowerCase()!=='select')return false;select=$(select);if(select.data('selectBox-control'))return false;var control=$('<a class="selectBox" />'),inline=select.attr('multiple')||parseInt(select.attr('size'))>1;var settings=data||{};if(settings.autoWidth===undefined)settings.autoWidth=true;control.addClass(select.attr('class')).attr('style',select.attr('style')||'').attr('title',select.attr('title')||'').attr('tabindex',parseInt(select.attr('tabindex'))).css('display','inline-block').bind('focus.selectBox',function(){if(this!==document.activeElement)$(document.activeElement).blur();if(control.hasClass('selectBox-active'))return;control.addClass('selectBox-active');select.trigger('focus')}).bind('blur.selectBox',function(){if(!control.hasClass('selectBox-active'))return;control.removeClass('selectBox-active');select.trigger('blur')});if(select.attr('disabled'))control.addClass('selectBox-disabled');if(inline){var options=getOptions(select,'inline');control.append(options).data('selectBox-options',options).addClass('selectBox-inline').addClass('selectBox-menuShowing').bind('keydown.selectBox',function(event){handleKeyDown(select,event)}).bind('keypress.selectBox',function(event){handleKeyPress(select,event)}).bind('mousedown.selectBox',function(event){if($(event.target).is('A.selectBox-inline'))event.preventDefault();if(!control.hasClass('selectBox-focus'))control.focus()}).insertAfter(select);if(!select[0].style.height){var size=select.attr('size')?parseInt(select.attr('size')):5;var tmp=control.clone().removeAttr('id').css({position:'absolute',top:'-9999em'}).show().appendTo('body');tmp.find('.selectBox-options').html('<li><a>\u00A0</a></li>');optionHeight=parseInt(tmp.find('.selectBox-options A:first').html('&nbsp;').outerHeight());tmp.remove();control.height(optionHeight*size)}disableSelection(control)}else{var label=$('<span class="selectBox-label" />'),arrow=$('<span class="selectBox-arrow" />');label.text($(select).find('OPTION:selected').text()||'\u00A0');var options=getOptions(select,'dropdown');options.appendTo('BODY');control.data('selectBox-options',options).addClass('selectBox-dropdown').append(label).append(arrow).bind('mousedown.selectBox',function(event){if(control.hasClass('selectBox-menuShowing')){hideMenus()}else{event.stopPropagation();options.data('selectBox-down-at-x',event.screenX).data('selectBox-down-at-y',event.screenY);showMenu(select)}}).bind('keydown.selectBox',function(event){handleKeyDown(select,event)}).bind('keypress.selectBox',function(event){handleKeyPress(select,event)}).insertAfter(select);disableSelection(control)}select.addClass('selectBox').data('selectBox-control',control).data('selectBox-settings',settings).hide()};var getOptions=function(select,type){var options;switch(type){case'inline':options=$('<ul class="selectBox-options" />');if(select.find('OPTGROUP').length){select.find('OPTGROUP').each(function(){var optgroup=$('<li class="selectBox-optgroup" />');optgroup.text($(this).attr('label'));options.append(optgroup);$(this).find('OPTION').each(function(){var li=$('<li />'),a=$('<a />');li.addClass($(this).attr('class'));a.attr('rel',$(this).val()).text($(this).text());li.append(a);if($(this).attr('disabled'))li.addClass('selectBox-disabled');if($(this).attr('selected'))li.addClass('selectBox-selected');options.append(li)})})}else{select.find('OPTION').each(function(){var li=$('<li />'),a=$('<a />');li.addClass($(this).attr('class'));a.attr('rel',$(this).val()).text($(this).text());li.append(a);if($(this).attr('disabled'))li.addClass('selectBox-disabled');if($(this).attr('selected'))li.addClass('selectBox-selected');options.append(li)})}options.find('A').bind('mouseover.selectBox',function(event){addHover(select,$(this).parent())}).bind('mouseout.selectBox',function(event){removeHover(select,$(this).parent())}).bind('mousedown.selectBox',function(event){event.preventDefault();if(!select.selectBox('control').hasClass('selectBox-active'))select.selectBox('control').focus()}).bind('mouseup.selectBox',function(event){hideMenus();selectOption(select,$(this).parent(),event)});disableSelection(options);return options;case'dropdown':options=$('<ul class="selectBox-dropdown-menu selectBox-options" />');if(select.find('OPTGROUP').length){select.find('OPTGROUP').each(function(){var optgroup=$('<li class="selectBox-optgroup" />');optgroup.text($(this).attr('label'));options.append(optgroup);$(this).find('OPTION').each(function(){var li=$('<li />'),a=$('<a />');li.addClass($(this).attr('class'));a.attr('rel',$(this).val()).text($(this).text());li.append(a);if($(this).attr('disabled'))li.addClass('selectBox-disabled');if($(this).attr('selected'))li.addClass('selectBox-selected');options.append(li)})})}else{if(select.find('OPTION').length>0){select.find('OPTION').each(function(){var li=$('<li />'),a=$('<a />');li.addClass($(this).attr('class'));a.attr('rel',$(this).val()).text($(this).text());li.append(a);if($(this).attr('disabled'))li.addClass('selectBox-disabled');if($(this).attr('selected'))li.addClass('selectBox-selected');options.append(li)})}else{options.append('<li>\u00A0</li>')}}options.data('selectBox-select',select).css('display','none').appendTo('BODY').find('A').bind('mousedown.selectBox',function(event){event.preventDefault();if(event.screenX===options.data('selectBox-down-at-x')&&event.screenY===options.data('selectBox-down-at-y')){options.removeData('selectBox-down-at-x').removeData('selectBox-down-at-y');hideMenus()}}).bind('mouseup.selectBox',function(event){if(event.screenX===options.data('selectBox-down-at-x')&&event.screenY===options.data('selectBox-down-at-y')){return}else{options.removeData('selectBox-down-at-x').removeData('selectBox-down-at-y')}selectOption(select,$(this).parent());hideMenus()}).bind('mouseover.selectBox',function(event){addHover(select,$(this).parent())}).bind('mouseout.selectBox',function(event){removeHover(select,$(this).parent())});disableSelection(options);return options}};var destroy=function(select){select=$(select);var control=select.data('selectBox-control');if(!control)return;var options=control.data('selectBox-options');options.remove();control.remove();select.removeClass('selectBox').removeData('selectBox-control').removeData('selectBox-settings').show()};var showMenu=function(select){select=$(select);var control=select.data('selectBox-control'),settings=select.data('selectBox-settings'),options=control.data('selectBox-options');if(control.hasClass('selectBox-disabled'))return false;hideMenus();if(settings.autoWidth)options.css('width',control.outerWidth()-(parseInt(control.css('borderLeftWidth'))+parseInt(control.css('borderLeftWidth'))));options.css({top:control.offset().top+control.outerHeight()-(parseInt(control.css('borderBottomWidth'))),left:control.offset().left});switch(settings.menuTransition){case'fade':options.fadeIn(settings.menuSpeed);break;case'slide':options.slideDown(settings.menuSpeed);break;default:options.show(settings.menuSpeed);break}var li=options.find('.selectBox-selected:first');keepOptionInView(select,li,true);addHover(select,li);control.addClass('selectBox-menuShowing');$(document).bind('mousedown.selectBox',function(event){if($(event.target).parents().andSelf().hasClass('selectBox-options'))return;hideMenus()})};var hideMenus=function(){if($(".selectBox-dropdown-menu").length===0)return;$(document).unbind('mousedown.selectBox');$(".selectBox-dropdown-menu").each(function(){var options=$(this),select=options.data('selectBox-select'),control=select.data('selectBox-control'),settings=select.data('selectBox-settings');switch(settings.menuTransition){case'fade':options.fadeOut(settings.menuSpeed);break;case'slide':options.slideUp(settings.menuSpeed);break;default:options.hide(settings.menuSpeed);break}control.removeClass('selectBox-menuShowing')})};var selectOption=function(select,li,event){select=$(select);li=$(li);var control=select.data('selectBox-control'),settings=select.data('selectBox-settings');if(control.hasClass('selectBox-disabled'))return false;if(li.length===0||li.hasClass('selectBox-disabled'))return false;if(select.attr('multiple')){if(event.shiftKey&&control.data('selectBox-last-selected')){li.toggleClass('selectBox-selected');var affectedOptions;if(li.index()>control.data('selectBox-last-selected').index()){affectedOptions=li.siblings().slice(control.data('selectBox-last-selected').index(),li.index())}else{affectedOptions=li.siblings().slice(li.index(),control.data('selectBox-last-selected').index())}affectedOptions=affectedOptions.not('.selectBox-optgroup, .selectBox-disabled');if(li.hasClass('selectBox-selected')){affectedOptions.addClass('selectBox-selected')}else{affectedOptions.removeClass('selectBox-selected')}}else if(event.metaKey){li.toggleClass('selectBox-selected')}else{li.siblings().removeClass('selectBox-selected');li.addClass('selectBox-selected')}}else{li.siblings().removeClass('selectBox-selected');li.addClass('selectBox-selected')}if(control.hasClass('selectBox-dropdown')){control.find('.selectBox-label').text(li.text())}var i=0,selection=[];if(select.attr('multiple')){control.find('.selectBox-selected A').each(function(){selection[i++]=$(this).attr('rel')})}else{selection=li.find('A').attr('rel')}control.data('selectBox-last-selected',li);if(select.val()!==selection){select.val(selection);select.trigger('change')}return true};var addHover=function(select,li){select=$(select);li=$(li);var control=select.data('selectBox-control'),options=control.data('selectBox-options');options.find('.selectBox-hover').removeClass('selectBox-hover');li.addClass('selectBox-hover')};var removeHover=function(select,li){select=$(select);li=$(li);var control=select.data('selectBox-control'),options=control.data('selectBox-options');options.find('.selectBox-hover').removeClass('selectBox-hover')};var keepOptionInView=function(select,li,center){if(!li||li.length===0)return;select=$(select);var control=select.data('selectBox-control'),options=control.data('selectBox-options'),scrollBox=control.hasClass('selectBox-dropdown')?options:options.parent(),top=parseInt(li.offset().top-scrollBox.position().top),bottom=parseInt(top+li.outerHeight());if(center){scrollBox.scrollTop(li.offset().top-scrollBox.offset().top+scrollBox.scrollTop()-(scrollBox.height()/2))}else{if(top<0){scrollBox.scrollTop(li.offset().top-scrollBox.offset().top+scrollBox.scrollTop())}if(bottom>scrollBox.height()){scrollBox.scrollTop((li.offset().top+li.outerHeight())-scrollBox.offset().top+scrollBox.scrollTop()-scrollBox.height())}}};var handleKeyDown=function(select,event){select=$(select);var control=select.data('selectBox-control'),options=control.data('selectBox-options'),totalOptions=0,i=0;if(control.hasClass('selectBox-disabled'))return;switch(event.keyCode){case 8:event.preventDefault();typeSearch='';break;case 9:case 27:hideMenus();removeHover(select);break;case 13:if(control.hasClass('selectBox-menuShowing')){selectOption(select,options.find('LI.selectBox-hover:first'),event);if(control.hasClass('selectBox-dropdown'))hideMenus()}else{showMenu(select)}break;case 38:case 37:event.preventDefault();if(control.hasClass('selectBox-menuShowing')){var prev=options.find('.selectBox-hover').prev('LI');totalOptions=options.find('LI:not(.selectBox-optgroup)').length;i=0;while(prev.length===0||prev.hasClass('selectBox-disabled')||prev.hasClass('selectBox-optgroup')){prev=prev.prev('LI');if(prev.length===0)prev=options.find('LI:last');if(++i>=totalOptions)break}addHover(select,prev);keepOptionInView(select,prev)}else{showMenu(select)}break;case 40:case 39:event.preventDefault();if(control.hasClass('selectBox-menuShowing')){var next=options.find('.selectBox-hover').next('LI');totalOptions=options.find('LI:not(.selectBox-optgroup)').length;i=0;while(next.length===0||next.hasClass('selectBox-disabled')||next.hasClass('selectBox-optgroup')){next=next.next('LI');if(next.length===0)next=options.find('LI:first');if(++i>=totalOptions)break}addHover(select,next);keepOptionInView(select,next)}else{showMenu(select)}break}};var handleKeyPress=function(select,event){select=$(select);var control=select.data('selectBox-control'),options=control.data('selectBox-options');if(control.hasClass('selectBox-disabled'))return;switch(event.keyCode){case 9:case 27:case 13:case 38:case 37:case 40:case 39:break;default:if(!control.hasClass('selectBox-menuShowing'))showMenu(select);event.preventDefault();clearTimeout(typeTimer);typeSearch+=String.fromCharCode(event.charCode||event.keyCode);options.find('A').each(function(){if($(this).text().substr(0,typeSearch.length).toLowerCase()===typeSearch.toLowerCase()){addHover(select,$(this).parent());keepOptionInView(select,$(this).parent());return false}});typeTimer=setTimeout(function(){typeSearch=''},1000);break}};var enable=function(select){select=$(select);select.attr('disabled',false);var control=select.data('selectBox-control');if(!control)return;control.removeClass('selectBox-disabled')};var disable=function(select){select=$(select);select.attr('disabled',true);var control=select.data('selectBox-control');if(!control)return;control.addClass('selectBox-disabled')};var setValue=function(select,value){select=$(select);select.val(value);value=select.val();var control=select.data('selectBox-control');if(!control)return;var settings=select.data('selectBox-settings'),options=control.data('selectBox-options');control.find('.selectBox-label').text($(select).find('OPTION:selected').text()||'\u00A0');options.find('.selectBox-selected').removeClass('selectBox-selected');options.find('A').each(function(){if(typeof(value)==='object'){for(var i=0;i<value.length;i++){if($(this).attr('rel')==value[i]){$(this).parent().addClass('selectBox-selected')}}}else{if($(this).attr('rel')==value){$(this).parent().addClass('selectBox-selected')}}});if(settings.change)settings.change.call(select)};var setOptions=function(select,options){select=$(select);var control=select.data('selectBox-control'),settings=select.data('selectBox-settings');switch(typeof(data)){case'string':select.html(data);break;case'object':select.html('');for(var i in data){if(data[i]===null)continue;if(typeof(data[i])==='object'){var optgroup=$('<optgroup label="'+i+'" />');for(var j in data[i]){optgroup.append('<option value="'+j+'">'+data[i][j]+'</option>')}select.append(optgroup)}else{var option=$('<option value="'+i+'">'+data[i]+'</option>');select.append(option)}}break}if(!control)return;control.data('selectBox-options').remove();var type=control.hasClass('selectBox-dropdown')?'dropdown':'inline',options=getOptions(select,type);control.data('selectBox-options',options);switch(type){case'inline':control.append(options);break;case'dropdown':control.find('.selectBox-label').text($(select).find('OPTION:selected').text()||'\u00A0');$("BODY").append(options);break}};var disableSelection=function(selector){$(selector).css('MozUserSelect','none').bind('selectstart',function(event){event.preventDefault()})};switch(method){case'control':return $(this).data('selectBox-control');break;case'settings':if(!data)return $(this).data('selectBox-settings');$(this).each(function(){$(this).data('selectBox-settings',$.extend(true,$(this).data('selectBox-settings'),data))});break;case'options':$(this).each(function(){setOptions(this,data)});break;case'value':if(!data)return $(this).val();$(this).each(function(){setValue(this,data)});break;case'enable':$(this).each(function(){enable(this)});break;case'disable':$(this).each(function(){disable(this)});break;case'destroy':$(this).each(function(){destroy(this)});break;default:$(this).each(function(){init(this,method)});break}return $(this)}})})(jQuery);



