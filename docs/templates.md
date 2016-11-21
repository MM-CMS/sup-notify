# Templates

Templates are used in sup-notify in order to reduce the amount of time users of the tool spend creating notices.

## Discovery

To find out what templates are available to you, run `sup-notify templates list`. For example:

```
NAME                                   TYPE                   DESCRIPTION
incidents/compute_ongoing              incidents              Notify users of a single occurence of a compute infrastructure hang.
incidents/compute_resolved             incidents              Notify users of a single occurence of a compute infrastructure reboot.
incidents/network_ongoing              incidents              Notify users of a single occurence of an ongoing network infrastructure issue.
scheduled_maintenance/compute_windows  scheduled_maintenance  Notify users of many upcoming maintenance tasks of a similar kind in a single notification.

```

You would then use the `NAME` of the template when creating a notification, for example:

```
sup-notify tickets create --template=incidents/compute_resolved ...
```

These templates will have a set of required fields that must be passed to `sup-notify tickets create` in order for them to be used, and these will be prompted for when attempting to send notifications.

They will also be tied to a certain set of resources. For example, `incidents/compute_resolved` can only be used with servers or instances as resource input, not a list of email addresses.

It's also possible to use a one-off template by passing `--template=custom` when creating tickets. See prompted output from the tool when attempting to use this feature.

## Creation

Templates consist of 2 pieces: a `.md` file (message) and a `.json` file (metadata). A template's message file must also have a corresponding metadata file, and vice versa. To associate a message/metadata pair, their filenames before the `.` must be the same. For example:

```
compute_resolved_initial.md
compute_resolved_initial.json
```

Templates must be named with `_initial`, like above. This is because the tool will eventually be able to send subsequent updates to tickets, so we need to differentiate between different updates to the ticket.

Another example of a template's message/metadata is as follows:

```
some_other_type_of_incident_initial.md
some_other_type_of_incident_initial.json
```

**Note** There is currently _no_ validation on templates and their various metadata pieces. Templates should be created and tested

### `.md` file (message)

This file contains the markdown-formatted message that the user will see in the ticket. It also supports some [Handlebars templating syntax](http://handlebarsjs.com/), which are:

**`start`**: A date and time object requested as input when creating tickets, formatted like so: "16:13, 22-Sep-2016". This is the start date/time of the incident/maintenance/etc.

**`end`**: Same as `start`, but for the end of the incident/maintenance/etc.

**`instance_list`**: This will contain the list of instances that the tool has generated based on its inputs

### `.json` file (metadata)

This file must be valid JSON, and the following data should be included.

**`title`**: [internal only] Our title for the template

**`description`**: [internal only] Description of the template's usage. Appears in `sup-notify templates list`

**`subject`**: _REQUIRED_ Subject of the ticket that is created for the customer

**`version`**: [internal only] Version of the template

**`level`**: _REQUIRED_ One of "incident", "maintenance", "emergency" or "general". Determines the group/category that the ticket ends up in in ZenDesk

**`resources`**: _REQUIRED_ List of "servers", "instances", and/or "customers". Validates the inputs from the tool against the template (to prevent e.g. using a template that has no `instance_list` with instance UUID inputs)

**`required_fields`**: _REQUIRED_ List of "start" and/or "end". Prompts user of the tool for input data in order to populate template

**`csv`**: [internal only] Determines if this template should be used as a set of windows (see "Upcoming reboot party (aka. windows)")
