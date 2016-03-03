var format = require('util').format;
var vasync = require('vasync');
var common = require('../common');

function do_instances(subcmd, opts, args, callback){
    var self = this;
    if(opts.help){
        this.do_help('help', {}, [subcmd], callback);
        return;
    }
    var instance_uuids = args;
    var instances = [];
    var params = {
        state: 'running'
    };
    var tasks = [];
    instance_uuids.map(function(instance_uuid){
        tasks.push(function getVm(callback){
            params.uuid = instance_uuid;
            self.sdc.vmapi.getVm(params, function(err, instance){
                /*
                 * Explicitely handling the callback in this way because
                 * node-sdc-clients-x is overly verbose in giving all the errs
                 * that it gets from 404 in each datacenter.
                 */
                callback(null, instance);
            });
        })
    })
    vasync.parallel({
        funcs: tasks,
    }, function(err, results){
        var instances = results.successes;
        var owner_uuids = instances.map(function(i){
            return i.owner_uuid;
        })
        console.log(owner_uuids)
    })
};

do_instances.options = [
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    }
].concat(common.getCliOutputOptions());

do_instances.help = ([
    'Instances.',
    '',
    'Usage:',
    '    {{name}} instances [<filters>...]',
    '',
    '{{options}}'
].join('\n'));

do_instances.aliases = ['insts'];

module.exports = do_instances;
