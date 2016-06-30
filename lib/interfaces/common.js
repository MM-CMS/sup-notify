var fs = require('fs');
var format = require('util').format;

function cleanupContext(context, next){
    if (context.instances) delete context.instances;
    if (context.networks) delete context.networks;
    if (context.instance_uuids) delete context.instance_uuids;
    next();
}
function loadTemplate(context, next){
    fs.readFile('etc/templates/' + context.template_name + '/initial.json', 'utf8', function(err, template){
        if(err){
            err = (err.code == 'ENOENT') ? new Error(format('Template does not exist (%s)', context.template_name)) : err;
            return next(err);
        }
        context.template = JSON.parse(template);
        next();
    });
};
module.exports = {
    cleanupContext: cleanupContext,
    loadTemplate: loadTemplate
}
