var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');

function do_list(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    var log = self.top.log;

    var templates;

    vasync.parallel({funcs: [
        function getTheTemplates(next){
            next();
        }
    ]}, function (err, results){
        if(err){
            return callback(err);
        }
        console.log("done.");
        callback();
    });
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
