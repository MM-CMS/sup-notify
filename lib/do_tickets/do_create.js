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
var EMAIL_REGEX = /\S+@\S+/;

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

    if(opts.template === 'custom' && (!opts.message || !opts.level || !opts.subject)){
        return callback(new Error('If using --template=custom, --message, --subject and --level must also be passed.'))
    }

    if(opts.level && (Object.keys(self.top.config.notification_levels).indexOf(opts.level) < 0)){
        return callback(new Error('Incorrect --level selected. See --help.'));
    }

    if(!self.top.config.datacenters) {
       return callback(new Error('No datacenter provided, --datacenter or DC env var is required.'));
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
        instances: [],
        customers: [],
        input: {}
    }
    self.log.trace({context: context}, 'starting');
    // Want a better way to determine logfile location
    self.log.info('logfile: %s', self.log.streams[0].path);
    vasync.pipeline({arg: context, funcs: [
        interfaces.common.loadTemplate,
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
                context.input.from = 'args';
                context.log.debug('stdin: false');
                return next();
            }
            var stdin = '';
            process.stdin.resume();
            process.stdin.on('data', function (chunk) {
                stdin += chunk;
            });

            process.stdin.on('end', function () {
                context.input.from = 'stdin';
                context.input.data = stdin;
                context.log.debug('stdin: true');
                context.log.trace({stdin: stdin}, 'stdin loaded');
                next();
            });
        },
        function serializeInputData(context, next){
            if(context.input.from == 'args'){
                context.input.data = context.args;
                return next();
            }

            context.input.data = context.input.data.replace(/\s+/g, ' ').split(' ').filter(function(i){
                return i.length;
            });
            next();

        },
        function determineDataIds(context, next){
            var input = context.input;
            if(!input.data.length){
                return next(new Error('No input data supplied.'));
            }
            var first_id = input.data[0].split(',')[0];
            if(first_id.match(UUID_REGEX)){
                input.values = 'uuids';
                input.resource = 'unknown';
            } else if(first_id.match(EMAIL_REGEX)){
                input.values = 'emails';
                input.resource = 'users';
            } else {
                input.values = 'hostnames';
                input.resource = 'servers';
            }
            next();
        },
        function determineIfServersOrInstances(context, next){
            if(context.input.values != 'uuids'){
                return next();
            }
            interfaces.triton.determineIfServersOrInstances(context, next);
        },
        function determineIfCsv(context, next){
            var input = context.input;
            /*
             * Very basic checking around what kind of data we're working with.
             * If the first line of data has a comma, we assume every line
             * of subsequent data is part of the same CSV file.
             */
            input.format = (input.data[0].indexOf(',') >=0) ? 'csv' : 'ids';
            next();
        },
        function parseCsv(context, next){
            if(context.input.format != 'csv'){
                return next();
            }
            csv.parse(context.input.data.join('\n'), {
                columns: context.template.required_fields,
                relax_column_count: true
            }, function(err, windows){
                if(err){
                    return next(err);
                }
                context.windows = windows;
                next();
            });
        },
        function validateTemplateAgainstInput(context, next){
            if(opts.template === 'custom'){
                return next();
            }
            /*
             * Check for wrong resource usage.
             * e.g. emails used in CSV
             */
            if(context.template.resources.indexOf(context.input.resource) < 0){
                return next(new Error(format(
                    'Template "%s" cannot be used with resource "%s"',
                    context.template_name,
                    context.input.resource
                )));
            }
            /*
             * Check for CSV input against a template that doesn't expect it.
             */
            if(context.input.format == 'csv' && !context.template.csv){
                return next(new Error(format(
                    'Template "%s" cannot be used with CSV data',
                    context.template_name
                )));
            }
            /*
             * Check for ID inputs against a template that expects CSV.
             */
            if(context.input.format == 'ids' && context.template.csv){
                return next(new Error(format(
                    'Template "%s" expects CSV data, but none supplied',
                    context.template_name
                )));
            }
            context.log.debug('template validated against input');
            next();
        },
        function validateOptionsIfWindows(context, next){
            if(context.input.format != 'csv' || opts.template === 'custom'){
                return next();
            }
            var template = context.template;
            vasync.forEachParallel({
                inputs: context.windows,
                func: function validateWindow(window, next){
                    template.required_fields.forEach(function(field){
                        if((field == 'start' || field == 'end') && (window[field] !== 'TBD')){
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
                    if(field == 'start' || field == 'end'){
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
            var input = context.input;
            if(input.format == 'ids'){
                if(input.resource == 'instances'){
                    func = interfaces.triton.createUniqueInstanceListFromVmUuids;
                } else if(input.resource == 'servers'){
                    if(input.values == 'uuids'){
                        func = interfaces.triton.createUniqueInstanceListFromServerUuids;
                    } else if(input.values == 'hostnames'){
                        func = interfaces.triton.createUniqueInstanceListFromServerHostnames;
                    }
                } else if(input.resource == 'users'){
                    func = interfaces.triton.createUniqueCustomerListFromEmailAddresses;
                }
            } else if(input.format == 'csv'){
                if(input.resource == 'instances'){
                    func = interfaces.triton.createUniqueWindowListFromVmUuids;
                } else if(input.resource == 'servers'){
                    if(input.values == 'uuids'){
                        func = interfaces.triton.createUniqueWindowListFromServerUuids;
                    } else if(input.values == 'hostnames'){
                        return next(new Error('Server hostnames not yet supported in CSV'))
                    }

                }
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
            next();
        },
        function renderTicketSampleIfRequired(context, next){
            var log = context.log;
            if(!opts.sample){
                return next();
            }
            var customers = context.customers;
            log.info('sample rendered template');
            console.log(format('Subject: %s', context.template.subject));
            console.log(interfaces.zendesk.buildTicketBody(customers[0], context.template));
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
        help: 'Name of the template, as seen via `... templates list`. If no ' +
            'pre-written template is appropriate, "custom" is also a valid option ' +
            'in conjunction with --message and --type'
    },
    {
        names: ['jira'],
        type: 'string',
        help: 'JIRA ticket number associated with this notification.'
    },
    {
        names: ['start'],
        type: 'string',
        help: 'If the template requires it, this option should contain the ' +
            'start UTC datetime of the incident/maintenance in basic ISO 8601 format ' +
            '(YYYYMMDDTHHmmssZ). ' +
            'For example: 20160905T100000Z'
    },
    {
        names: ['end'],
        type: 'string',
        help: 'See "start".'
    },
    {
        names: ['send'],
        type: 'bool',
        default: false,
        help: 'Instruct the tool to create tickets for customers through ZenDesk. ' +
            'If ENV isn\'t configured, the tool will still gather the data but ' +
            'fail to create tickets.'
    },
    {
        names: ['no_org'],
        type: 'bool',
        default: false,
        help: 'By default, the tool will CC every user in the instance/customer\'s ' +
            'organisation, as configured in ZenDesk. Pass this flag to disable, and ' +
            'only CC users configered as sub users in UFDS.'
    },
    {
        names: ['message'],
        type: 'string',
        help: 'If using a custom template (see --template), this option ' +
            'signifies the Markdown file on the local filesystem that will ' +
            'make up the ticket\'s comment body.'
    },
    {
        names: ['level'],
        type: 'string',
        help: '"incident", "maintenance", "emergency", or "general". ' +
            'When not using a pre-existing template, this is required in order to ' +
            'set the ticket\'s category/group/etc in ZenDesk correctly.'
    },
    {
        names: ['subject'],
        type: 'string',
        help: 'When not using a pre-existing template, this is required in order to ' +
            'set the subject of the ZenDesk ticket.'
    },
    {
        names: ['sample'],
        type: 'bool',
        help: 'Picks a customer from the available data and renders a sample ' +
            'notification'
    }
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets based on Triton resources.',
    '',
    'Gathers data from Triton based on ARGS and consolidates into ticket ',
    'information to be passed to ZenDesk. By default no tickets are created, ',
    'but the --send OPTION will create real tickets when ready.',
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
