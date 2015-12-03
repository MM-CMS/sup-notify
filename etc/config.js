module.exports = {
	ufds: {
		url: "ldaps://10.0.96.21",
		bindDN: "cn=root",
		bindPassword: "secret",
	},
	notification_levels: {
		incident: {
			title: "Incident",
			jpc_name: "JPC-Notifications-Incident",
			zd_type: "problem",
			zd_category: "incident",
			zd_group_id: 21225150,
		},
		maintenance: {
			title: "Maintenance",
			jpc_name: "JPC-Notifications-Maintenance",
		    zd_type: "task",
		    zd_category: "maintenance",
		    zd_group_id: 20454559,
		},
		emergency: {
			title: "Emergency",
			jpc_name: "JPC-Notifications-Emergency-Maintenance",
		    zd_type: "task",
		    zd_category: "emergency_maintenance",
		    zd_group_id: 20454559,
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
	}
}