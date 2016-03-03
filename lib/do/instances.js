var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var steps = require('../steps');

function do_instances(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }

    var context = {
        sdc: self.sdc,
        log: self.log
    }
    vasync.pipeline({arg: context, funcs: [
        function uniqueVmUuids(context, next) {
            var instance_uuids = [];
            args.map(function(instance_uuid){
                if(instance_uuids.indexOf(instance_uuid) < 0){
                    instance_uuids.push(instance_uuid)
                }
            });
            context.instance_uuids = instance_uuids;
            next();
        },
        steps.createUniqueInstanceList,
        steps.createUniqueNetworkList,
        steps.createUniqueCustomerList,
        steps.mergeInstancesAndNetworksIntoCustomers,
        function printInstances(context, next) {
            var customers = context.customers;
            customers.map(function(customer){
                console.log('Customer %s has %d instances and %d networks affected',
                    customer.uuid,
                    customer.instances.length,
                    customer.networks.length
                )
            })
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
