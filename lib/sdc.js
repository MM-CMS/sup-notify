var async = require('async');
var restify = require('restify');
var config = require('../etc/config');
var sdcclients = require('sdc-clients');

var query = require('./query');
var log = require('./log');


/*
 * Stolen from joyent/sdc-adminui. This is a handy function, because the roles we
 * get back from ufds.listRoles can be either a string or an array of strings.
 * This function will turn empty, single, or multiple "uniquemember" entries into
 * an array, so we can reliably interrogate a new "members" list. 
 */
function _translateRole(r) {
    if (r.memberpolicy) {
        if (typeof (r.memberpolicy) === 'string') {
            r.policies = [r.memberpolicy];
        } else {
            r.policies = r.memberpolicy;
        }
    } else {
        r.policies = [];
    }
    if (r.uniquemember) {
        if (typeof (r.uniquemember) === 'string') {
            r.members = [r.uniquemember];
        } else {
            r.members = r.uniquemember;
        }
    } else {
        r.members = [];
    }
    return r;
}

module.exports.get_servers_by_rackname = function(rackname, callback){
  var search = {api: "cnapi", datacenter: "us-east-1"};
  search.path = "/servers";
  var servers = [];
  query.api(search, function(err, s){
    s.forEach(function(server){
      if(server.rack_identifier == rackname){
        servers.push(server);
      }
    })
    log.info("got " + servers.length + " servers")
    callback(null, servers)
  })
};

module.exports.get_servers_from_list = function(server_hostnames, callback){
  var search = {api: "cnapi"};
  var servers = [];
  async.eachSeries(server_hostnames, function(server_hostname, callback){
    search.path = "/servers?hostname=" + server_hostname;
    query.api(search, function(err, s){
      servers = servers.concat(s);
      callback();
    })
  }, function(err){
    log.info("got " + servers.length + " servers")
    callback(err, servers);
  });
};

module.exports.get_vms_from_list = function(vm_uuids, callback){
  var search = {api: "vmapi"};
  var virtual_machines = [];
  async.eachSeries(vm_uuids, function(vm_uuid, callback){
    search.path = "/vms/" + vm_uuid;
    query.api(search, function(err, vms){
      if(err){log.error(err)}
      virtual_machines = virtual_machines.concat(vms);
      callback();
    })
  }, function(err){
    log.info("got " + virtual_machines.length + " machines")
    callback(err, virtual_machines);
  });
};

module.exports.get_vms_from_servers = function(servers, callback){
  var search = {api: "vmapi"};
  var virtual_machines = [];
  async.eachSeries(servers, function(server, callback){
    search.path = "/vms?state=active&server_uuid=" + server.uuid;
    search.datacenter = server.datacenter;
    query.api(search, function(err, vms){
      virtual_machines = virtual_machines.concat(vms);
      callback();
    });
  }, function(err){
    log.info("got " + virtual_machines.length + " machines")
    callback(err, virtual_machines);
  })
};

module.exports.get_customers_by_email = function(customer_emails, notification_level, callback){
  var customers = [];
  config.ufds.log = log;
  var ufds = new sdcclients.UFDS(config.ufds);
  async.eachSeries(customer_emails, function(e, callback){
    if(!customers[e]){
      ufds.getUserByEmail(e, function(err, customer){
        customers[e] = customer;
        var filter = "(|(name=JPC-Notifications-All)(name=" + notification_level.jpc_name + "))";
        ufds.listRoles(customer.uuid, filter, function(err, roles){
          roles = roles.map(_translateRole)
          var cc = [];
          var members = [];
          roles.forEach(function(r){
            if("members" in r && r.members.length > 0){
              r.members.forEach(function(m){
                if(members.indexOf(m) < 0){
                  members.push(m)
                }
              })
            }
          });
          async.eachSeries(members, function(m, callback){
            ufds.search(m, {}, function(err, u){
              cc = cc.concat(u)
              callback();
            })
          }, function(err){
            customers[e].cc = cc;
            callback();
          })
        })
      });
    } else {
      callback();
    }
  }, function(err){
    ufds.close();
    var c = [];
    Object.keys(customers).forEach(function(key){
      c.push(customers[key]);
    })
    log.info("got " + c.length + " customer records")
    callback(null, c);
  });
};

module.exports.get_customers = function(virtual_machines, notification_level, callback){
  var search = {};
  var customers = [];
  config.ufds.log = log;
  var ufds = new sdcclients.UFDS(config.ufds);
  async.eachSeries(virtual_machines, function(vm, callback){
    /* 
     * Check if the customer already exists in our customers array
     * so we don't hit UFDS multiple times for a single customer
     */
    if(customers[vm.owner_uuid]){
      customers[vm.owner_uuid].vms.push(vm)
      callback();
    } else {
      /*
       * Customer not found in our array, so we find the user record and
       * push the VM, and also take the chance to sniff out the user's defined 
       * Roles for our sub-user notification system.
       */
      var search = "uuid=" + vm.owner_uuid + ", ou=users, o=smartdc";
      ufds.search(search, {}, function(err, c){
        var customer = c[0];
        if(err){
          log.fatal(err);
          console.error(err)
          callback(err);
        }
        customers[customer.uuid] = customer;
        customers[customer.uuid].vms = [];
        customers[customer.uuid].vms.push(vm);

        var filter = "(|(name=JPC-Notifications-All)(name=" + notification_level.jpc_name + "))";
        ufds.listRoles(customer.uuid, filter, function(err, roles){
          roles = roles.map(_translateRole)
          var cc = [];
          var members = [];
          roles.forEach(function(r){
            if("members" in r && r.members.length > 0){
              r.members.forEach(function(m){
                if(members.indexOf(m) < 0){
                  members.push(m)
                }
              })
            }
          });
          async.eachSeries(members, function(m, callback){
            ufds.search(m, {}, function(err, u){
              cc = cc.concat(u)
              callback();
            })
          }, function(err){
            customers[customer.uuid].cc = cc;
            callback();
          })
        })
      });
    }
  }, function(err){
    ufds.close();
    var c = [];
    Object.keys(customers).forEach(function(key){
      c.push(customers[key]);
    })
    log.info("got " + c.length + " customer records")
    callback(null, c);
  });
};