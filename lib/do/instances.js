var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');

function do_instances(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    var instance_uuids = [];
    args.map(function(instance_uuid){
        if(instance_uuids.indexOf(instance_uuid) < 0){
            instance_uuids.push(instance_uuid)
        }
    });
    vasync.pipeline({arg: {wut: "something"}, funcs: [
        /*
         * Using the list of instance_uuids (args), reach out to Triton and
         * get each VM record from VMAPI.
         */
        function getInstancesFromVmUuids(ctx, next) {
            vasync.forEachParallel({
                inputs: instance_uuids,
                func: function getInstance(instance_uuid, ginext){
                    var params = {
                        state: 'running',
                        uuid: instance_uuid
                    };
                    self.sdc.vmapi.getVm(params, function(err, instance){
                        /*
                         * Explicitely handling the callback in this way because
                         * node-sdc-clients-x is overly verbose in giving all the errs
                         * that it gets from 404 in each datacenter.
                         */
                        ginext(null, instance);
                    });
                }
            }, function(err, results){
                ctx.instances = results.successes;
                next();
            });
        },
        /*
         * Using the list of instances (ctx.instances), reach out to Triton and
         * get each customer record from UFDS.
         */
        function createUniqueCustomerList(ctx, next) {
            var customer_uuids = [];
            ctx.instances.map(function(instance){
                if(customer_uuids.indexOf(instance.owner_uuid) < 0){
                    customer_uuids.push(instance.owner_uuid)
                }
            });
            vasync.forEachParallel({
                inputs: customer_uuids,
                func: function getCustomer(customer_uuid, gcnext){
                    // Not yet implemented in node-sdc-clients-x
                    // self.sdc.ufds.getUser(uuid, etc...)
                    gcnext(null, "someone");
                }
            }, function(err, results){
                ctx.customers = results.successes;
                next();
            });
        },
        function printInstances(ctx, next) {
            ctx.instances.map(function(instance){
                console.log(instance.uuid)
            })
            ctx.customers.map(function(customer){
                console.log(customer)
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
