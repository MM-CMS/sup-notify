var Cmdln = require('cmdln').Cmdln;
var util = require('util');

function TicketsCLI(top) {
    this.top = top;
    Cmdln.call(this, {
        name: top.name + ' tickets',
        /* BEGIN JSSTYLED */
        desc: [
            'Create tickets.'
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
util.inherits(TicketsCLI, Cmdln);

TicketsCLI.prototype.init = function init(opts, args, cb) {
    this.log = this.top.log;
    Cmdln.prototype.init.apply(this, arguments);
};

TicketsCLI.prototype.do_create = require('./do_create');

TicketsCLI.aliases = ['tkt'];

module.exports = TicketsCLI;
