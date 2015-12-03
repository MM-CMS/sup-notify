#!/usr/bin/env node

var fs = require('fs');
var async = require('async');

var sdc = require('./sdc');
var log = require('./log');
var zendesk = require('./zendesk');

module.exports.servers = function(servers, opts, template, callback){
  if(opts.servers){
    servers = opts.servers;
  } else {
    servers = fs.readFileSync(opts.servers_file, 'utf8').trim().split('\n');
  }
  sdc.get_servers_from_list(servers, function(err, servers){
    sdc.get_vms_from_servers(servers, function(err, virtual_machines){
      sdc.get_customers(virtual_machines, template.type, function(err, customers){
        if(opts.send){
          zendesk.notify(customers, template, function(err, tickets){
            if(err){
              log.error(err);
            } else {
              callback(null, {customers: customers, tickets: tickets});
            }
          });
        } else {
          callback(null, {customers: customers});
        }
      })
    });
  });
};

module.exports.virtual_machines = function(vms, opts, template, callback){
  if(opts.vms){
    vms = opts.vms;
  } else {
    vms = fs.readFileSync(opts.vms_file, 'utf8').trim().split('\n');
  }
  //console.log("vms in vms_file: %s", vms.length)
  sdc.get_vms_from_list(vms, function(err, virtual_machines){
    //console.log("vms retrieved from vmapi: %s", virtual_machines.length)
    sdc.get_customers(virtual_machines, template.type, function(err, customers){
      //console.log("customer records found: %s", customers.length)
      if(opts.send){
        //console.log("sending tickets...", customers.length);
        zendesk.notify(customers, template, function(err, tickets){
          if(err){
            log.error(err);
          } else {
            callback(null, {customers: customers, tickets: tickets});
          }
        });
      } else {
        callback(null, {customers: customers});
      }
    })
  });
}

module.exports.windows = function(windows, opts, template, callback){
  var vms_with_window = [];
  windows.forEach(function(row){
    var vm_uuid = row.vm_uuid.trim();
    var date = row.date.trim();
    var time_utc = row.time_utc.trim();
    var time_pdt = row.time_pdt.trim();

    vms_with_window[vm_uuid] = {
      date: date,
      time_utc: time_utc,
      time_pdt: time_pdt
    };
  });
  sdc.get_vms_from_list(Object.keys(vms_with_window), function(err, virtual_machines){
    sdc.get_customers(virtual_machines, template.type, function(err, customers){
      var customers_with_windows = [];
      customers.forEach(function(c){
        c.vms.forEach(function(vm){
          var w = vms_with_window[vm.uuid];
          if(!customers_with_windows[c.uuid]){
            c.windows = {};
            customers_with_windows[c.uuid] = c;
          }
          if(!customers_with_windows[c.uuid].windows[w.date]){
            customers_with_windows[c.uuid].windows[w.date] = {};
          }
          if(!customers_with_windows[c.uuid].windows[w.date][w.time_utc]){
            w.vms = [];
            customers_with_windows[c.uuid].windows[w.date][w.time_utc] = w;
          }
          customers_with_windows[c.uuid].windows[w.date][w.time_utc].vms.push(vm);
        });
      })
      if(opts.send){
        zendesk.notify_by_window(customers_with_windows, template, function(err, tickets){
          if(err){
            log.error(err);
          } else {
            callback(null, {customers: customers_with_windows, tickets: tickets});
          }
        });
      } else {
        callback(null, {customers: customers_with_windows});
      }
    });
  });
}

module.exports.customers = function(customer_emails, opts, template, callback){
  sdc.get_customers_by_email(customer_emails, opts.type, function(err, customers){
    if(opts.send){
      zendesk.notify(customers, template, function(err, tickets){
        if(err){
          log.error(err);
        } else {
          callback(null, {customers: customers, tickets: tickets});
        }
      });
    } else {
      callback(null, {customers: customers});
    }
  })
}