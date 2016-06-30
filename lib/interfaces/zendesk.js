var vasync = require('vasync');

function sendTickets(context, next){
    console.log('sending tickets');
    next();
}

module.exports = {
    sendTickets: sendTickets
}
