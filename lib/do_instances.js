var format = require('util').format;
var vasync = require('vasync');
var common = require('./common');

function do_instances(subcmd, opts, args, callback){
	var self = this;
	if(opts.help){
		this.do_help('help', {}, [subcmd], callback);
		return;
	}
  var instance_uuids;
  if(opts.vms){
    instance_uuids = opts.vms.split(',');
  } else if(opts.file){

  } else {
    callback(new Error("Must use either --vms or --file"));
  }

	var instances = [];
	var params = {
		state: 'running'
	};
  var tasks = [];
  instance_uuids.map(function(uuid){
    tasks.push(function getVm(callback){
      params.uuid = uuid;
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
	},
  {
    names: ['file'],
    type: 'string',
    help: 'Line break delimited set of instance UUIDs.'
  },
  {
    names: ['vms'],
    type: 'string',
    help: 'something'
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
