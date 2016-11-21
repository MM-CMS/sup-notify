var assert = require('assert-plus');
var forkExecWait = require('forkexec').forkExecWait;
var vasync = require('vasync');

var SEBASTIAN = './bin/sebastian';

describe('CLI', function(){
    describe('Gather data by instance UUID list', function(){
        it('args', function(done){
            forkExecWait({argv: [
                SEBASTIAN,
                'tickets',
                'create',
                '--jira=TEST-X',
                '--template=incidents/compute_resolved',
                '--start=20160901T100000Z',
                '--end=20160901T103000Z',
                'ecae6dce-67c4-4008-b8a7-fca5cceba8d4'
            ]}, function(err, info){
                var output = info.stdout.split('\n');
                assert.equal(output[1].slice(27), 'got 1 instances');
                done();
            });
        });
    });
});
