var async = require('async');
var restify = require('restify');
var fs = require('fs');
var moment = require('moment');
var csv = require('csv');

var log = require('./log');

var get_client = function(url, user, token){
  var client = restify.createJsonClient({
    url: url,
    version: '*',
    headers: {
      "Connection": "close",
    },
  });
  client.basicAuth(user, token);
  return client;
}

function notify(customers, template, callback){
  var client = get_client(template.zd_api.url, template.zd_api.user, template.zd_api.token);
  build_ticket_list(customers, client, template, function(err, tickets){
    send_tickets(tickets, client, function(err, result){
      callback(err, result);
    });
  })
};

module.exports.notify_by_window = function(customers, template, callback){
  var tickets = [];
  async.eachSeries(Object.keys(customers), function(c_uuid, callback){
    generate_csv(customers[c_uuid], function(err, windows_csv){
      upload_file(windows_csv, template, function(err, res){
        log.debug("%s's attachment uploaded : %j", customers[c_uuid].email, res.upload.attachments)
        customers[c_uuid].upload_token = res.upload.token;
        var c = [customers[c_uuid]];
        notify(c, template, function(err, t){
          if(err){
            log.error(err);
          } else {
            tickets = tickets.concat(t);
            callback();
          }
        })
      });
    });
  }, function(err){
    callback(err, tickets);
  });
};

var generate_csv = function(customer, callback){
  var input = [["uuid", "name", "docker_id", "date", "window_utc"]];
  Object.keys(customer.windows).sort().forEach(function(date_string){
    var date = moment(new Date(date_string.slice(0, 4), date_string.slice(4, 6)-1, date_string.slice(6, 8)));
    Object.keys(customer.windows[date_string]).sort().forEach(function(w){
      customer.windows[date_string][w].vms.forEach(function(vm){
        if(vm.internal_metadata['docker:id']){
          input.push([vm.uuid, vm.alias, vm.internal_metadata['docker:id'].slice(0,12), date.format("D-MMM-YYYY"), customer.windows[date_string][w].time_utc]);
        } else {
          input.push([vm.uuid, vm.alias, "", date.format("D-MMM-YYYY"), customer.windows[date_string][w].time_utc]);
        }
      })
    })
  });
  csv.stringify(input, function(err, output){
    //fs.writeFileSync("/var/tmp/windows." + customer.uuid + ".csv", output)
    callback(err, output);
  });
};

var upload_file = function(file, template, callback){
  //var post_body = new Buffer();
  var opts = {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': file.length,
      'Connection': 'close',
    },
    path: "/api/v2/uploads.json?filename=schedule.csv",
  };

  var client = restify.createClient({
      url: template.zd_api.url,
      version: '*',
      headers: {
        'Connection': 'close'
    }
  });
  client.basicAuth(template.zd_api.user, template.zd_api.token);

  client.post(opts, function(err, req){
    if(err){
      callback(err)
    } else {
      req.on('result', function(err, res){
        res.body = '';
        res.setEncoding('utf8');
        res.on('data', function(chunk){
          res.body += chunk;
        })
        res.on('end', function(){
          var body = JSON.parse(res.body)
          callback(null, body);
        })
      })
      req.write(file);
      req.end();
    }
  });
};

var ensure_customer_exists = function(customer, client, callback){
  client.get("/api/v2/users/search.json?query='" + encodeURIComponent(customer.email) + "'", function(err, req, res, obj){
    if(err){
      log.error(err)
      callback(err)
    } else {
      if(obj.count > 0){
        log.debug("user " + customer.email + " already exists in ZenDesk")
        customer.zd = obj.users[0];
        callback();
      } else {
        log.debug("user " + customer.email + " doesn't exist in ZenDesk")
        client.post("/api/v2/users.json", {user: customer.email}, function(err, req, res, obj){
          log.debug("user " + customer.email + " created in ZenDesk")
          customer.zd = obj;
          callback();
        });
      }
    }
  })
};

var customer_organisation_list = function(customer, client, callback){
  customer.zd.organizations = [];
  if(customer.zd.organization_id){
    log.info(customer.email, "part of organization; getting details")
    client.get("/api/v2/users/" + customer.zd.id + "/organizations.json", function(err, req, res, obj){
      if(err){
        log.error(err);
        callback(err);
      } else {
        customer.zd.organizations = obj.organizations;
        callback();
      }
    });
  } else {
    log.info(customer.email, "not part of organization; skipping")
    callback();
  }
};

