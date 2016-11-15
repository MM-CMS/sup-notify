module.exports = {
    notification_levels: {
        incident: {
            title: "Incident",
            jpc_name: "JPC-Notifications-Incident",
            zd_type: "problem",
            zd_category: "incident",
            zd_group_id: 21225150, // 31401808 for sandbox
        },
        maintenance: {
            title: "Maintenance",
            jpc_name: "JPC-Notifications-Maintenance",
            zd_type: "task",
            zd_category: "maintenance",
            zd_group_id: 20454559, // 31385107 for sandbox
        },
        emergency: {
            title: "Emergency",
            jpc_name: "JPC-Notifications-Emergency-Maintenance",
            zd_type: "task",
            zd_category: "emergency_maintenance",
            zd_group_id: 20454559,
        },
        general: {
            title: "General Notice",
            jpc_name: "JPC-Notifications-General",
            zd_type: "task",
            zd_category: "general_notice",
            zd_group_id: 28487217
        }
    },
    notification_catchall: {
        jpc_name: "JPC-Notifications-All",
    },
    notification_states: {
        open: {
            title: "Open",
        },
        pending: {
            title: "Pending",
        }
    },
    log_dir: '/var/tmp',
    templates_directory: '../triton-cloud-notification-templates/new_notification_templates',
    message_footer: '\nThanks,\nJoyent Support',
    zendesk_create_concurrency: 1,
    "datacenters": {
        "eu-ams-1": {
            "cnapi": { "url": "http://10.1.0.111" },
            "napi": { "url": "http://10.1.0.17" },
            "papi": { "url": "http://10.1.0.152" },
            "vmapi": { "url": "http://10.1.0.118" },
            "workflow": { "url": "http://10.1.0.19" }
        },
        "us-east-1": {
            "cnapi": { "url": "http://10.0.128.139" },
            "napi": { "url": "http://10.0.128.17" },
            "papi": { "url": "http://10.0.129.241" },
            "vmapi": { "url": "http://10.0.129.39" },
            "workflow": { "url": "http://10.0.128.19" }
        },
        "us-east-2": {
            "cnapi": { "url": "http://10.9.0.19" },
            "napi": { "url": "http://10.9.0.7" },
            "papi": { "url": "http://10.9.0.176" },
            "vmapi": { "url": "http://10.9.0.24" },
            "workflow": { "url": "http://10.9.0.16" }
        },
        "us-east-3": {
            "cnapi": { "url": "http://10.10.0.19" },
            "napi": { "url": "http://10.10.0.7" },
            "papi": { "url": "http://10.10.0.134" },
            "vmapi": { "url": "http://10.10.0.24" },
            "workflow": { "url": "http://10.10.0.16" }
        },
        "us-west-1": {
            "cnapi": { "url": "http://10.0.96.64" },
            "napi": { "url": "http://10.0.96.11" },
            "papi": { "url": "http://10.0.97.190" },
            "ufds": {
                "url": process.env.UFDS_URL,
                "bindDN": process.env.UFDS_DN,
                "bindPassword": process.env.UFDS_PASSWORD
            },
            "vmapi": { "url": "http://10.0.96.73" },
            "workflow": { "url": "http://10.0.96.15" }
        },
        "us-sw-1": {
            "cnapi": { "url": "http://10.0.108.61" },
            "napi": { "url": "http://10.0.108.11" },
            "papi": { "url": "http://10.0.109.138" },
            "vmapi": { "url": "http://10.0.108.87" },
            "workflow": { "url": "http://10.0.108.15" }
        }
    }
};
