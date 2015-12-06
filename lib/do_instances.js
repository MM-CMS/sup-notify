var format = require('util').format;

var common = require('./common');

function do_instances(subcmd, opts, args, callback){
	var self = this;
	if(opts.help){
		this.do_help('help', {}, [subcmd], callback);
		return;
	}

	var instances = [];
	var params = {
		owner_uuid: '4c27d519-f301-4d6b-a654-6b709082be72',
		state: 'running'
	};
	self.sdc.vmapi.listVms(params, function(err, _instances){
		self.log.trace({instances: _instances.length}, 'vms done');
		if(err){
			return callback(err);
		}
		instances = _instances;
		if(!instances.length){
			return callback(new Error("no Instances found."));
		}
		
		if(opts.json){
			common.jsonStream(instances);
		} else {
			console.log(instances.length);
		}
		callback();
	});

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