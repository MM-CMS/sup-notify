var assert = require('assert-plus');

function jsonStream(arr, stream) {
    stream = stream || process.stdout;

    arr.forEach(function (elem) {
        stream.write(JSON.stringify(elem) + '\n');
    });
}

function getCliOutputOptions(opts) {
    opts = opts || {};
    assert.object(opts, 'opts');

    var o;

    // construct the options object
    var tOpts = [];

    // -h --help
    tOpts.push({
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    });

    // -j, --json
    tOpts.push({
        names: ['json', 'j'],
        type: 'bool',
        help: 'JSON output.'
    });

    return tOpts;
}

function translateRole(r) {
    if (r.memberpolicy) {
        if (typeof (r.memberpolicy) === 'string') {
            r.policies = [r.memberpolicy];
        } else {
            r.policies = r.memberpolicy;
        }
    } else {
        r.policies = [];
    }
    if (r.uniquemember) {
        if (typeof (r.uniquemember) === 'string') {
            r.members = [r.uniquemember];
        } else {
            r.members = r.uniquemember;
        }
    } else {
        r.members = [];
    }
    return r;
}

module.exports = {
    jsonStream: jsonStream,
    getCliOutputOptions: getCliOutputOptions,
    translateRole: translateRole
};
