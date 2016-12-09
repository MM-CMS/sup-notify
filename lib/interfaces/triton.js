var vasync = require('vasync');
var common = require('../common');

function userIsDisabled(user) {
    var disabled_keywords = /disabled|fraud|nonpayment|abuse/;
    return user.approved_for_provisioning === 'false' &&
        disabled_keywords.test(user.email);
}

/*
 * Using the list of instance_uuids (args), reach out to Triton and
 * get each VM record from VMAPI.
 */
function createUniqueInstanceListFromVmUuids(context, next) {
    var log = context.log;
    var instance_uuids = context.input.data;
    var instances = [];
    log.debug('getting instance details from UUIDs');

    var queue = vasync.queue(getInstance, 20);

    queue.push(instance_uuids);

    queue.close();

    queue.on('end', function(){
        context.instances = instances;
        log.info('got %d instances', context.instances.length);
        next();
    });

    function getInstance(instance_uuid, ginext){
        var params = {
            state: 'active',
            uuid: instance_uuid
        };
        context.sdc.vmapi.getVm(params, function(err, instance){
            if(err){
                log.error(err);
                return next(err);
            }
            instances.push(instance);
            ginext();
        });
    }
}
function createUniqueInstanceListFromServerUuids(context, next) {
    var log = context.log;
    var server_uuids = context.input.data;
    var instances = [];
    log.debug('getting instances from server UUIDs');

    var queue = vasync.queue(listInstances, 10);

    queue.push(server_uuids);

    queue.close();

    queue.on('end', function(){
        context.instances = instances;
        log.info('got %d instances', context.instances.length);
        next();
    });

    function listInstances(server_uuid, linext){
        var params = {
            state: 'active',
            server_uuid: server_uuid
        };
        context.sdc.vmapi.listVms(params, function(err, _instances){
            if(err){
                log.error(err);
                return next(err);
            }
            instances = instances.concat(_instances);
            linext();
        });
    }
}
function createUniqueInstanceListFromServerHostnames(context, next){
    var log = context.log;
    var server_hostnames = context.input.data;
    var servers = [];
    log.debug('getting instance details from hostnames');

    var queue = vasync.queue(getServerByHostname, 10);

    queue.push(server_hostnames);

    queue.close();

    queue.on('end', function(){
        context.input._data = context.input.data;
        context.input._values = context.input.values;

        context.input.data = [].concat.apply([], servers).map(function(s){
            return s.uuid;
        });
        context.input.values = 'uuids';
        log.info('got %d servers', context.input.data.length);
        createUniqueInstanceListFromServerUuids(context, next);
    });

    function getServerByHostname(server_hostname, sbhnext){
        var params = {
            hostname: server_hostname
        };
        context.sdc.cnapi.listServers(params, function(err, server){
            if(err){
                log.error(err);
                return next(err);
            }
            servers.push(server);
            sbhnext();
        });
    }
}
function createUniqueWindowListFromVmUuids(context, next){
    var log = context.log;
    var windows = context.windows;
    var instances = [];
    log.debug('getting instance details from UUIDs (with window details)');

    var queue = vasync.queue(getInstance, 10);

    queue.push(windows);

    queue.close();

    queue.on('end', function(){
        context.instances = instances;
        log.info('got %d instances', context.instances.length);
        next();
    });

    function getInstance(window, ginext){
        var params = {
            state: 'active',
            uuid: window.instance_uuid
        };

        context.sdc.vmapi.getVm(params, function(err, instance){
            if(err){
                log.error(err);
                return next(err);
            }

            if(!('window' in instance)){
                instance.window = {
                    start: window.start,
                    end: window.end
                }
            }
            instances.push(instance);
            ginext();
        });
    }
}
function createUniqueCustomerListFromEmailAddresses(context, next){
    var log = context.log;
    var customer_emails = context.input.data;

    var queue = vasync.queue(getCustomer, 2);

    queue.push(customer_emails);

    queue.close();

    queue.on('end', function(){
        log.info('got %d customers', context.customers.length);
        next();
    });

    function getCustomer(customer_email, gcnext){
        log.debug({customer_email: customer_email}, 'getting customer');
        context.sdc.ufds.getUserByEmail(customer_email, function(err, user){
            if(err){
                log.error(err);
                return next(err);
            }
            if (userIsDisabled(user)) {
               log.info('ignoring disabled user: %s', customer_email);
               return gcnext();
            }
            context.customers.push(user);
            gcnext();
        });
    }
}
/*
 * Using the list of instances (ctx.instances), reach out to Triton and
 * get each customer record from UFDS.
 */
