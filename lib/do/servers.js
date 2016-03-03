var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var steps = require('../steps');

function do_servers(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }

    var context = {
        sdc: self.sdc,
        log: self.log,
        server_uuids: args
    }
    vasync.pipeline({arg: context, funcs: [
        function uniqueServerUuids(context, next) {
            var server_uuids = [];
            context.server_uuids.map(function(server_uuid){
                if(server_uuids.indexOf(server_uuid) < 0){
                    server_uuids.push(server_uuid);
                }
            });
            context.server_uuids = server_uuids;
            next();
        },
        steps.createUniqueInstanceListFromServerUuids,
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

do_servers.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    }
].concat(common.getCliOutputOptions());

do_servers.help = ([
    'Servers.',
    '',
    'Usage:',
    '    {{name}} servers [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_servers.aliases = ['s'];

module.exports = do_servers;
