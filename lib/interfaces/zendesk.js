var format = require('util').format;
var vasync = require('vasync');
var async = require('async');
var csv = require('csv');
var restify = require('restify');
var hogan = require('hogan.js');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';

function sendTickets(context, callback){
    var log = context.log;
    var customers = context.customers;
    vasync.pipeline({arg: context, funcs: [
        function verifyEnvironment(context, next){
            if(!context.top.zendesk){
                return next(new Error('Environment not set. Tickets not being sent'));
            }
            next();
        },
        function createClients(context, next){
            var zendesk = context.top.zendesk;
            var zd_client = restify.createJsonClient({
                url: zendesk.url,
                version: '*',
                headers: {
                    'Connection': 'close'
                }
            });
            zd_client.basicAuth(zendesk.user, zendesk.token);

            var zd_upload_client = restify.createClient({
                url: zendesk.url,
                version: '*',
                headers: {
                    'Connection': 'close'
                }
            });
            zd_upload_client.basicAuth(zendesk.user, zendesk.token);

            context.zd_client = zd_client;
            context.zd_upload_client = zd_upload_client;
            next();
        },
        function ticketGeneration(context, next){
            var log = context.log;
            log.info('ticket preperation using information from ZenDesk');
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
                        zd_upload_client: context.zd_upload_client,
                        no_org: context.opts.no_org,
                        jira: context.opts.jira,
                        notification_levels: context.config.notification_levels,
                        template: context.template
                    }
                    vasync.pipeline({arg: ctx, funcs: [
                        generateCSVIfRequired,
                        generateTicket,
                        ensureCustomerExists,
                        getOrgIfRequired,
                        updateTicketCC
                    ]}, next);
                }
            }, next);
        },
        function preFlightConfirmation(context, next){
            /*
             * A final prompt would be great, but I think by supporting stdin
             * I have some hurdles to jump over.
             * Instead for now, I'll give the user a few seconds to think about
             * what they're about to do.
             */
            log.info('proceeding to ticket creation in 10s')
            setTimeout(next, 10000);
        },
        function ticketCreation(context, next){
            var log = context.log;
            log.info('creating %d tickets', context.customers.length);

            var tickets_created = 0;
            var tickets_failed = 0;

            var queue = vasync.queue(sendTicketPipline, context.config.zendesk_create_concurrency);

            queue.push(context.customers);

            queue.close();

            queue.on('end', function(){
                log.info('%d tickets created - %d failed', tickets_created, tickets_failed);
                next();
            });

            function sendTicketPipline(customer, next){
                var ctx = {
                    windows: context.windows,
                    customer: customer,
                    log: context.log.child({
                        customer: customer
                    }),
                    zd_client: context.zd_client,
                    zd_upload_client: context.zd_upload_client
                }
                vasync.pipeline({arg: ctx, funcs: [
                    uploadCSVIfRequired,
                    function sendTicket(context, next){
                        var log = context.log;
                        var zd_client = context.zd_client;

                        if(customer.upload_token){
                            customer.ticket.comment.uploads = [customer.upload_token];
                        }

                        zd_client.post('/api/v2/tickets.json', {'ticket': customer.ticket}, function(err, req, res, obj){
                            if(err){
                                /*
                                 * At this point we're not too concerned of tickets
                                 * failing to create. It's up to the user of the
                                 * tool to watch for these errors, and to resubmit
                                 * the task after changing the input data to
                                 * only include failed tickets.
                                 */
                                tickets_failed++;
                                log.error(err);
                                return next();
                            }
                            tickets_created++;
                            log.info({ticket: obj.ticket}, 'ticket created');
                            next();
                        });
                    }
                ]}, next);
            }
        }
    ]}, callback);
}

