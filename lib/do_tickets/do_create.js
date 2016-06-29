var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_create(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    if(!opts.template){
        callback(new Error('--template is required'));
        return;
    }
    if(!opts.type){
        return callback(new Error('--type is required'));
    } else if(['vms', 'servers'].indexOf(opts.type) < 0){
        return callback(new Error('--type can either be "vms" or "servers"'));
    }

    var context = {
        sdc: self.top.sdc,
        log: self.top.log,
        opts: opts,
        args: args,
        template_name: opts.template
    }
    self.log.trace({context: context}, 'starting');
    vasync.pipeline({arg: context, funcs: [
        function loadTemplate(context, next){
            fs.readFile('etc/templates/' + context.template_name + '/initial.json', 'utf8', function(err, template){
                if(err){
                    err = (err.code == 'ENOENT') ? new Error(format('Template does not exist (%s)', context.template_name)) : err;
                    return next(err);
                }
                context.template = JSON.parse(template);
                next();
            });
        },
        function validateOptions(context, next){
            var template = context.template;
            var opts = context.opts;
            vasync.forEachParallel({
                func: function validateOption(field, next){
                    if(!(field in opts)){
                        return next(new Error(format("--%s is required", field)));
                    }
                    if(field == 'date_start' || field == 'date_end'){
                        if(!moment.utc(opts[field], DATE_INPUT_FORMAT, true).isValid()){
                            return next(new Error(format('%s is not a valid Date (for opt: %s). Input format is %s', opts[field], field, DATE_INPUT_FORMAT)));
                        } else {
                            opts[field] = moment.utc(opts[field], DATE_INPUT_FORMAT, true).format(DATE_OUTPUT_FORMAT);
                        }
                    }
                    next();
                },
                inputs: template.required_fields
            }, function(err, results){
                next(err);
            });
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
        function vmsOrServersSwitch(context, next){
            var func;
            if(opts.type == 'vms'){
                context.instance_uuids = context.args;
                func = interfaces.triton.createUniqueInstanceListFromVmUuids;
            } else if(opts.type == 'servers'){
                context.server_uuids = context.args;
                func = interfaces.triton.createUniqueInstanceListFromServerUuids;
            }
            func(context, next);
        },
        interfaces.triton.createUniqueCustomerList,
        interfaces.triton.mergeInstancesIntoCustomers,
        interfaces.common.cleanupContext,
        function printCustomers(context, next) {
            var customers = context.customers;
            customers.map(function(customer){
                console.log('Customer %s has %d instances affected',
                    customer.uuid,
                    customer.instances.length
                )
            })
            next();
        },
        function renderTemplate(context, next) {
            var template = context.template;
            var opts = context.opts;
            var output = hogan.compile(template.template).render(opts);
            console.log(output)
            next();
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
        help: 'XXX: Help.'
    }
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets.',
    '',
    'Usage:',
    '    {{name}} tickets [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_create.aliases = ['c'];

module.exports = do_create;
