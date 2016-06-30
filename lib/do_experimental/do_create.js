var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var interfaces = require('../interfaces');
var hogan = require('hogan.js');
var moment = require('moment');
var csv = require('csv');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';
var DATE_INPUT_FORMAT = 'YYYYMMDD\THHmmss\Z';

function do_create(subcmd, opts, args, callback){
    console.log("done.");
    callback();
};

do_create.options = [
    {
        names: ['jira'],
        type: 'string',
        help: 'JIRA ticket number associated with this notification.'
    }
].concat(common.getCliOutputOptions());

do_create.help = ([
    'Create tickets.',
    '',
    'Usage:',
    '    {{name}} create [OPTIONS]',
    '',
    '{{options}}'
].join('\n'));

do_create.aliases = ['c'];

module.exports = do_create;
