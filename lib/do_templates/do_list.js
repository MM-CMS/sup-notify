var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var tabula = require('tabula');

var TEMPLATE_DIRECTORY = 'etc/templates';
var TEMPLATE_TYPES = [
    'incident',
    'maintenance',
    'emergency_maintenance'
];

function do_list(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    var log = self.top.log;

    var context = {
        sdc: self.top.sdc,
        log: self.top.log,
        opts: opts,
        args: args
    }
    vasync.pipeline({arg: context, funcs: [
        function getTheTemplates(context, next){
            var templates = [];
            fs.readdirSync(TEMPLATE_DIRECTORY).filter(function(d){
                return TEMPLATE_TYPES.indexOf(d) >= 0;
            }).map(function(t){
                fs.readdirSync(TEMPLATE_DIRECTORY + '/' + t).map(function(i){
                    var template = JSON.parse(fs.readFileSync(TEMPLATE_DIRECTORY + '/' + t + '/' + i + '/' + 'initial.json'));
                    templates.push({
                        name: t + '/' + i,
                        type: t,
                        description: template.description
                    });
                })
            })
            context.templates = templates;
            next();
        },
        function displayTheTemplates(context, next){
            var templates = context.templates;
            tabula(templates);
            next();
        }
    ]}, callback);
};

do_list.options = [
].concat(common.getCliOutputOptions());

do_list.help = ([
    'List available templates.',
    '',
    'Usage:',
    '    {{name}} list [OPTIONS] [FILTERS...]',
    '',
    '{{options}}'
].join('\n'));

do_list.aliases = ['ls'];

module.exports = do_list;
