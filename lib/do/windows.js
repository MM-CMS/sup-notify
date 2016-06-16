var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var steps = require('../steps');

function do_windows(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }

    var context = {
        sdc: self.sdc,
        log: self.log,
        servers: args,
        hostnames: opts.hostnames
    }
    vasync.pipeline({arg: context, funcs: [
        function uniqueServerUuids(context, next) {
            var server_uuids = [];
            context.servers.map(function(server_uuid){
                if(server_uuids.indexOf(server_uuid) < 0){
                    server_uuids.push(server_uuid);
                }
            });
            context.servers = server_uuids;
            next();
        },
        function getServerUuidsIfHostnames(context, next) {
            if(context.hostnames) {
                steps.createUniqueServerListFromHostnames(context, next);
            }
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

do_windows.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    },
    {
        names: ['hostnames'],
        type: 'bool',
        help: 'If supplied inputs are hostnames.',
        default: false
    }
].concat(common.getCliOutputOptions());

do_windows.help = ([
    'Windows.',
    '',
    'Usage:',
    '    {{name}} servers [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_servers.aliases = ['s'];

module.exports = do_servers;
