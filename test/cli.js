var assert = require('assert-plus');
var forkExecWait = require('forkexec').forkExecWait;
var vasync = require('vasync');

var PROGNAME = './bin/sup-notify';

describe('CLI', function(){
    describe('Gather data by instance UUID list', function(){
        it('UFDS Environment variables must be set', function () {
            assert.equal(true,
                !!(process.env.UFDS_PASSWORD && process.env.UFDS_URL && process.env.UFDS_DN));
        });
        it('args', function(done){
            forkExecWait({argv: [
                PROGNAME,
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
