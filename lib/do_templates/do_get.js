var fs = require('fs');
var vasync = require('vasync');
var interfaces = require('../interfaces');
var common = require('../common');
var tabula = require('tabula');
var hogan = require('hogan.js');
var moment = require('moment');

var DATE_OUTPUT_FORMAT = 'HH:mm (UTC), DD-MMM-YYYY';

function do_get(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    var log = self.top.log;

    var context = {
        sdc: self.top.sdc,
        log: log,
        opts: opts,
        args: args,
        template_name: args[0]
    }
    vasync.pipeline({arg: context, funcs: [
        interfaces.common.loadTemplate,
        function displayTheTemplate(context, next){
            console.log(context.template);
            next();
        }
    ]}, callback);
};

do_get.options = [
].concat(common.getCliOutputOptions());

do_get.help = ([
    'Get selected template.',
    '',
    'Usage:',
    '    {{name}} get [OPTIONS] [FILTERS...]',
    '',
    '{{options}}'
].join('\n'));

module.exports = do_get;
