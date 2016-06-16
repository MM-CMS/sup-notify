var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_tickets(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    if(!opts.template){
        callback(new Error('--template is required'));
        return;
    }

    var context = {
        sdc: self.sdc,
        log: self.log,
        opts: opts,
        args: args,
        template_name: opts.template
    }
    self.log.trace({context: context}, 'starting');
    vasync.pipeline({arg: context, funcs: [
        function loadTemplate(context, next){
            fs.readFile('sandbox/templates/' + context.template_name + '.json', 'utf8', function(err, template){
                if(err && err.code == 'ENOENT'){
                    next(new Error(format('Template does not exist (%s)', context.template_name)));
                    return;
                } else if(err){
                    next(err);
                    return;
                }
                context.template = JSON.parse(template);
                next();
            });
        },
        function validateOptions(context, next){
            var template = context.template;
            var opts = context.opts;
            template.required_fields.map(function(field){
                if(!(field in opts)){
                    next(new Error(format("--%s is required", field)));
                    return;
                }
                if(field == 'date_start' || field == 'date_end'){
                    if(!moment.utc(opts[field], DATE_INPUT_FORMAT, true).isValid()){
                        next(new Error(format('%s is not a valid Date (for opt: %s). Input format is %s', opts[field], field, DATE_INPUT_FORMAT)));
                    } else {
                        opts[field] = moment.utc(opts[field], DATE_INPUT_FORMAT, true).format(DATE_OUTPUT_FORMAT);
                    }
                }
            });
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
        function instanceListFromArgs(context, next){

        },
        interfaces.triton.createUniqueNetworkList,
        interfaces.triton.createUniqueCustomerList,
        interfaces.triton.mergeInstancesAndNetworksIntoCustomers,
        interfaces.common.cleanupContext,
        function printCustomers(context, next) {
            var customers = context.customers;
            customers.map(function(customer){
                console.log('Customer %s has %d instances and %d networks affected',
                    customer.uuid,
                    customer.instances.length,
                    customer.networks.length
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

do_tickets.options = [
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
        names: ['server'],
        type: 'arrayOfString',
        help: 'XXX: Help.'
    }
].concat(common.getCliOutputOptions());

do_tickets.help = ([
    'Tickets.',
    '',
    'Usage:',
    '    {{name}} tickets [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_tickets.aliases = ['t'];

module.exports = do_tickets;
