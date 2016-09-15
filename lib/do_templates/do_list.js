var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');
var tabula = require('tabula');

var TEMPLATE_DIRECTORY = 'etc/templates';
var TEMPLATE_TYPES = [
    'incidents',
    'emergency_maintenance',
    'scheduled_maintenance'
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
            var templates_directory = self.top.config.templates_directory;
            var templates = [];
            fs.readdirSync(templates_directory).filter(function(d){
                return TEMPLATE_TYPES.indexOf(d) >= 0;
            }).map(function(t){
                fs.readdirSync(templates_directory + '/' + t).filter(function(i){
                    return i.split('.')[1] === 'json';
                }).map(function(filename){
                    return filename.split('.')[0];
                }).map(function(name){
                    var body = fs.readFileSync(templates_directory + '/' + t + '/' + name + '.md').toString();
                    var metadata_file;
                    try {
                        metadata_file = fs.readFileSync(templates_directory + '/' + t + '/' + name + '.json');
                    } catch (e) {
                        metadata_file = null;
                    }
                    if(metadata_file){
                        var metadata = JSON.parse(metadata_file);
                        templates.push({
                            name: t + '/' + name.slice(0, -8),
                            type: t,
                            description: metadata.description
                        });
                    }
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
