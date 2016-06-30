var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');
var csv = require('csv');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_create(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        return this.do_help('help', {}, [subcmd], callback);
    }
    if(!opts.template){
        return callback(new Error('--template is required'));
    }
    if(!opts.type){
        return callback(new Error('--type is required'));
    } else if(['vms', 'servers', 'windows'].indexOf(opts.type) < 0){
        return callback(new Error('--type can either be "vms", "servers", or "windows"'));
    }

    if(opts.type === 'windows' && args[0] !== '-'){
        return callback(new Error('--type=windows must be used in conjunction with stdin'));
    }

    var context = {
        sdc: self.top.sdc,
        log: self.top.log,
        opts: opts,
        args: args,
        template_name: opts.template,
        windows: (opts.type == 'windows') ? [] : false
    }
    self.log.trace({context: context}, 'starting');
    vasync.pipeline({arg: context, funcs: [
        interfaces.common.loadTemplate,
        function validateTypeAndTemplate(context, next){
            if(context.template.types.indexOf(opts.type) < 0){
                return next(new Error(format(
                    'Template "%s" cannot be used with notification type "%s"',
                    context.template_name,
                    opts.type
                )));
            }
            next();
        },
        function uniqueArgs(context, next) {
            var args = [];
            context.args.map(function(arg){
                if(args.indexOf(arg) < 0){
                    args.push(arg);
                }
            });
            context.args = args;
            next();
        },
        function readIfStdin(context, next){
            if(args[0] !== '-'){
                context.stdin = false;
                return next();
            }
            var stdin = '';
            process.stdin.resume();
            process.stdin.on('data', function (chunk) {
                stdin += chunk;
            });

            process.stdin.on('end', function () {
                context.stdin = stdin;
                next();
            });
        },
        function serializeInputData(context, next){
            if(!context.stdin){
                context.ids = context.args;
                return next();
            }

            if(!context.windows){
                context.ids = context.stdin.replace(/\s+/g, ' ').split(' ').filter(function(i){
                    return i.length;
                });
                return next();
            }
            csv.parse(context.stdin, {
                columns: context.template.required_fields
            }, function(err, windows){
                if(err){
                    return next(err);
                }
                context.windows = windows;
                next();
            });
        },
        function validateOptionsIfWindows(context, next){
            if(!context.windows){
                return next();
            }
            var template = context.template;
            vasync.forEachParallel({
                inputs: context.windows,
                func: function validateWindow(window, next){
                    template.required_fields.forEach(function(field){
                        if((field == 'date_start' || field == 'date_end') && (window[field] !== 'TBD')){
                            if(!moment.utc(window[field], DATE_INPUT_FORMAT, true).isValid()){
                                return next(new Error(format(
                                    '"%s" is not a valid %s (for instance: %s). Input format is %s',
                                    window[field],
                                    field,
                                    window.instance_uuid,
                                    DATE_INPUT_FORMAT
                                )));
                            } else {
                                window[field] = moment.utc(window[field], DATE_INPUT_FORMAT, true);
                            }
                        }
                    });
                    next();
                }
            }, function(err, results){
                next(err);
            });
        },
        function validateOptionsIfOther(context, next){
            if(context.windows){
                return next();
            }
            var template = context.template;
            var opts = context.opts;
            vasync.forEachParallel({
                inputs: template.required_fields,
                func: function validateOption(field, next){
                    if(!(field in opts)){
                        return next(new Error(format("--%s is required", field)));
                    }
                    if(field == 'date_start' || field == 'date_end'){
                        if(!moment.utc(opts[field], DATE_INPUT_FORMAT, true).isValid()){
                            return next(new Error(format('%s is not a valid %s. Input format is %s', opts[field], field, DATE_INPUT_FORMAT)));
                        } else {
                            opts[field] = moment.utc(opts[field], DATE_INPUT_FORMAT, true).format(DATE_OUTPUT_FORMAT);
                        }
                    }
                    next();
                }
            }, function(err, results){
                next(err);
            });
        },
        function typeSwitch(context, next){
            var func;
            if(opts.type == 'vms'){
                func = interfaces.triton.createUniqueInstanceListFromVmUuids;
            } else if(opts.type == 'servers'){
                func = interfaces.triton.createUniqueInstanceListFromServerUuids;
            } else if(opts.type == 'windows'){
                func = interfaces.triton.createUniqueWindowListFromVmUuids;
            }
            func(context, next);
        },
        interfaces.triton.createUniqueCustomerList,
        interfaces.triton.mergeInstancesIntoCustomers,
        interfaces.common.cleanupContext,
        function printSummary(context, next) {
            var customers = context.customers;
            if(context.windows){
                customers.map(function(customer){
                    var days = [];
                    customer.instances.map(function(instance){
                        instance.tbd = (instance.window.start == 'TBD') ? true : false;
                        var window_start_day = (instance.tbd) ? 'TBD' : instance.window.start.format('YYYY-MM-DD');
                        if(Object.keys(days).indexOf(window_start_day) < 0){
                            days[window_start_day] = [];
                        }
                        days[window_start_day].push(instance);
                    })
                    console.log('Customer %s has %d days of maintenance',
                        customer.uuid,
                        Object.keys(days).length
                    );
                    Object.keys(days).sort().map(function(day){
                        console.log('    %s', day);
                        days[day].sort(function(a, b){
                            return a.window.start - b.window.start;
                        }).map(function(instance){
                            console.log('        Instance %s\'s window is from %s to %s',
                                instance.uuid,
                                (instance.tbd) ? 'TBD' : instance.window.start.format('HH:mm:ss'),
                                (instance.tbd) ? 'TBD' : instance.window.end.format('HH:mm:ss')
                            );
                        })
                    });
                })
            } else {
                customers.map(function(customer){
                    console.log('Customer %s has %d instances affected',
                        customer.uuid,
                        customer.instances.length
                    )
                })
            }
            console.log(hogan.compile(context.template.message).render(context.opts));
            next();
        },
        function sendTicketsIfRequired(context, next){
            if(!opts.send){
                return next();
            }
            interfaces.zendesk.sendTickets(context, next);
        }
    ]}, callback);
};

do_create.options = [
    {
        names: ['template', 't'],
        type: 'string',
        help: 'Name of template'
    },
    {
        names: ['jira'],
        type: 'string',
        help: 'JIRA ticket number associated with this notification.'
    },
    {
        names: ['date_start'],
        type: 'string',
        help: 'XXX: Format help.'
    },
    {
        names: ['date_end'],
        type: 'string',
        help: 'XXX: More help.'
    },
    {
        names: ['type'],
        type: 'string',
        help: '"vms", "servers", or "windows". Used to tell the tool whether ' +
            'the ARGS are instance or server UUIDs, or if the "windows" ' +
            'feature is to be used.'
    },
    {
        names: ['send'],
        type: 'bool',
        default: false
    }
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets.',
    '',
    'Usage:',
    '    {{name}} create UUID1 [UUID2...] [OPTIONS]',
    '',
    '{{options}}',
    'Windows:',
    '',
    'This feature is used to notify users of upcoming maintenance, where ',
    'the notification will contain a consolidated list of windows ',
    'that will affect their instance over a longer time period. This ',
    'is different to other notifications, where each notification will ',
    'contain instances affected by a single incident/maintenance.'
].join('\n'));

do_create.aliases = ['c'];

module.exports = do_create;