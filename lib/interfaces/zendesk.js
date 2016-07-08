var format = require('util').format;
var vasync = require('vasync');
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
                        log: context.log,
                        zd_client: context.zd_client,
                        no_org: context.opts.no_org
                    }
                    vasync.pipeline({arg: ctx, funcs: [
                        generateCSVIfRequired,
                        ensureCustomerExists,
                        getOrgIfRequired
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
    var csv_input = [['uuid', 'name', 'docker_id', 'window_start', 'window_end']];
    var days = [];
    customer.instances.map(function(instance){
        instance.tbd = (instance.window.start == 'TBD') ? true : false;
        var window_start_day = (instance.tbd) ? 'TBD' : instance.window.start.format('YYYY-MM-DD');
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
    zd_client.get(format('/api/v2/users/search.json?query=%s', encodeURIComponent(customer.email)), function(err, req, res, obj){
        if(err){
            return next(err);
        }
        if(obj.count > 0){
            log.info('user %s already exists in ZenDesk', customer.email);
            customer.zd = obj.users[0];
            return next();
        }
        log.info('user %s doesn\'t exist in ZenDesk', customer.email);
        zd_client.post('/api/v2/users.json', {user: customer.email}, function(err, req, res, obj){
            if(err){
                return next(err);
            }
            log.info('user %s created in ZenDesk', customer.email);
            customer.zd = obj;
            next();
        })
    });
}

function getOrgIfRequired(context, next){
    console.log(context.no_org);
    next();
}
module.exports = {
    sendTickets: sendTickets
}
