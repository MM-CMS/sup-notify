var fs = require('fs');
var format = require('util').format;

function cleanupContext(context, next){
    if (context.instances) delete context.instances;
    if (context.networks) delete context.networks;
    if (context.instance_uuids) delete context.instance_uuids;
    next();
}
function loadTemplate(context, next){
    var templates_directory = context.config.templates_directory;
    var template = {};
    fs.readFile(templates_directory + '/' + context.template_name + '_initial.json', 'utf8', function(err, metadata){
        if(err){
            err = (err.code == 'ENOENT') ? new Error(format('Template metadata not exist (%s)', context.template_name)) : err;
            return next(err);
        }
        fs.readFile(templates_directory + '/' + context.template_name + '_initial.md', 'utf8', function(err, message){
            if(err){
                err = (err.code == 'ENOENT') ? new Error(format('Template body not exist (%s)', context.template_name)) : err;
                return next(err);
            }
            template = JSON.parse(metadata);
            template.message = message.toString();
            context.template = template;
            next();
        })

    });
};
module.exports = {
    cleanupContext: cleanupContext,
    loadTemplate: loadTemplate
}
