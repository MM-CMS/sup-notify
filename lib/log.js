var bunyan = require('bunyan');

function createLogger(top){
    var logfile = top.config.log_dir + '/' + top.name + '-' + new Date().toISOString() + ".log";
    return bunyan.createLogger({
        name: top.name,
        serializers: bunyan.stdSerializers,
        streams: [
            {
                level: 'trace',
                path: logfile
            },
            {
                level: 'warn',
                stream: process.stderr
            },
            {
                level: 'info',
                stream: process.stdout
            }
        ]
    });
};


module.exports = {
    createLogger: createLogger
}
