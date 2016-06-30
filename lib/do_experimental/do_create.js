var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');
var csv = require('csv');
var restify = require('restify');
var read = require('read');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_create(subcmd, opts, args, callback){
    var self = this;
    if(!args.length){
        return callback(new Error('JIRA_ID is required.'));
    }

    var context = {
        sdc: self.top.sdc,
        log: self.top.log,
        opts: opts,
        args: args,
        jira_username: "richard.bradley",
        jira_id: args[0]
    }
    vasync.pipeline({arg: context, funcs:[
        function createJIRAClient(context, next){
            var client = restify.createJsonClient({
                url: "https://devhub.joyent.com/jira",
                version: '*',
                headers: {
                    "Connection": "close",
                }
            });
            context.client = client;
            next();
        },
        function authJIRA(context, next){
            read({prompt: "JIRA password: ", silent: true}, function(err, pass){
                if(err){
                    return callback(err);
                }
                context.client.basicAuth(context.jira_username, pass);
                next();
            });
        },
        function getJIRATicket(context, next){
            context.client.get("/jira/rest/api/2/issue/" + context.jira_id, function(err, req, res, obj){
                if(err && res.statusCode == 401){
                    return callback(new Error("Unauthorized"));
                } else if (err && res.statusCode == 403){
                    return callback(new Error("Forbidden"));
                } else if (err) {
                    return callback(err);
                }
                var jira = obj;
                var ticket_opts = {
                    server_hostname: jira.fields.customfield_10234,
                    date_start: moment.utc(jira.fields.customfield_10218).format('YYYYMMDD[T]HHmmss[Z]'),
                    date_end: moment.utc(jira.fields.customfield_10219).format('YYYYMMDD[T]HHmmss[Z]'),
                    template: 'incident/cn_reboot',
                    jira: jira.key
                };

                context.opts = {
                    jira: ticket_opts.jira,
                    type: 'servers',
                    date_start: ticket_opts.date_start,
                    date_end: ticket_opts.date_end
                }
                context.template_name = ticket_opts.template;
                context.ids = [ticket_opts.server_hostname]
                next();
            });
        },
        interfaces.common.loadTemplate,
        function validateTypeAndTemplate(context, next){
            if(context.template.types.indexOf(context.opts.type) < 0){
                return next(new Error(format(
                    'Template "%s" cannot be used with notification type "%s"',
                    context.template_name,
                    context.opts.type
                )));
            }
            next();
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
        interfaces.triton.createUniqueInstanceListFromServerHostnames,
        interfaces.triton.createUniqueCustomerList,
        interfaces.triton.mergeInstancesIntoCustomers,
        interfaces.common.cleanupContext,
        function printSummary(context, next) {
            var customers = context.customers;
            customers.map(function(customer){
                console.log('Customer %s has %d instances affected',
                    customer.uuid,
                    customer.instances.length
                )
            })
            console.log(hogan.compile(context.template.message).render(context.opts));
            next();
        },
        function end(context, next){
            console.log("done.");
            next();
        }

    ]}, callback)
};

do_create.options = [
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets.',
    '',
    'Usage:',
    '    {{name}} create JIRA_ID',
    '',
    '{{options}}'
].join('\n'));

do_create.aliases = ['c'];

module.exports = do_create;
