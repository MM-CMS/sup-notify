var bunyan = require('bunyan');
var stream = require('stream');
var format = require('util').format;

function createLogger(top){
    var logfile = top.config.log_dir + '/' + top.name + '-' + new Date().toISOString() + ".log";
    var output_stream = new stream();
    output_stream.write = function(obj){
        var stream_object = JSON.parse(obj);
        var message = format('[%s] ', stream_object.time);
        message += stream_object.msg;
        if(stream_object.ticket){
            message += format(' (%s)', stream_object.ticket.id);
        }
        if(stream_object.customer){
            message += format(' (%s)', stream_object.customer.email);
        }
        console.log(message);
    }
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
                    id: ticket.id
                }
            }
        },
        streams: [
            {
                level: 'trace',
                path: logfile
            },
            {
                level: 'info',
                stream: output_stream
            }
        ]
    });
};


module.exports = {
    createLogger: createLogger
}
