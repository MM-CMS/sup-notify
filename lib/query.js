var restify = require('restify');
var async = require('async')
var ldap = require('ldapjs')
var endpoints = require('../etc/endpoints');
var log = require('./log')

module.exports.api = function(search, callback) {
  log.trace(search)
  var datacenters = [];
  var response = [];

  if(!search.datacenter){
    Object.keys(endpoints).forEach(function(datacenter){
      datacenters.push(datacenter);
    });
  } else {
    datacenters.push(search.datacenter);
  }

  async.each(datacenters, function(datacenter, callback){
    var client = restify.createJsonClient({
      url: 'http://' + endpoints[datacenter][search.api],
      headers: {
        "Connection": "close",
      }
    });

    client.get(search.path, function(err, req, res, obj){
      if(res.statusCode == 200 && obj){
        obj = [].concat(obj);
        obj.forEach(function(o){
          o.datacenter = datacenter;
        });
        if(obj.length > 0){
          log.debug("%s found in %s", search.path, datacenter)
        }
        response = response.concat(obj);
        //callback();
      }
      callback();
    });
  }, function(err){
    if(response.length == 0){
      log.debug("no records found for %s", search.path)
    }
    callback(null, response);
  });
};

module.exports.ufds = function(search, callback){
  log.trace(search)
  var customer;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

  var client = ldap.createClient({
    url: 'ldaps://' + endpoints[search.datacenter].ufds + ":636",
    //log: log,
  });
  client.bind('cn=root', 'secret', function(err, res){
    client.search('uuid=' + search.uuid + ', ou=users, o=smartdc', function(err, search){
      if(err){console.error(err)}
      search.on('searchEntry', function(e){
        customer = e.object;
      })
      search.on('error', function(err){
        console.log(err)
      })
      search.on('end', function(res){
        client.unbind(function(){
          callback(null, customer)
        })
      });
    });
  });
};