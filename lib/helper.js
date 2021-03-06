// core framework functions

module.exports = function (config) {
    var events = require('events'),
        fs = require('fs'),
        handlebars = require('handlebars'),
        util = require('util'),
        methods = {

            public: {

                cachePatterns: function () {
                    var patterns = {},
                        patternFiles = fs.readdirSync(config.directories.patterns),
                        patternName = '',
                        patternFileName = '',
                        viewContents = '',
                        regex = new RegExp(/^([A-Za-z0-9-_])*$/);

                    patternFiles.forEach( function (patternFileName, index, array) {
                        if ( regex.test(patternFileName) ) {
                            patternName = patternFileName.replace('-', '_');
                            try {
                                viewContents = fs.readFileSync(config.directories.patterns + '/' + patternFileName + '/' + patternFileName + '.html', { 'encoding': 'utf8' });
                                viewContents = viewContents.replace(/[\n|\t|\r]/g, '');
                                viewContents = viewContents.replace(/'/g, "\\'");
                                patterns[patternName] = {
                                    model: require(config.directories.patterns + '/' + patternFileName + '/' + patternFileName + '-model'),
                                    controller: require(config.directories.patterns + '/' + patternFileName + '/' + patternFileName + '-controller'),
                                    view: {
                                        raw: viewContents,
                                        compiled: handlebars.compile(viewContents)
                                    }
                                };
                            } catch (e) {
                                console.log(util.inspect(e));
                                throw e;
                            }
                        }
                    });

                    return patterns;
                },

                // The following copy(), extend(), and getValue() functions were inspired by (meaning mostly stolen from)
                // Andrée Hanson:
                // http://andreehansson.se/

                copy: function (object) {
                    var objectCopy = {};

                    for ( var property in object ) {
                        objectCopy[property] = methods.private.getValue(object[property]);
                    }

                    return objectCopy;
                },

                extend: function (original, extension) {
                    var mergedObject = methods.public.copy(original);

                    for ( var property in extension ) {
                        mergedObject[property] = methods.private.getValue(extension[property]);
                    }

                    return mergedObject;
                },

                isNumeric: function (n) {
                  return !isNaN(parseFloat(n)) && isFinite(n);
                },

                // TODO: create an optional timer to handle emitters that haven't been called
                listener: function (functions, callback) {
                    var emitter = {},
                        output = {},
                        ready = {},
                        groupTracker = function () {
                            var allReady = true;

                            for ( var property in ready ) {
                                if ( ready[property] === false ) {
                                    allReady = false;
                                    break;
                                }
                            }

                            if ( allReady && typeof callback === 'function' ) {
                                callback(output);
                            }
                        };

                    for ( var property in functions ) {
                        ready[property] = false;
                    }

                    for ( property in functions ) {
                        emitter = new events.EventEmitter();
                        emitter.name = property;
                        emitter.on('ready', function (result) {
                            ready[this.name] = true;
                            output[this.name] = result;
                            groupTracker();
                        });
                        try {
                            functions[property](emitter);
                        } catch ( err ) {
                            throw err;
                        }

                    }
                },

                on: function (event, methods) {
                    methods.extend(events[event], methods);
                },

                renderView: function (view, format, context) {
                    var viewName = view.replace(/-/, '_'),
                        viewOutput = '';

                    switch ( format ) {
                        case 'html':
                            switch ( config.mode ) {
                                case 'production':
                                    viewOutput = app.patterns[viewName].view.compiled(context);
                                    break;
                                case 'debug':
                                case 'development':
                                    viewOutput = fs.readFileSync(config.directories.patterns + '/' + view + '/' + view + '.html', { 'encoding': 'utf8' });
                                    viewOutput = handlebars.compile(viewOutput);
                                    viewOutput = viewOutput(context);
                                    if ( context.debugOutput ) {
                                        viewOutput = viewOutput.replace('</body>', '<div id="citizen-debug"><pre>' + context.debugOutput + '</pre></div></body>');
                                    }
                                    break;
                            }
                            break;
                        case 'json':
                            viewOutput = JSON.stringify(context.content);
                            break;
                    }

                    return viewOutput;
                },

                parseCookie: function (cookie) {
                    var pairs = [],
                        pair = [],
                        cookies = {};

                    if ( cookie ) {
                        pairs = cookie.split(';');
                        for ( var i = 0; i < pairs.length; i += 1 ) {
                            pair = pairs[i].trim();
                            pair = pair.split('=');
                            cookies[pair[0]] = pair[1];
                        }
                    }

                    return cookies;
                },

                toLocalTime: function (time, timeZoneOffset) {

                }

                // <cffunction name="toLocalTime" access="public" returntype="string" output="no" hint="Converts a time value to local time based on the provided time zone offset. Assumes the provided time is UTC.">
                //     <cfargument name="time" type="date" required="true" />
                //     <cfargument name="timeZoneOffset" type="numeric" required="true" />
                //     <cfset var itemLocalTime = dateAdd("h", fix(arguments.timeZoneOffset), arguments.time)>
                //     <cfif find(".5", arguments.timeZoneOffset)>
                //         <cfif arguments.timeZoneOffset gte 0>
                //             <cfset itemLocalTime = dateAdd("n", 30, arguments.time)>
                //         <cfelse>
                //             <cfset itemLocalTime = dateAdd("n", -30, arguments.time)>
                //         </cfif>
                //     </cfif>
                //     <cfreturn itemLocalTime />
                // </cffunction>
            },

            private: {

                getValue: function (obj) {
                    var isArray,
                        isObject,
                        val,
                        i = 0,
                        l;

                    if ( typeof obj !== 'undefined' ) {
                        isArray = obj.constructor.toString().indexOf('Array') >= 0,
                        isObject = obj.constructor.toString().indexOf('Object') >= 0;
                    } else {
                        obj = 'undefined';
                    }

                    if ( isArray ) {
                        val = Array.prototype.slice.apply(obj);
                        l = val.length;

                        do {
                            val[i] = methods.private.getValue(val[i]);
                        } while (++i < l);
                    } else if ( isObject ) {
                        val = methods.public.copy(obj);
                    } else {
                        val = obj;
                    }

                    return val;
                }

            }
        };



        // handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
        //
        //     switch (operator) {
        //         case '==':
        //             return (v1 == v2) ? options.fn(this) : options.inverse(this);
        //         case '===':
        //             return (v1 === v2) ? options.fn(this) : options.inverse(this);
        //         case '!=':
        //             return (v1 != v2) ? options.fn(this) : options.inverse(this);
        //         case '!==':
        //             return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        //         case '<':
        //             return (v1 < v2) ? options.fn(this) : options.inverse(this);
        //         case '<=':
        //             return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        //         case '>':
        //             return (v1 > v2) ? options.fn(this) : options.inverse(this);
        //         case '>=':
        //             return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        //         case '&&':
        //             return (v1 && v2) ? options.fn(this) : options.inverse(this);
        //         case '||':
        //             return (v1 || v2) ? options.fn(this) : options.inverse(this);
        //         default:
        //             return options.inverse(this);
        //     }
        // });

    return methods.public;
};
