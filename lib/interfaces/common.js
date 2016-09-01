var fs = require('fs');
var format = require('util').format;
var vasync = require('vasync');

function cleanupContext(context, next){
    if (context.instances) delete context.instances;
    if (context.networks) delete context.networks;
    if (context.instance_uuids) delete context.instance_uuids;
    next();
}
function loadTemplate(context, next){
    var templates_directory = context.config.templates_directory;
    var template = {};
    vasync.pipeline({arg: context, funcs: [
        function loadTemplateMetadataIfRequired(context, next){
            if(context.opts.template === 'custom'){
                template.ticket_type = context.opts.level;
                return next();
            }
            fs.readFile(templates_directory + '/' + context.template_name + '_initial.json', 'utf8', function(err, metadata){
                if(err){
                    err = (err.code == 'ENOENT') ? new Error(format('Template metadata does not exist (%s)', context.template_name)) : err;
                    return next(err);
                }
                template = JSON.parse(metadata);
                next();
            });
        },
        function loadTemplateMessage(context, next){
            var template_message_filename;
            if(context.opts.template === 'custom'){
                template_message_filename = context.opts.message;
            } else {
                template_message_filename = templates_directory + '/' + context.template_name + '_initial.md';
            }

            fs.readFile(template_message_filename, 'utf8', function(err, message){
                if(err){
                    err = (err.code == 'ENOENT') ? new Error(format('Template body does not exist (%s)', template_message_filename)) : err;
                    return next(err);
                }
                template.message = message.toString();
                next();
            })
        }
    ]}, function(err, results){
        context.template = template;
        next();
    });
};
module.exports = {
    cleanupContext: cleanupContext,
    loadTemplate: loadTemplate
}
