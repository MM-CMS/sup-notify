var Cmdln = require('cmdln').Cmdln;
var util = require('util');

function ExperimentalCLI(top) {
    this.top = top;
    Cmdln.call(this, {
        name: top.name + ' tickets',
        /* BEGIN JSSTYLED */
        desc: [
            'Create tickets, given only a JIRA ticket ID.'
        ].join('\n'),
        /* END JSSTYLED */
        helpOpts: {
            minHelpCol: 24 /* line up with option help */
        },
        helpSubcmds: [
            'create',
            'help'
        ]
    });
}
util.inherits(ExperimentalCLI, Cmdln);

ExperimentalCLI.prototype.init = function init(opts, args, cb) {
    this.log = this.top.log;
    Cmdln.prototype.init.apply(this, arguments);
};

ExperimentalCLI.prototype.do_create = require('./do_create');

ExperimentalCLI.aliases = ['exp'];

ExperimentalCLI.hidden = true;

module.exports = ExperimentalCLI;