function createUniqueCustomerListFromInstanceUUIDs(context, next) {
    var log = context.log;
    var instances = context.instances;
    var customer_uuids = [];
    if(context.customers.length){
        return next();
    }
    instances.map(function(instance){
        if(customer_uuids.indexOf(instance.owner_uuid) < 0){
            customer_uuids.push(instance.owner_uuid)
        }
    });

    var queue = vasync.queue(getCustomer, 10);

    queue.push(customer_uuids);

    queue.close();

    queue.on('end', function(){
        log.info('got %d customers', context.customers.length);
        next();
    });

    function getCustomer(customer_uuid, gcnext){
        log.debug({customer_uuid: customer_uuid}, 'getting customer');
        var options = {
            searchType: 'uuid',
            value: customer_uuid
        }
        context.sdc.ufds.getUserEx(options, function(err, user){
            if(err){
                log.error(err);
                next(err);
            }
            if (userIsDisabled(user)) {
               log.info('ignoring disabled user: %s', user.email);
               return gcnext();
            }
            context.customers.push(user);
            gcnext();
        });
    }
}
function getCCListFromCustomerRoles(context, next){
    var log = context.log;
    var customers = context.customers;
    var template = context.template;
    var notification_level = context.config.notification_levels[template._context.level];
    var filter = "(|(name=JPC-Notifications-All)(name=" + notification_level.jpc_name + "))";
    log.debug('ufds search filter: %s', filter);

    vasync.pipeline({arg: context, funcs: [
        function listRoles(context, lrnext0){

            var queue = vasync.queue(listRoles, 10);

            queue.push(customers);

            queue.close();

            queue.on('end', function(){
                log.debug('done with all customers\' sub-user list')
                lrnext0();
            });
            function listRoles(customer, lrnext){
                log.debug('getting sub-user dn\'s for customer %s', customer.login);
                var members = [];
                context.sdc.ufds.listRoles(customer.uuid, filter, function(err, roles){
                    if(err){
                        log.error(err);
                        return next(err);
                    }
                    roles.map(common.translateRole).map(function(r){
                        members = members.concat(r.members);
                    });
                    customer.members = members;
                    log.debug('got %d sub-users for customer %s', customer.members.length, customer.login);
                    lrnext();
                });
            }
        },
        function getRoles(context, grnext0){
            var queue = vasync.queue(getRoles, 10);

            queue.push(customers);

            queue.close();

            queue.on('end', function(){
                log.debug('done with all customers\' members list')
                grnext0();
            })
            function getRoles(customer, grnext){
                customer.cc = [];
                var queue1 = vasync.queue(getMember, 10);

                queue1.push(customer.members);

                queue1.close();

                queue1.on('end', function(){
                    grnext();
                })
                function getMember(member, gmnext){
                    log.debug('getting member from role list for customer %s', customer.login);
                    context.sdc.ufds.search(member, {}, function(err, user){
                        if(err){
                            /*
                             * See joyent/node-sebastian#41
                             * I don't know how, but sometimes we can end up with members lists
                             * that contain records for sub-users that don't exists. I don't know
                             * how to handle this, but ultimately if the sub-user record doesn't
                             * exist in UFDS then it has probably been deleted. Ignore this error.
                             */
                            if(err.body && err.body.code == 'ResourceNotFound'){
                                log.debug('%s not found', member);
                                return gmnext();
                            }
                            return grnext0(err);
                        }
                        customer.cc = customer.cc.concat(user);
                        gmnext();
                    });
                }
            }
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
    next(new Error("not yet implemented"));
}

function determineIfServersOrInstances(context, next){
    var first_id = context.input.data[0].split(',')[0];
    vasync.parallel({
        funcs: [
            function testForVmUuid(callback){
                var params = {
                    uuid: first_id
                };
                context.sdc.vmapi.getVm(params, callback);
            },
            function testForServerUuid(callback){
                context.sdc.cnapi.getServer(first_id, callback);
            }
        ]
    }, function(err, results){
        if(err && results.nerrors > 1){
            return next(err);
        }
        var success = results.operations.filter(function(o){
            return o.result;
        })[0];
        switch(success.funcname){
            case 'testForServerUuid':
                context.input.resource = 'servers';
                break;
            case 'testForVmUuid':
                context.input.resource = 'instances';
                break;
        }
        next();
    })
}
module.exports = {
    createUniqueInstanceListFromVmUuids: createUniqueInstanceListFromVmUuids,
    createUniqueInstanceListFromServerUuids: createUniqueInstanceListFromServerUuids,
    createUniqueInstanceListFromServerHostnames: createUniqueInstanceListFromServerHostnames,
    createUniqueWindowListFromVmUuids: createUniqueWindowListFromVmUuids,
    createUniqueCustomerListFromEmailAddresses: createUniqueCustomerListFromEmailAddresses,
    createUniqueCustomerListFromInstanceUUIDs: createUniqueCustomerListFromInstanceUUIDs,
    getCCListFromCustomerRoles: getCCListFromCustomerRoles,
    mergeInstancesIntoCustomers: mergeInstancesIntoCustomers,
    createUniqueWindowListFromServerHostnames: createUniqueWindowListFromServerHostnames,
    createUniqueWindowListFromServerUuids: createUniqueWindowListFromServerUuids,
    determineIfServersOrInstances: determineIfServersOrInstances
}
