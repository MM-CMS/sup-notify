var format = require('util').format;
var vasync = require('vasync');
var async = require('async');
var csv = require('csv');
var restify = require('restify');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';

function sendTickets(context, next){
    var log = context.log;
    var customers = context.customers;
    vasync.pipeline({arg: context, funcs: [
        function verifyEnvironment(context, next){
            if(!context.top.zendesk){
                return next(new Error('Environment not set. Tickets not being sent'));
            }
            next();
        },
        function createClient(context, next){
            var zendesk = context.top.zendesk;
            var zd_client = restify.createJsonClient({
                url: zendesk.url,
                version: '*',
                headers: {
                    'Connection': 'close'
                }
            });
            zd_client.basicAuth(zendesk.user, zendesk.token);
            context.zd_client = zd_client;
            next();
        },
        function ticketCreation(context, next){
            vasync.forEachParallel({
                inputs: context.customers,
                func: function ticketCreationPipeline(customer, next){
                    var ctx = {
                        windows: context.windows,
                        customer: customer,
                        log: context.log.child({
                            customer: customer
                        }),
                        zd_client: context.zd_client,
                        no_org: context.opts.no_org
                    }
                    vasync.pipeline({arg: ctx, funcs: [
                        generateCSVIfRequired,
                        ensureCustomerExists,
                        getOrgIfRequired,
                        uploadCSVIfRequired,
                        createTicket
                    ]}, next);
                }
            }, next);
        }
    ]}, next);
}

function generateCSVIfRequired(context, next){
    if(!context.windows){
        log.info('no need to generate CSV');
        return next();
    }
    var log = context.log;
    var customer = context.customer;
    log.info('generating CSV');
    var csv_input = [[
        'uuid',
        'name',
        'docker_id',
        'window_start',
        'window_end'
    ]];
    var days = [];
    customer.instances.map(function(instance){
        instance.tbd = (instance.window.start == 'TBD') ? true : false;
        var window_start_day =
            (instance.tbd) ? 'TBD' : instance.window.start.format('YYYY-MM-DD');
        if(Object.keys(days).indexOf(window_start_day) < 0){
            days[window_start_day] = [];
        }
        days[window_start_day].push(instance);
    });
    Object.keys(days).sort().map(function(day){
        days[day].sort(function(a, b){
            return a.window.start - b.window.start;
        }).map(function(instance){
            csv_input.push([
                instance.uuid,
                instance.alias,
                instance.internal_metadata['docker:id'] || null,
                (instance.tbd) ? 'TBD' : instance.window.start.toISOString(),
                (instance.tbd) ? 'TBD' : instance.window.end.toISOString()
            ])
        })
    });
    csv.stringify(csv_input, function(err, csv_output){
        if(err){
            next(err);
        }
        customer.csv = csv_output;
        next();
    });
}

function ensureCustomerExists(context, next){
    var customer = context.customer;
    var zd_client = context.zd_client;
    var log = context.log;
    zd_client.get(format(
        '/api/v2/users/search.json?query=%s',
        encodeURIComponent(customer.email)
    ), function(err, req, res, obj){
        if(err){
            return next(err);
        }
        if(obj.count > 0){
            log.info({customer: customer}, 'customer already exists in ZenDesk');
            customer.zd = obj.users[0];
            return next();
        }
        log.info({customer: customer}, 'customer doesn\'t exist in ZenDesk');
        zd_client.post('/api/v2/users.json', {user: customer.email}, function(err, req, res, obj){
            if(err){
                return next(err);
            }
            log.info({customer: customer}, 'customer created in ZenDesk');
            customer.zd = obj;
            next();
        })
    });
}

function getOrgIfRequired(context, next){
    if(context.no_org){
        return next();
    }
    vasync.pipeline({arg: context, funcs: [
        function getOrganisation(context, next){
            var log = context.log;
            var zd_client = context.zd_client;
            var customer = context.customer;
            if(!customer.zd.organization_id){
                log.info("customer not part of organization; skipping");
                return next();
            }
            log.info("customer part of organization; getting details");
            zd_client.get(format("/api/v2/organizations/%s.json", customer.zd.organization_id), function(err, req, res, obj){
                if(err){
                    return next(err);
                }
                customer.zd.organization = obj.organization;
                next();
            });
        },
        function getOrganisationUsersIfShared(context, next){
            var log = context.log;
            var zd_client = context.zd_client;
            var customer = context.customer;
            if(!customer.zd.organization){
                return next();
            }
            if(!customer.zd.organization.shared_tickets){
                log.info('customer\'s organization tickets not shared; skipping');
                return next();
            }
            log.info('customer\'s organization tickets shared; getting users');

            customer.zd.organization.users = [];
            /* I hate to use async here, but I still need to figure out how to
             * this with vasync. I think async.queue will work.
             */
            var finished = false;
            var users = [];
            var pagination = {
                page: 1,
                per_page: 50,
                next_page: format("/api/v2/organizations/%s/users.json", customer.zd.organization.id)
            };
            async.until(function(){
                return finished;
            }, function(next){
                zd_client.get(format(
                    "/api/v2/organizations/%s/users.json?per_page=%d&page=%d",
                    customer.zd.organization.id,
                    pagination.per_page,
                    pagination.page
                ), function(err, req, res, obj){
                    if(err){
                        return next(err);
                    }
                    if(obj.users.length > 0){
                        customer.zd.organization.users =
                            customer.zd.organization.users.concat(obj.users);
                    }
                    if(obj.next_page){
                        pagination.page++;
                    } else {
                        finished = true;
                    }
                    next();
                });
            }, next);
        }
    ]}, next);
}

function uploadCSVIfRequired(context, next){
    var log = context.log;
    if(!context.windows){
        log.info('no need to upload CSV');
        return next();
    }
    log.info('todo: upload CSV');
    next();
}
function createTicket(context, next){
    var log = context.log;
    var customer = context.customer;
    log.info('todo: ticket creation');
    next();
}
module.exports = {
    sendTickets: sendTickets
}
