/*  node.js
 *  Some boilerplate definitions and functions to make node
 */

/* Define some C-like macros for debugging */
/* Return stack */
Object.defineProperty(global, '__stack', {
get: function() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

/* Return Line number */
Object.defineProperty(global, '__line', {
get: function() {
        return __stack[1].getLineNumber();
    }
});

/* Return function name */
Object.defineProperty(global, '__function', {
get: function() {
        return __stack[1].getFunctionName();
    }
});

