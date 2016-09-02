var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');
var csv = require('csv');

var DATE_OUTPUT_FORMAT = 'HH:mm, DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';
var UUID_REGEX = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/
var ACCEPTED_NOTIFICATION_TYPES = [
    'vms',
    'servers',
    'windows_vms',
    'windows_servers',
    'emails'
];

function do_create(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        return this.do_help('help', {}, [subcmd], callback);
    }
    if(!opts.template){
        return callback(new Error('--template is required'));
    }
    if(!opts.jira){
        return callback(new Error('--jira is required'));
    }
    if(!opts.type){
        return callback(new Error('--type is required'));
    } else if(ACCEPTED_NOTIFICATION_TYPES.indexOf(opts.type) < 0){
        return callback(new Error('--type can either be "vms", "servers", "windows_vms", or "windows_servers"'));
    }

    if((opts.type === 'windows_vms' || opts.type === 'windows_servers') && args[0] !== '-'){
        return callback(new Error('--type=windows* must be used in conjunction with stdin'));
    }

    if(opts.template === 'custom' && (!opts.message || !opts.level)){
        return callback(new Error('If using --template=custom, --message and --level must also be passed.'))
    }

    var context = {
        top: self.top,
        cmd: this.name + ' ' + subcmd,
        sdc: self.top.sdc,
        log: self.log,
        opts: opts,
        args: args,
        config: self.top.config,
        template_name: opts.template,
        jira: opts.jira,
        windows: (opts.type == 'windows_vms' || opts.type == 'windows_servers') ? [] : false,
        instances: [],
        customers: []
    }
    self.log.trace({context: context}, 'starting');
    // Want a better way to determine logfile location
    self.log.info('logfile: %s', self.log.streams[0].path);
    vasync.pipeline({arg: context, funcs: [
        interfaces.common.loadTemplate,
        function validateTypeAndTemplateIfRequired(context, next){
            if(opts.template === 'custom'){
                return next();
            }
            if(context.template.types.indexOf(opts.type) < 0){
                return next(new Error(format(
                    'Template "%s" cannot be used with notification type "%s"',
                    context.template_name,
                    opts.type
                )));
            }
            context.log.debug('template loaded');
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
                context.log.debug('stdin: false');
                return next();
            }
            var stdin = '';
            process.stdin.resume();
            process.stdin.on('data', function (chunk) {
                stdin += chunk;
            });

            process.stdin.on('end', function () {
                context.stdin = stdin;
                context.log.debug('stdin: true');
                context.log.trace({stdin: stdin}, 'stdin loaded');
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
            if(!context.windows || opts.template === 'custom'){
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
            if(context.windows || context.opts.template === 'custom'){
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
                if(context.ids[0].match(UUID_REGEX)){
                    func = interfaces.triton.createUniqueInstanceListFromServerUuids;
                } else {
                    func = interfaces.triton.createUniqueInstanceListFromServerHostnames;
                }
            } else if(opts.type == 'windows_vms'){
                func = interfaces.triton.createUniqueWindowListFromVmUuids;
            } else if(opts.type == 'windows_servers'){
                func = interfaces.triton.createUniqueWindowListFromServerUuids;
            } else if(opts.type == 'emails'){
                func = interfaces.triton.createUniqueCustomerListFromEmailAddresses;
            }
            func(context, next);
        },
        interfaces.triton.createUniqueCustomerListFromInstanceUUIDs,
        interfaces.triton.getCCListFromCustomerRoles,
        interfaces.triton.mergeInstancesIntoCustomers,
        interfaces.common.cleanupContext,
        function printSummary(context, next) {
            var customers = context.customers;
            var log = context.log;
            var summary_log = function(line){
                console.log(format('  %s', line));
            }
            log.info('summary of information');
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
                    summary_log(format('Customer %s has %d days of maintenance',
                        customer.login,
                        Object.keys(days).length
                    ));
                    Object.keys(days).sort().map(function(day){
                        summary_log(format('  %s', day));
                        days[day].sort(function(a, b){
                            return a.window.start - b.window.start;
                        }).map(function(instance){
                            summary_log(format('    %s\'s window is from %s to %s',
                                instance.uuid,
                                (instance.tbd) ? 'TBD' : instance.window.start.format('HH:mm:ss'),
                                (instance.tbd) ? 'TBD' : instance.window.end.format('HH:mm:ss')
                            ));
                        })
                    });
                })
            } else if(context.opts.type === 'emails') {
                customers.map(function(customer){
                    console.log('Customer %s', customer.login);
                });
            } else {
                customers.map(function(customer){
                    console.log('Customer %s has %d instances affected',
                        customer.login,
                        customer.instances.length
                    )
                })
            }
            log.info('sample rendered template');
            console.log(hogan.compile(context.template.message).render(context.opts));
            next();
        },
        function sendTicketsIfRequired(context, next){
            var log = context.log;
            if(!opts.send){
                log.info('--send not passed; not proceeding to ZenDesk');
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
    },
    {
        names: ['no_org'],
        type: 'bool',
        default: false
    },
    {
        names: ['message'],
        type: 'string'
    },
    {
        names: ['level'],
        type: 'string'
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
