var bunyan = require('bunyan');
var cmdln = require('cmdln'),
	Cmdln = cmdln.Cmdln;
var util = require('util'),
	format = util.format;

var SDC = require('sdc-clients-x');
var config = require('../etc/config');

var pkg = require('../package.json');

var OPTIONS = [
	{
		names: ['help', 'h'],
		type: 'bool',
		help: 'Print this help and exit.'
	},
	{
		name: 'version',
		type: 'bool',
		help: 'Print version and exit.'
	},
	{
		names: ['verbose', 'v'],
		type: 'bool',
		help: 'Verbose/debug output.'
	},

	{
		group: 'ZenDesk API Options'
	},

	{
		name: 'url',
		type: 'string',
		help: 'ZenDesk API URL. Environment: ZENDESK_URL',
		helpArg: 'ZENDESK_URL',
	},
	{
		name: 'token',
		type: 'string',
		help: 'ZenDesk API authentication token. Environment: ZENDESK_TOKEN',
		helpArg: 'ZENDESK_TOKEN',
	},
	{
		name: 'user',
		type: 'string',
		help: 'ZenDesk API User. Environment: ZENDESK_USER',
		helpArg: 'ZENDESK_USER',
	},

	{
		group: 'Notification Options'
	},

	{
		names: ['template', 't'],
		type: 'string',
		help: 'Name of the template to use (e.g. reboot/compute-node will load ./templates/reboot/compute-node.json',
		helpArg: 'PATH'
	},
	{
		name: 'jira',
		type: 'string',
		help: 'JIRA ticket number to associate with these notifications.',
		helpArg: 'INC-X'
	}
];

function CLI(){
	Cmdln.call(this, {
		name: 'jpc-notify',
		description: pkg.description,
		options: OPTIONS,
		helpOpts: {
			includeEnv: true,
			minHelpCol: 30
		}
	});
}
util.inherits(CLI, Cmdln);

CLI.prototype.init = function(opts, args, callback){
	var self = this;
	this.opts = opts;

	if(opts.version){
		console.log(this.name, pkg.version);
		callback(false);
		return;
	}

	this.log = bunyan.createLogger({
		name: this.name,
		serializers: bunyan.stdSerializers,
		stream: process.stderr,
		level: 'warn'
	});
	if(opts.verbose){
		this.log.level('trace');
		this.log.src = true;
		this.showErrStack = true;
	}

	this.__defineGetter__('sdc', function(){
		if(self._sdc === undefined){
			self._sdc = new SDC(config);
		}
		self.log.trace('loaded sdc client');
		return self._sdc;
	});

	Cmdln.prototype.init.apply(this, arguments);
};

// Notify by Instances
CLI.prototype.do_instances = require('./do/instances');
// Notify by Instances per Window
// Notify by Servers
// Notify by Racks
// Notify by Users

function main(argv){
	if(!argv){
		argv = process.argv;
	}

	var cli = new CLI();
	cli.main(argv, function(err, subcmd){
		var exitStatus = (err ? err.exitStatus || 1 : 0);
		var showErr = (cli.showErr !== undefined ? cli.showErr : true);

		if(err && showErr){
			var code = (err.body ? err.body.code : err.code) || err.restCode;
			if(code == 'NoCommand'){

			} else if(err.message !== undefined){
				console.error('%s%s: error%s: %s',
					cli.name,
					(subcmd ? ' ' + subcmd : ''),
					(code ? format(' (%s)', code) : ''),
					(cli.showErrStack ? err.stack : err.message));
				if(['Usage', 'Option'].indexOf(code) !== -1 && subcmd){
					var help = cli.helpFromSubcmd(subcmd);
					if(help && typeof(help) === 'string'){
						var usageIdx = help.indexOf('\nUsage:');
						if(usageIdx !== -1){
							help = help.slice(usageIdx);
						}
						console.error(help);
					}
				}
			}
		}
		process.exit(exitStatus);
	});
}

module.exports = {
	CLI: CLI,
	main: main
};
