var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');
var csv = require('csv');
var restify = require('restify');
var read = require('read');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_create(subcmd, opts, args, callback){
    if(!args.length){
        return callback(new Error('JIRA_ID is required.'));
    }

    var jira_id = args[0];

    var user = "richard.bradley";
    var url = "https://devhub.joyent.com/jira";
    var client = restify.createJsonClient({
        url: url,
        version: '*',
        headers: {
            "Connection": "close",
        }
    });
    read({prompt: "JIRA password: ", silent: true}, function(err, pass){
        if(err){
            return callback(err);
        }
        client.basicAuth(user, pass);
        client.get("/jira/rest/api/2/issue/" + jira_id, function(err, req, res, obj){
            if(err && res.statusCode == 401){
                return callback(new Error("Unauthorized"));
            } else if (err && res.statusCode == 403){
                return callback(new Error("Forbidden"));
            } else if (err) {
                return callback(err);
            }
            var jira = obj;
            var ticket_opts = {
                server: jira.fields.customfield_10234,
                date_start: moment.utc(jira.customfield_10218).format(DATE_OUTPUT_FORMAT),
                date_end: moment.utc(jira.customfield_10219).format(DATE_OUTPUT_FORMAT),
                template: 'incidents/cn_reboot',
                jira: jira.key
            };

            console.log(ticket_opts);
            callback();
        });
    });

};

do_create.options = [
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets.',
    '',
    'Usage:',
    '    {{name}} create JIRA_ID',
    '',
    '{{options}}'
].join('\n'));

do_create.aliases = ['c'];

module.exports = do_create;
