# sebastian

![sebastian.gif](./tools/sebastian.gif)

In Disney's The Little Mermaid, Sebastian is Triton's servant. Sebastian is tasked with notifying Triton of any changes in Ariel (going to the surface, exchanging her voice for a potion with Ursula that turns her human, etc).

In Joyent's Triton Cloud, Sebastian is the Support Team's servant. `sebastian` is tasked with notifying customers of any changes in the Triton Cloud (maintenance, incidents, etc).

`sebastian` talks to each of the datacenters in the Triton Cloud in order to gather information, massages this information, then creates tickets for our customer via ZenDesk. Eventually this will also be a node_module used by some other forms of front-ends (API, web front-end).

The immediate goal is to turn some input into a list of affected containers, and with this list create a notification from a template. Examples of "some input":

- Server UUID or hostname
- Container UUID
- Customer email address (including CC of full Organisation as, recorded in ZenDesk)
- Rack ID

Examples of a template:

- Incident
    - Compute node reboot
- Maintenance
    - Consolidated list per customer of container downtime based on a list of compute nodes that are to be rebooted during a given window
    - Consolidated list per customer of container downtime based on a list of containers that are to be migrated during a given window

The longer term goal is to have "some input" be an INC/CM JIRA ticket. This ticket would contain the relevant input fields (see above list for examples), the template to be used, and start/end times of the incident/maintenance. Once the JIRA ticket has been sufficiently filled out (as determined by the Incident Manager), it is at this point that `sebastian` can be invoked with the JIRA ticket ID and the notifications will go out to the customer. Exactly how this will happen (e.g. automatically via some JIRA trigger, manually via CLI giving JIRA ID) is yet to be determined.

## Usage

`sebastian` is the command you'll be working with, and it provides a number of interfaces to gather information and create ZenDesk tickets.

Below are some examples of using the tool in its current state.

### Individual instances

```
richard@Richards-MBP-Joyent ~/Projects/joyent/node-sebastian
$ ./bin/sebastian tickets create --jira=OPS-X --type=vms --date_start=20160701T100000Z --date_end=20160701T120000Z --template=incident/cn_reboot a36b984b-c67a-4018-a714-557a4e17d9ae 6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99
Customer 4c27d519-f301-4d6b-a654-6b709082be72 has 1 instances affected
Customer 7a970971-1386-49c4-9b85-f9b02adf7705 has 1 instances affected
Hello,

At approximately 10:00 (UTC), 01-Jul-2016, the physical server that hosts the instance(s) listed above rebooted, and was confirmed to be back online at approximately 12:00 (UTC), 01-Jul-2016.

Our Operations and Engineering teams are looking into this incident, and we will update you with any further information within 1 business day.
```

### Compute node reboot

#### Passing servers as arguments

```
richard@Richards-MBP-Joyent ~/Projects/joyent/node-sebastian
$ ./bin/sebastian tickets create --type=servers --template=incident/cn_reboot --date_start=20160629T103000Z --date_end=20160629T104000Z 44454c4c-5100-1054-8057-c3c04f563432
Customer 530961f3-3a6e-4ce6-bebd-e5be79f4ebc6 has 2 instances affected
Customer 7b315468-c6be-46dc-b99b-9c1f59224693 has 1 instances affected
...
```

**Note** Server hostnames still to be supported.

#### Using stdin

```
richard@Richards-MBP-Joyent ~/Projects/joyent/node-sebastian
$ cat sandbox/servers.txt | ./bin/sebastian tickets create --type=servers --template=incident/cn_reboot --date_start=20160629T103000Z --date_end=20160629T104000Z -
Customer 9dce1460-0c4c-4417-ab8b-25ca478c5a78 has 4 instances affected
Customer 530961f3-3a6e-4ce6-bebd-e5be79f4ebc6 has 2 instances affected
...
```

**Note** stdin will apply to `--type=vms`, too.

### Upcoming reboot party (aka. windows)

Now only works via stdin:

```
richard@Richards-MBP-Joyent ~/Projects/joyent/node-sebastian
$ cat sandbox/windows.csv | ./bin/sebastian tickets create --type=windows --template=maintenance/cn_reboot_windows -
Customer 4c27d519-f301-4d6b-a654-6b709082be72 has 2 days of maintenance
    2016-06-29
        Instance db9684bf-e78f-c7f8-9432-bc2e1472bc98's window is from 10:00:00 to 12:00:00
    2016-07-01
        Instance ecae6dce-67c4-4008-b8a7-fca5cceba8d4's window is from 10:00:00 to 12:00:00
        Instance eb1f8e85-fb7f-4d6c-a0f4-6ddf11a8fe96's window is from 12:00:00 to 14:00:00
        Instance a36b984b-c67a-4018-a714-557a4e17d9ae's window is from 14:00:00 to 16:00:00
Customer 7a970971-1386-49c4-9b85-f9b02adf7705 has 2 days of maintenance
    2016-06-29
        Instance 6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99's window is from 10:00:00 to 12:00:00
    TBD
        Instance fb418bd0-9c30-6652-ff3b-961e8c7c2afa's window is from TBD to TBD
Hello,

The above instances will be restarted during their corresponding windows.

Have a nice day.
```

Where `sandbox/windows.csv` contains the following.

```
ecae6dce-67c4-4008-b8a7-fca5cceba8d4,20160701T100000Z,20160701T120000Z
eb1f8e85-fb7f-4d6c-a0f4-6ddf11a8fe96,20160701T120000Z,20160701T140000Z
a36b984b-c67a-4018-a714-557a4e17d9ae,20160701T140000Z,20160701T160000Z
db9684bf-e78f-c7f8-9432-bc2e1472bc98,20160629T100000Z,20160629T120000Z
6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99,20160629T100000Z,20160629T120000Z
fb418bd0-9c30-6652-ff3b-961e8c7c2afa,TBD,TBD
```

**Note** While this is currently using the `maintenance/cn_reboot_windows` template, it's actually more suited to how our mass migrations. The tool *will* support passing a server uuid and window start/end times, like so:

```
server_0_uuid,20160701T100000Z,20160701T120000Z
server_1_uuid,20160701T120000Z,20160701T140000Z
server_2_uuid,20160701T140000Z,20160701T160000Z
server_3_uuid,20160629T100000Z,20160629T120000Z
```
