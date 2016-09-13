var Cmdln = require('cmdln').Cmdln;
var util = require('util');

function TemplateCLI(top) {
    this.top = top;
    Cmdln.call(this, {
        name: top.name + ' templates',
        /* BEGIN JSSTYLED */
        desc: [
            'View available pre-written templates for use in notifications.'
        ].join('\n'),
        /* END JSSTYLED */
        helpOpts: {
            minHelpCol: 24 /* line up with option help */
        },
        helpSubcmds: [
            'list',
            'get',
            'help'
        ]
    });
}
util.inherits(TemplateCLI, Cmdln);

TemplateCLI.prototype.init = function init(opts, args, cb) {
    this.log = this.top.log;
    Cmdln.prototype.init.apply(this, arguments);
};

TemplateCLI.prototype.do_list = require('./do_list');
TemplateCLI.prototype.do_get = require('./do_get');

TemplateCLI.aliases = ['tpl'];

module.exports = TemplateCLI;
