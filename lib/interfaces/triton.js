var vasync = require('vasync');
var common = require('../common');

/*
 * Using the list of instance_uuids (args), reach out to Triton and
 * get each VM record from VMAPI.
 */
function createUniqueInstanceListFromVmUuids(context, next) {
    var log = context.log;
    var instance_uuids = context.ids;
    log.info('getting instance details from UUIDs');
    vasync.forEachParallel({
        inputs: instance_uuids,
        func: function getInstance(instance_uuid, ginext){
            var params = {
                state: 'active',
                uuid: instance_uuid
            };
            context.sdc.vmapi.getVm(params, ginext);
        }
    }, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        context.instances = results.successes;
        log.info('got %d instances', context.instances.length);
        next();
    });
}
function createUniqueInstanceListFromServerUuids(context, next) {
    var log = context.log;
    var server_uuids = context.ids;
    var instances = [];
    log.info('getting server details from UUIDs');
    vasync.forEachParallel({
        inputs: server_uuids,
        func: function listInstances(server_uuid, linext){
            var params = {
                state: 'active',
                server_uuid: server_uuid
            };
            context.sdc.vmapi.listVms(params, linext);
        }
    }, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        /*
         * We get multiple arrays here in results.successes because of the
         * multiple calls to listVms. Merge them down into one here
         */
        context.instances = [].concat.apply([], results.successes);
        log.info('got %d instances', context.instances.length);
        next();
    })
}
function createUniqueInstanceListFromServerHostnames(context, next){
    var log = context.log;
    var server_hostnames = context.ids;
    var server_uuids = [];
    log.info('getting instance details from hostnames');
    vasync.forEachParallel({
        inputs: server_hostnames,
        func: function getServerByHostname(server_hostname, sbhnext){
            var params = {
                hostname: server_hostname
            };
            context.sdc.cnapi.listServers(params, sbhnext);
        }
    }, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        context.ids = [].concat.apply([], results.successes).map(function(s){
            return s.uuid;
        });
        log.info('got %d servers', context.ids.length);
        createUniqueInstanceListFromServerUuids(context, next);
    });
}
function createUniqueWindowListFromVmUuids(context, next){
    var log = context.log;
    var windows = context.windows;
    var instances = [];
    log.info('getting instance details from UUIDs (with window details)');
    vasync.forEachParallel({
        inputs: windows,
        func: function getInstance(window, ginext){
            var params = {
                state: 'active',
                uuid: window.instance_uuid
            };

            context.sdc.vmapi.getVm(params, function(err, instance){
                if(err){
                    return ginext(err);
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
        if(err){
            return next(err);
        }
        context.instances = results.successes;
        log.info('got %d instances', context.instances.length);
        next();
    });
}
/*
 * Using the list of instances (ctx.instances), reach out to Triton and
 * get each customer record from UFDS.
 */
function createUniqueCustomerList(context, next) {
    var log = context.log;
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
            log.info({customer_uuid: customer_uuid}, 'getting customer');
            var options = {
                searchType: 'uuid',
                value: customer_uuid
            }
            context.sdc.ufds.getUserEx(options, gcnext);
        }
    }, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        context.customers = results.successes;
        log.info('got %d customers', context.customers.length);
        next();
    });
}
function getCCListFromCustomerRoles(context, next){
    var log = context.log;
    var customers = context.customers;
    var notification_level = context.config.notification_levels[context.template.ticket_type];
    var filter = "(|(name=JPC-Notifications-All)(name=" + notification_level.jpc_name + "))";
    log.info('ufds search filter: %s', filter);

    vasync.pipeline({arg: context, funcs: [
        function listRoles(context, next){
            vasync.forEachParallel({
                inputs: customers,
                func: function listRoles(customer, lrnext){
                    log.info('getting sub-user dn\'s for customer %s', customer.login);
                    var members = [];
                    context.sdc.ufds.listRoles(customer.uuid, filter, function(err, roles){
                        if(err){
                            return lrnext(err);
                        }
                        roles.map(common.translateRole).map(function(r){
                            members = members.concat(r.members);
                        });
                        customer.members = members;
                        log.info('got %d sub-users for customer %s', customer.members.length, customer.login);
                        lrnext();
                    });
                }
            }, next);
        },
        function getRoles(context, next){
            vasync.forEachParallel({
                inputs: customers,
                func: function getRoles(customer, grnext){
                    customer.cc = [];
                    vasync.forEachParallel({
                        inputs: customer.members,
                        func: function getMember(member, gmnext){
                            log.info('getting member from role list for customer %s', customer.login);
                            context.sdc.ufds.search(member, {}, function(err, user){
                                if(err){
                                    return gmnext(err);
                                }
                                customer.cc = customer.cc.concat(user);
                                gmnext();
                            });
                        }
                    }, grnext);
                }
            }, next);
        }
    ]}, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        next();
    });
};
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

function createUniqueWindowListFromServerHostnames(context, next){
    next(new Error("not yet implemented"));
}

function createUniqueWindowListFromServerUuids(context, next){
    var log = context.log;
    var windows = context.windows;
    var instances = [];
    log.info('getting instances details from server hostnames (with window details)');
    vasync.forEachParallel({
        inputs: windows,
        func: function getInstances(window, ginext){
            var params = {
                server_uuid: window.server_uuid,
                state: 'active'
            }
            context.sdc.vmapi.listVms(params, function(err, instances){
                if(err){
                    return next(err);
                }
                instances.map(function(instance){
                    if(!('window' in instance)){
                        instance.window = {
                            start: window.date_start,
                            end: window.date_end
                        }
                    }
                })
                ginext(null, instances);
            })
        },
    }, function(err, results){
        if(err){
            log.error(err);
            return next(err);
        }
        context.instances = [].concat.apply([], results.successes);
        log.info('got %d instances', context.instances.length);
        next();
    })
}
module.exports = {
    createUniqueInstanceListFromVmUuids: createUniqueInstanceListFromVmUuids,
    createUniqueInstanceListFromServerUuids: createUniqueInstanceListFromServerUuids,
    createUniqueInstanceListFromServerHostnames: createUniqueInstanceListFromServerHostnames,
    createUniqueWindowListFromVmUuids: createUniqueWindowListFromVmUuids,
    createUniqueCustomerList: createUniqueCustomerList,
    getCCListFromCustomerRoles: getCCListFromCustomerRoles,
    mergeInstancesIntoCustomers: mergeInstancesIntoCustomers,
    createUniqueWindowListFromServerHostnames: createUniqueWindowListFromServerHostnames,
    createUniqueWindowListFromServerUuids: createUniqueWindowListFromServerUuids
}