function generateCSVIfRequired(context, next){
    var log = context.log;
    if(!context.windows){
        log.debug('no need to generate CSV');
        return next();
    }
    var log = context.log;
    var customer = context.customer;
    log.debug('generating CSV');
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
    var ticket = customer.ticket;
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
            log.debug({customer: customer}, 'customer already exists in ZenDesk');
            customer.zd = obj.users[0];
            return next();
        }
        log.debug({customer: customer}, 'customer doesn\'t exist in ZenDesk');
        zd_client.post('/api/v2/users.json', {user: ticket.requester}, function(err, req, res, obj){
            if(err){
                return next(err);
            }
            log.debug({customer: customer}, 'customer created in ZenDesk');
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
                log.debug("customer not part of organization; skipping");
                return next();
            }
            log.debug("customer part of organization; getting details");
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
                log.debug('customer\'s organization tickets not shared; skipping');
                return next();
            }
            log.debug('customer\'s organization tickets shared; getting users');

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
    var customer = context.customer;
    if(!context.windows){
        log.debug('no need to upload CSV');
        return next();
    }
    log.debug('uploading CSV');
    var opts = {
        headers: {
            'Content-Type': 'text/plain',
            'Content-Length': customer.csv.length
        },
        path: '/api/v2/uploads.json?filename=schedule.csv'
    }
    context.zd_upload_client.post(opts, function(err, req){
        if(err){
            return next(err);
        }
        req.on('result', function(err, res){
            res.body = '';
            res.setEncoding('utf8');
            res.on('data', function(chunk){
                res.body += chunk;
            })
            res.on('end', function(){
                var body = JSON.parse(res.body);
                customer.upload_token = body.upload.token;
                next();
            });
        });
        req.write(customer.csv);
        req.end();
    });
}
function generateTicket(context, next){
    var log = context.log;
    var customer = context.customer;
    var template = context.template;
    var notification_level = context.notification_levels[template.context.level];
    log.debug('generating ticket');
    var ticket = {
        requester: {
            name: format('%s %s', customer.givenname, customer.sn),
            email: customer.email
        },
        subject: template.subject,
        submitter_id: 229634348,
        group_id: notification_level.zd_group_id,
        category: notification_level.zd_category,
        status: 'Open',
        tags: [context.jira],
        type: notification_level.zd_type,
        custom_fields: [
            {
                id: 20903582,
                value: notification_level.zd_category
            },
            {
                id: 21042152,
                value: context.jira
            }
        ],
        comment: {
            body: buildTicketBody(customer, template)
        }
    };
    customer.ticket = ticket;
    next();
};
function updateTicketCC(context, next){
    var customer = context.customer;
    var ticket = customer.ticket;
    var cc_list = [];
    /*
     * There are 2 locations we can get CC lists:
     * - customer.cc
     * - customer.zd.organization.users
     */
    customer.cc.map(function(cc){
        cc_list.push(cc.email);
    });
    if(customer.zd.organization && ('users' in customer.zd.organization)){
        customer.zd.organization.users.map(function(cc){
            cc_list.push(cc.email);
        })
    }
    ticket.collaborators = cc_list;
    next();
}
function buildTicketBody(customer, template){
    var context = template._context;
    var instance_list = '';
    if(context.type == 'windows_vms' || context.type == 'windows_server'){
        var days = [];
        /*
         * This is an easy way to split these instances into their respective
         * day of maintenance. We just drop them into an array keyed on the
         * string YYYY-MM-DD of their maintenance.
         * It makes displaying/formatting this date a bit funky later on down
         * the line, but it beats sniffing out the dates to determine seperate
         * days.
         */
        customer.instances.map(function(instance){
            instance.tbd = (instance.window.start == 'TBD') ? true : false;
            var window_start_day = (instance.tbd) ? 'TBD' : instance.window.start.format('YYYY-MM-DD');
            if(Object.keys(days).indexOf(window_start_day) < 0){
                days[window_start_day] = [];
            }
            days[window_start_day].push(instance);
        })
        Object.keys(days).sort().map(function(day){
            /*
             * We need a date object here just to display a nice string header
             * for the day. Rather than re-parsing the YYYY-MM-DD string, we'll
             * pull the first instance of the day's date object.
             */
            var day_datetime = days[day][0].window.start;

            instance_list += format('\n##### %s\n', day_datetime.format('D-MMM-YYYY'));
            days[day].sort(function(a, b){
                return a.window.start - b.window.start;
            }).map(function(instance){
                instance_list += buildInstanceMarkdown(instance);
            });
        });
    } else if (context.type == 'emails'){

    } else {
        customer.instances.map(function(instance){
            instance_list += buildInstanceMarkdown(instance);
        });
    }
    context.instance_list = instance_list;
    return hogan.compile(template.message).render(context);
}

function buildInstanceMarkdown(instance){
    var instance_markdown = '';

    function formatInstance(instance){

        var primaryIp = instance.nics.filter(function(nic){
            return nic.primary;
        })[0].ip;

        return format('%s - %s - %s (%s) %s',
            instance.datacenter,
            instance.uuid,
            instance.alias,
            (primaryIp) ? primaryIp : instance.nics[0].ip,
            (instance.internal_metadata['docker:id']) ? ' - docker_id: ' + instance.internal_metadata['docker:id'].slice(0,12) : ''
        );
    };

    if(instance.window){
        instance_markdown += format('**%s - %s UTC**: %s',
            (instance.tbd) ? 'TBD' : instance.window.start.format('HH:mm'),
            (instance.tbd) ? 'TBD' : instance.window.end.format('HH:mm'),
            formatInstance(instance)
        );
    } else {
        instance_markdown += formatInstance(instance);
    }
    return format('- %s\n', instance_markdown);
}
module.exports = {
    sendTickets: sendTickets,
    buildTicketBody: buildTicketBody
}