var organisation_user_list = function(customer, client, callback){
  if(customer.zd.organizations.length){
    async.eachSeries(customer.zd.organizations, function(organization, callback){
      organization.users = []
      if(organization.shared_tickets){
        log.info(customer.email, organization.name, 'organization tickets shared; getting users')
        var finished = false;
        var users = [];
        var pagination = {
          page: 1,
          per_page: 50,
          next_page: "/api/v2/organizations/" + organization.id + "/users.json"
        };
        async.until(function(){
          return finished;
        }, function(callback){
          client.get("/api/v2/organizations/" + organization.id + "/users.json?per_page=" + pagination.per_page + "&page=" + pagination.page, function(err, req, res, obj){
            if(err){
              log.error(err);
              callback(err);
            } else {
              if(obj.users.length > 0){
                organization.users = organization.users.concat(obj.users);
              }
              if(obj.next_page){
                pagination.page++;
              } else {
                finished = true;
              }
              callback();
            }
          });
        }, function(err){
          callback();
        });
      } else {
        log.info(customer.email, '(' + organization.name + ')', 'organization tickets not shared; skipping')
        callback();
      }
    }, function(err){
      callback();
    });
  } else {
    callback();
  }
};

var get_user_organization_users = function(customer, client, callback){
  async.series([
    function(callback){
      customer_organisation_list(customer, client, function(err){
        callback(err)
      });
    },
    function(callback){
      organisation_user_list(customer, client, function(err){
        callback(err)
      });
    }
  ], function(err){
    callback(err);
  })
};

var build_ticket_list = function(customers, client, template, callback){
  var tickets = [];
  async.eachSeries(customers, function(customer, callback){
    var ticket = build_ticket(customer, template);
    ensure_customer_exists(customer, client, function(err){
      if(err){
        log.error(err)
        callback(err)
      } else {
        if("cc" in customer){
          customer.cc.forEach(function(c){
            ticket.collaborators.push(c.email);
          });
        }
        if(template.organization){
          get_user_organization_users(customer, client, function(err){
            customer.zd.organizations.forEach(function(o){
              o.users.forEach(function(u){
                if(!(u.email in ticket.collaborators)){
                  ticket.collaborators.push(u.email);
                }
              })
            });
            tickets.push(ticket);
            callback();
          })
        } else {
          tickets.push(ticket);
          callback();
        }
      }
    });
  }, function(err){
    callback(null, tickets)
  });
};

var send_tickets = function(tickets, client, callback){
  var sent_tickets = [];
  async.eachSeries(tickets, function(ticket, callback){
    client.post("/api/v2/tickets.json", {"ticket": ticket}, function(err, req, res, obj){
      if(err){
        var msg = {err: "failed to send ticket", ticket: ticket, reason: err};
        log.error(msg)
        /*
         * We don't want to end script execution here, so we're simply logging the
         * error and continuing (Thanks, Jay)
         */
        callback()
      } else {
        log.info("ticket sent to", ticket.requester.email, "(#" + obj.ticket.id + ")")
        sent_tickets.push(obj.ticket)
        callback();
      }
    });
  }, function(err){
    if(err){
      callback(err);
    } else {
      callback(null, sent_tickets)
    }
  });
};

var ticket_body = function(customer, template){
  var message = "";
  if(template.windows){
    message += template.message.trim() + "\n\n";
    Object.keys(customer.windows).sort().forEach(function(date_string){
      var date = moment(new Date(date_string.slice(0, 4), date_string.slice(4, 6)-1, date_string.slice(6, 8)));
      Object.keys(customer.windows[date_string]).sort().forEach(function(w){
        message += "##### " + date.format("D-MMM-YYYY") + ": Window " + customer.windows[date_string][w].time_utc + " UTC\n\n";
        customer.windows[date_string][w].vms.forEach(function(vm){
          message += "- " + vm.datacenter + " - " + vm.uuid + ": " + vm.alias + " (" + vm.nics[0].ip + ")";
          if(vm.internal_metadata['docker:id']){
            message += " - docker_id: " + vm.internal_metadata['docker:id'].slice(0,12);
          }
          message += "\n";
        });
        message += "\n";
      });
    });
  } else if(template.customers){
    message += template.message.trim() + "\n\n";
  } else {
    message = "#### Affected instances\n\n";
    customer.vms.forEach(function(vm){
      message += "- " + vm.datacenter + " - " + vm.uuid + ": " + vm.alias + " (" + vm.nics[0].ip + ")"
      if(vm.internal_metadata['docker:id']){
        message += " - docker_id: " + vm.internal_metadata['docker:id'].slice(0,12);
      }
      message += "\n";
    })
    message += "\n" + template.message.trim() + "\n\n";
  }

  message += "Thanks,\nJoyent Support";
  return message;
};

var build_ticket = function(customer, template){
  var ticket = {
    "requester": {
      "name": customer.givenname + " " + customer.sn,
      "email": customer.email,
    },
    "collaborators": [],
    "subject": "[" + template.type.title + "] " + template.subject,
    "submitter_id": 229634348,
    "group_id": template.type.zd_group_id,
    "category": template.type.zd_category,
    "status": template.status,
    "tags": [ template.jira ],
    "type": template.type.zd_type,
    "custom_fields": [
      {
        "id": 20903582,
        "value": template.type.zd_category,
      },
      {
        "id": 21042152,
        "value": template.jira,
      }
    ],
    "comment": {
      "body": ticket_body(customer, template),
    },
  };
  if(template.windows){
    ticket.comment.uploads = [customer.upload_token];
  }
  return ticket;
};

module.exports.notify = notify;
