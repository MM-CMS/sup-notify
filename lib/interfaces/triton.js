var vasync = require('vasync');

/*
 * Using the list of instance_uuids (args), reach out to Triton and
 * get each VM record from VMAPI.
 */
function createUniqueInstanceListFromVmUuids(context, next) {
    var log = context.log;
    var instance_uuids = context.ids;
    vasync.forEachParallel({
        inputs: instance_uuids,
        func: function getInstance(instance_uuid, ginext){
            var params = {
                state: 'running',
                uuid: instance_uuid
            };
            context.sdc.vmapi.getVm(params, ginext);
        }
    }, function(err, results){
        context.instances = results.successes;
        next();
    });
}
function createUniqueInstanceListFromServerUuids(context, next) {
    var server_uuids = context.ids;
    var instances = [];
    vasync.forEachParallel({
        inputs: server_uuids,
        func: function listInstances(server_uuid, linext){
            var params = {
                state: 'running',
                server_uuid: server_uuid
            };
            context.sdc.vmapi.listVms(params, linext);
        }
    }, function(err, results){
        /*
         * We get multiple arrays here in results.successes because of the
         * multiple calls to listVms. Merge them down into one here
         */
        context.instances = [].concat.apply([], results.successes);
        next();
    })
}
function createUniqueInstanceListFromServerHostnames(context, next){
    var server_hostnames = context.ids;
    var server_uuids = [];
    vasync.forEachParallel({
        inputs: server_hostnames,
        func: function getServerByHostname(server_hostname, sbhnext){
            var params = {
                hostname: server_hostname
            };
            context.sdc.cnapi.listServers(params, sbhnext);
        }
    }, function(err, results){
        context.ids = [].concat.apply([], results.successes).map(function(s){
            return s.uuid;
        });
        createUniqueInstanceListFromServerUuids(context, next);
    });
}
function createUniqueWindowListFromVmUuids(context, next){
    var windows = context.windows;
    var instances = [];
    vasync.forEachParallel({
        inputs: windows,
        func: function getInstance(window, ginext){
            var params = {
                state: 'running',
                uuid: window.instance_uuid
            };

            context.sdc.vmapi.getVm(params, function(err, instance){
                if(err){
                    return next(err);
                }

                if(!('window' in instance)){
                    instance.window = {
                        start: window.date_start,
                        end: window.date_end
                    }
                }
                ginext(null, instance);
            });
        }
    }, function(err, results){
        context.instances = results.successes;
        next();
    });
}
function createUniqueServerListFromHostnames(context, next) {
    var server_hostnames = context.servers;
    vasync.forEachParallel({
        inputs: server_hostnames,
        func: function listServers(server_hostname, lsnext) {
            // Not yet implemented
            // context.sdc.cnapi.listServers(hostname...)
            lsnext();
        }
    }, function(err, results){
        next();
    });
}
function createUniqueServerList(context, next){
    var server_uuids = context.servers;
    vasync.forEachParallel({
        inputs: server_uuids,
        func: function getServer(server_uuid, ginext){
            context.sdc.cnapi.getServer(server_uuid, function(err, server){
                /*
                 * Explicitely handling the callback in this way because
                 * node-sdc-clients-x is overly verbose in giving all the errs
                 * that it gets from 404 in each datacenter.
                 */
                ginext(null, server);
            });
        }
    }, function(err, results){
        context.servers = results.successes;
        next();
    });
}
/*
 * Using the list of instances, reach out to Triton and determine if
 * a NAT zone is to be taken into consideration. This is because NAT
 * zones are owned by `admin`, but will still affect the end user.
 */

function createUniqueNetworkList(context, next){
    var instances = context.instances;
    var nat_instances = [];
    instances = instances.filter(function(instance){
        if(!('com.joyent:ipnat_owner' in instance.internal_metadata)){
            return true;
        } else {
            nat_instances.push(instance)
        }
    });
    vasync.forEachParallel({
        inputs: nat_instances,
        func: function getNetwork(nat_instance, gninnext){
            // Not yet implemented in node-sdc-clients-x
            // self.sdc.napi.getNetwork(uuid, etc...)
            gninnext(null, {
                uuid: 'something',
                owner_uuid: nat_instance.internal_metadata['com.joyent:ipnat_owner'],
            });
        }
    }, function(err, results){
        context.instances = instances;
        context.networks = results.successes;
        next();
    })
}
/*
 * Using the list of instances (ctx.instances), reach out to Triton and
 * get each customer record from UFDS.
 */
function createUniqueCustomerList(context, next) {
    var instances = context.instances;
    var customer_uuids = [];
    instances.map(function(instance){
        if(customer_uuids.indexOf(instance.owner_uuid) < 0){
            customer_uuids.push(instance.owner_uuid)
        }
    });
    vasync.forEachParallel({
        inputs: customer_uuids,
        func: function getCustomer(customer_uuid, gcnext){
            // Not yet implemented in node-sdc-clients-x
            // self.sdc.ufds.getUser(uuid, etc...)
            gcnext(null, {uuid: customer_uuid});
        }
    }, function(err, results){
        context.customers = results.successes;
        next();
    });
}
function mergeInstancesAndNetworksIntoCustomers(context, next) {
    var customers = context.customers;
    var instances = context.instances;
    var networks = context.networks;
    customers.map(function(customer){
        customer.instances = instances.filter(function(instance){
            return instance.owner_uuid == customer.uuid;
        });
        customer.networks = networks.filter(function(network){
            return network.owner_uuid == customer.uuid;
        })
    });
    next();
}
function mergeInstancesIntoCustomers(context, next) {
    var customers = context.customers;
    var instances = context.instances;
    customers.map(function(customer){
        customer.instances = instances.filter(function(instance){
            return instance.owner_uuid == customer.uuid;
        });
    });
    next();
}
module.exports = {
    createUniqueInstanceListFromVmUuids: createUniqueInstanceListFromVmUuids,
    createUniqueServerList: createUniqueServerList,
    createUniqueInstanceListFromServerUuids: createUniqueInstanceListFromServerUuids,
    createUniqueInstanceListFromServerHostnames: createUniqueInstanceListFromServerHostnames,
    createUniqueWindowListFromVmUuids: createUniqueWindowListFromVmUuids,
    createUniqueServerListFromHostnames: createUniqueServerListFromHostnames,
    createUniqueNetworkList: createUniqueNetworkList,
    createUniqueCustomerList: createUniqueCustomerList,
    mergeInstancesAndNetworksIntoCustomers: mergeInstancesAndNetworksIntoCustomers,
    mergeInstancesIntoCustomers: mergeInstancesIntoCustomers
}
