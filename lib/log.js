var bunyan = require('bunyan');

function createLogger(top){
    var logfile = top.config.log_dir + '/' + top.name + '-' + new Date().toISOString() + ".log";
    return bunyan.createLogger({
        name: top.name,
        serializers: {
            err: bunyan.stdSerializers.err,
            customer: function customer(customer){
                return {
                    uuid: customer.uuid,
                    login: customer.login,
                    email: customer.email
                }
            },
            ticket: function ticket(ticket){
                return {
                    id: ticket.id,
                    email: ticket.requester.email
                }
            }
        },
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
