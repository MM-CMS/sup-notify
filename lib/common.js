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

    // -j, --json
    tOpts.push({
        names: ['json', 'j'],
        type: 'bool',
        help: 'JSON output.'
    });

    // -h --help
    tOpts.push({
        names: ['help', 'h'],
        type: 'bool',
        help: 'Show this help.'
    });

    return tOpts;
}

module.exports = {
    jsonStream: jsonStream,
    getCliOutputOptions: getCliOutputOptions,
};
