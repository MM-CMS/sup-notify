function cleanupContext(context, next){
    if (context.instances) delete context.instances;
    if (context.networks) delete context.networks;
    if (context.instance_uuids) delete context.instance_uuids;
    next();
}

module.exports = {
    cleanupContext: cleanupContext
}
