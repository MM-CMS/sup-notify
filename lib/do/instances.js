var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var steps = require('../steps');
var hogan = require('hogan.js');
var moment = require('moment');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_instances(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }

    var context = {
        sdc: self.sdc,
        log: self.log,
        instance_uuids: args,
        opts: self.input
    }
    vasync.pipeline({arg: context, funcs: [
        function uniqueVmUuids(context, next) {
            var instance_uuids = [];
            context.instance_uuids.map(function(instance_uuid){
                if(instance_uuids.indexOf(instance_uuid) < 0){
                    instance_uuids.push(instance_uuid);
                }
            });
            context.instance_uuids = instance_uuids;
            next();
        },
        steps.createUniqueInstanceListFromVmUuids,
        steps.createUniqueNetworkList,
        steps.createUniqueCustomerList,
        steps.mergeInstancesAndNetworksIntoCustomers,
        steps.cleanupContext,
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
            console.log(context)
            var template_file = context.opts.template;
            var fields = context.opts.fields;
            if(fs.readdirSync('sandbox/templates').indexOf(template_file + '.json') < 0){
                callback(new Error("Template doesn't exist"));
                return;
            }
            var template = JSON.parse(fs.readFileSync('sandbox/templates/' + template_file + '.json', 'utf8'));
            template.required_fields.map(function(field){
              if(!(field in fields)){
                callback(new Error(format("%s is required", field)));
                return;
              }
              if(moment.utc(fields[field], DATE_INPUT_FORMAT, true).isValid()){
                fields[field] = moment.utc(fields[field], DATE_INPUT_FORMAT, true).format(DATE_OUTPUT_FORMAT);
              } else {
                callback(new Error(format('%s is not a valid Date (for opt: %s). Input format is %s', fields[field], field, DATE_INPUT_FORMAT)));
              }
            });
            var output = hogan.compile(template.template).render(fields);
            console.log(output)
            next();
        }
    ]}, callback);
};

do_instances.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    }
].concat(common.getCliOutputOptions());

do_instances.help = ([
    'Instances.',
    '',
    'Usage:',
    '    {{name}} instances [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_instances.aliases = ['insts'];

module.exports = do_instances;
