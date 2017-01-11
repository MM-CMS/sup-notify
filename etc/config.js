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
    templates_directory: '/opt/local/lib/triton-cloud-notification-templates/notification_templates',
    message_footer: '\nThanks,\nJoyent Support',
    zendesk_create_concurrency: 1
};
