# node-jpc-notify

node-jpc-notify is a CLI tool used by the Support and Operations teams to create ZenDesk tickets for customers to inform them of incidents and maintenance.

Eventually this will also be a node_module used by some other forms of front-ends (API, web front-end).

Head to the [wiki](https://hub.joyent.com/wiki/display/support/Support+Team%3A+jpc-notify) for more information on using this tool in the JPC.

## Usage

Run `jpc-notify` or `jpc-notify --help` for help.

```
$ jpc-notify
usage: jpc-notify [OPTIONS]
options:
    --type=maintenance|incident    REQUIRED: Type of notification.
    --message_file=FILE            REQUIRED: Path to a markdown file for the
                                   ticket's body.
    --jira=INC-X                   REQUIRED: JIRA for this notification.
    --subject="Subject goes here"  Subject of the ticket. Defaults to: 'Default
                                   subject'.
    --send                         Pass this variable to send the notifications
                                   to customers.
    -h, --help                     Print this help and exit.

  Servers:
    --servers=HOSTNAME             List customers affected by compute nodes by
                                   hostname.
    --servers_file=FILE            List customers affected by compute nodes by
                                   hostname, as read from a file.

  VMs:
    --vms=VM_UUID                  List customers affected by list of machines.
    --vms_file=FILE                List customers affected by list of machines,
                                   as read from a file.
```

Logging by default is to stdout and to a file (location displayed at end of output from the tool), so it's best to pipe to `bunyan` when using the tool.

|Flag|Description|
|:-|:-|
|`--type`|**Required**. Currently supports two ticket types: maintenance and incident.|
|`--message_file`|**Required**. A local file that contains some markdown-formatted text.|
|`--jira`|**Required**. The JIRA ticket that this notification is referring to.|
|`--subject`|Override the default subject of the ticket.|
|`--send`|Pass this flag to go through the process of actually sending tickets. Otherwise, the tool will just output some details on the customers/VMs that it has found.|
|`-h` / `--help`|Display the help output|

One of the following is **required**.

|Flag|Description|
|:-|:-|
|`--servers`|Can be used to pass 1 or many servers hostnames to the tool.|
|`--servers_file`|A local file that contains a line-delimited list of server hostnames.|
|`--vms`|Can be used to pass 1 or many VM UUIDs to the tool.|
|`--vms_file`|A local file that contains a line-delimited list of VM UUIDs.|
|`--windows_file`|A local CSV file that contains the vm_uuid, owner_uuid, date and utc_window. See Examples section for an example.|

## Examples

### Passing a line-delimited list of machine UUIDs

```
$ cat /var/tmp/machines.txt
2b2bd763-0cb6-64f6-ac21-f80dd1f28507
24f2ba85-906f-427c-863d-fda1ff473a6a
6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99
$ cat /var/tmp/message.md
This is a test ticket sent via jpc-notify.
$ jpc-notify --vms_file=/var/tmp/machines.txt --message_file=/var/tmp/message.md --type=maintenance --jira=OPS-X | bunyan
[2015-03-02T10:58:19.465Z] DEBUG: jpc-notify/27749 on Richards-MacBook-Pro.local:  (api=vmapi, path=/vms/2b2bd763-0cb6-64f6-ac21-f80dd1f28507)
[2015-03-02T10:58:19.714Z] DEBUG: jpc-notify/27749 on Richards-MacBook-Pro.local:  (api=vmapi, path=/vms/24f2ba85-906f-427c-863d-fda1ff473a6a)
[2015-03-02T10:58:19.948Z] DEBUG: jpc-notify/27749 on Richards-MacBook-Pro.local:  (api=vmapi, path=/vms/6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99)
[2015-03-02T10:58:20.179Z]  INFO: jpc-notify/27749 on Richards-MacBook-Pro.local: got 3 machines
[2015-03-02T10:58:20.179Z] DEBUG: jpc-notify/27749 on Richards-MacBook-Pro.local:  (uuid=4c27d519-f301-4d6b-a654-6b709082be72, datacenter=eu-ams-1)
[2015-03-02T10:58:20.439Z] DEBUG: jpc-notify/27749 on Richards-MacBook-Pro.local:  (uuid=7a970971-1386-49c4-9b85-f9b02adf7705, datacenter=eu-ams-1)
[2015-03-02T10:58:20.641Z]  INFO: jpc-notify/27749 on Richards-MacBook-Pro.local: got 2 customers
- customer: richardbradley (4c27d519-f301-4d6b-a654-6b709082be72)
  - vm: api (2b2bd763-0cb6-64f6-ac21-f80dd1f28507)
  - vm: mc0 (24f2ba85-906f-427c-863d-fda1ff473a6a)
- customer: PeterG (7a970971-1386-49c4-9b85-f9b02adf7705)
  - vm: myams (6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99)
No tickets have been created (pass --send to actually notify customers)
Logfile: /var/tmp/jpc-notify-2015-03-02T10:58:19.430Z.log
```

### Passing multiple `--vms` flags

```
$ cat /var/tmp/message.md
This is a test ticket sent via jpc-notify.
$ jpc-notify --vms=2b2bd763-0cb6-64f6-ac21-f80dd1f28507 --vms=24f2ba85-906f-427c-863d-fda1ff473a6a --message_file=/var/tmp/message.md --type=maintenance --jira=OPS-X | bunyan
[2015-03-02T11:04:19.154Z] DEBUG: jpc-notify/27784 on Richards-MacBook-Pro.local:  (api=vmapi, path=/vms/2b2bd763-0cb6-64f6-ac21-f80dd1f28507)
[2015-03-02T11:04:19.405Z] DEBUG: jpc-notify/27784 on Richards-MacBook-Pro.local:  (api=vmapi, path=/vms/24f2ba85-906f-427c-863d-fda1ff473a6a)
[2015-03-02T11:04:19.637Z]  INFO: jpc-notify/27784 on Richards-MacBook-Pro.local: got 2 machines
[2015-03-02T11:04:19.638Z] DEBUG: jpc-notify/27784 on Richards-MacBook-Pro.local:  (uuid=4c27d519-f301-4d6b-a654-6b709082be72, datacenter=eu-ams-1)
[2015-03-02T11:04:19.915Z]  INFO: jpc-notify/27784 on Richards-MacBook-Pro.local: got 1 customers
- customer: richardbradley (4c27d519-f301-4d6b-a654-6b709082be72)
  - vm: api (2b2bd763-0cb6-64f6-ac21-f80dd1f28507)
  - vm: mc0 (24f2ba85-906f-427c-863d-fda1ff473a6a)
No tickets have been created (pass --send to actually notify customers)
Logfile: /var/tmp/jpc-notify-2015-03-02T11:04:19.119Z.log
```

### Using the `--windows_file` flag
```
richard@Richards-MBP-Joyent ~/Projects/joyent/node-jpc-notify
$ cat /var/tmp/windows.csv
55802fa7-5dc7-46e3-9f62-98198cd4b5dc,4c27d519-f301-4d6b-a654-6b709082be72,20150410,09:00 - 10:00,01:00 - 02:00
43888b5c-df30-65e2-dee2-a9d8b2007e24,4c27d519-f301-4d6b-a654-6b709082be72,20150410,09:00 - 10:00,01:00 - 02:00
24f2ba85-906f-427c-863d-fda1ff473a6a,4c27d519-f301-4d6b-a654-6b709082be72,20150410,10:00 - 11:00,02:00 - 03:00
2b2bd763-0cb6-64f6-ac21-f80dd1f28507,4c27d519-f301-4d6b-a654-6b709082be72,20150410,10:00 - 11:00,02:00 - 03:00
richard@Richards-MBP-Joyent ~/Projects/joyent/node-jpc-notify
$ jpc-notify --windows_file=/var/tmp/windows.csv --jira=OPS-X --type=maintenance --message_file=/var/tmp/message.md | bunyan
[2016-03-24T08:51:38.596Z]  INFO: jpc-notify/53850 on Richards-MacBook-Pro-2.local: Logfile: /var/tmp/jpc-notify-2016-03-24T08:51:38.452Z.log
[2016-03-24T08:51:40.110Z]  INFO: jpc-notify/53850 on Richards-MacBook-Pro-2.local: got 4 machines
[2016-03-24T08:51:41.726Z]  INFO: jpc-notify/53850 on Richards-MacBook-Pro-2.local: got 1 customer records
- customer:    4c27d519-f301-4d6b-a654-6b709082be72 (richard.bradley@joyent.com)
  - date:      10-Apr-2015
    - window:  09:00 - 10:00 UTC
      - vm:    55802fa7-5dc7-46e3-9f62-98198cd4b5dc (penny)
      - vm:    43888b5c-df30-65e2-dee2-a9d8b2007e24 (maya)
    - window:  10:00 - 11:00 UTC
      - vm:    24f2ba85-906f-427c-863d-fda1ff473a6a (mc0)
      - vm:    2b2bd763-0cb6-64f6-ac21-f80dd1f28507 (api)
No tickets have been created (pass --send to actually notify customers)
Total: 4 vms across 1 customers/tickets
Logfile: /var/tmp/jpc-notify-2016-03-24T08:51:38.452Z.log
[2016-03-24T08:51:41.909Z]  INFO: jpc-notify/ufds/53850 on Richards-MacBook-Pro-2.local: LDAP client disconnected
```

**Note:** The following format is required for the windows CSV file.

```
vm_uuid,owner_uuid,date,window_utc
```

|Variable|Description|Format|
|:-|:-|:-|
|`vm_uuid`|This is the UUID of a VM|A valid UUID|
|`owner_uuid`|This is the owner_uuid of the VM|A valid UUID|
|`date`|This is the date of the window|`YYYYMMDD`|
|`window_utc`|This is the UTC window|String representing the time of the window|

`date` must be formatted correctly, as it is parsed to generate a JavaScript `Date` object. `window_utc` is a string and its respective timezone (UTC) is added to the output.

## Requirements

- VPN connection
- Either personal ZD credentials, or API-only credentials
