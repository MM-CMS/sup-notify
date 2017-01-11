var cmdln = require('cmdln'),
    Cmdln = cmdln.Cmdln;
var util = require('util'),
    format = util.format;
var log = require('./log');

var SDC = require('sdc-clients-x');
var zendesk = require('node-zendesk');
var config = require('../etc/config');
var fs = require('fs');

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
        name: 'datacenter',
        type: 'string',
        help: 'Path to datacenter config file.',
        helpArg: 'DC',
        env: 'DC'
    },

    {
        group: 'ZenDesk API Options'
    },

    {
        name: 'url',
        type: 'string',
        help: 'ZenDesk API URL.',
        helpArg: 'NOTIFY_URL',
        env: 'NOTIFY_URL'
    },
    {
        name: 'token',
        type: 'string',
        help: 'ZenDesk API authentication token.',
        helpArg: 'NOTIFY_TOKEN',
        env: 'NOTIFY_TOKEN'
    },
    {
        name: 'user',
        type: 'string',
        help: 'ZenDesk API User.',
        helpArg: 'NOTIFY_USER',
        env: 'NOTIFY_USER'
    }
];

function CLI(){
    Cmdln.call(this, {
        name: 'sup-notify',
        description: pkg.description,
        options: OPTIONS,
        helpOpts: {
            includeEnv: true,
            minHelpCol: 30
        },
        helpSubcmds: [
            'help',
            'tickets',
            'templates'
        ]
    });
}
util.inherits(CLI, Cmdln);

CLI.prototype.init = function(opts, args, callback){
    var self = this;
    this.opts = opts;
    this.config = config;
    if(opts.version){
        console.log(this.name, pkg.version);
        callback(false);
        return;
    }

    this.log = log.createLogger(self);

    if(opts.verbose){
        this.log.level('trace');
        this.log.src = true;
        this.showErrStack = true;
    }
    if(opts.url && opts.token && opts.user){
        this.config.zendesk = {
            remoteUri: opts.url + '/api/v2',
            token: opts.token,
            username: opts.user
        }
    }

    if(opts.datacenter){
	try {
            this.log.trace('Loading datacenter config file: ' + opts.datacenter);
            this.config.datacenters = JSON.parse(fs.readFileSync(opts.datacenter));
            for (var i in this.config.datacenters ) {
                if (this.config.datacenters[i].ufds === true) {
                    this.log.trace('Connecting to UFDS in ' + i);
                    this.config.datacenters[i].ufds = {
                        url: process.env.UFDS_URL,
                        bindDN: process.env.UFDS_DN,
                        bindPassword: process.env.UFDS_PASSWORD
                    }
                }
            }
	} catch (e) {
            console.error('JSON parse error', e);
            return callback(new Error('Unable to parse datacenter config:'
                + opts.datacenter));
	}
    }

    this.__defineGetter__('sdc', function(){
        if(self._sdc === undefined){
            self._sdc = new SDC(config);
        }
        self.log.trace('loaded sdc client');
        return self._sdc;
    });
    this.__defineGetter__('zendesk', function(){
        if(self._zendesk === undefined && self.config.zendesk){
            self._zendesk = zendesk.createClient(self.config.zendesk);
        }
        self.log.trace('loaded zendesk client');
        return self._zendesk;
    });

    Cmdln.prototype.init.apply(this, arguments);
};

CLI.prototype.do_tickets = require('./do_tickets');
CLI.prototype.do_templates = require('./do_templates');
CLI.prototype.do_experimental = require('./do_experimental');

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
