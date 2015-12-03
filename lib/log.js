var Logger = require('bunyan');

var logfile = "/var/tmp/jpc-notify-" + new Date().toISOString() + ".log";

module.exports = new Logger({
  name: 'jpc-notify',
  streams: [
    {
      level: "trace",
      path: logfile,
    },
    {
      level: "info",
      stream: process.stdout,
    },
  ]
});
