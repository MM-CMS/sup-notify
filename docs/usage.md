# Usage

`sebastian` is the command you'll be working with, and it provides a number of interfaces to gather information and create ZenDesk tickets.

The resources we're sending notifications about (e.g. compute nodes, instances, emails) are passed as arguments (or `stdin`), and the required information for generating the tickets is passed as options.

When using the tool, the type of resource (e.g. whether it's a server or an instance UUID) is automatically determined. This is done by testing against the first resource supplied, and from this point on it is assumed that the rest of the resources are of the same type.

For example, if you pass 2 arguments, 1 server hostname and 1 email address, the tool will only find 1 server record, because searching for an email address as a server will return no results.

## Examples

### Compute infrastructure incident, resolved by the time notices are sent. Input as arguments

```
$ sebastian tickets create --jira=OPS-X --template=incidents/compute_resolved --start=20160922T161200Z --end=20160922T161300Z PAFSTWV42
[2016-09-30T09:33:52.112Z] logfile: /var/tmp/sebastian-2016-09-30T09:33:51.807Z.log
[2016-09-30T09:33:52.510Z] got 1 servers
[2016-09-30T09:33:52.908Z] got 10 instances
[2016-09-30T09:33:54.154Z] got 10 customers
[2016-09-30T09:33:54.576Z] summary of information
Customer progdot has 1 instances affected
Customer magnusnordlander has 1 instances affected
...
```

### Network infrastructure incident affecting entire rack (multiple servers), still ongoing by the time notices are sent. Input as `stdin`

```
$ cat /var/tmp/servers.txt | sebastian tickets create --template=incidents/network_ongoing --start=20160629T103000Z -
[2016-09-30T09:41:37.740Z] logfile: /var/tmp/sebastian-2016-09-30T09:41:37.445Z.log
[2016-09-30T09:41:38.151Z] got 2 servers
[2016-09-30T09:41:38.574Z] got 17 instances
...
```

Where `/var/tmp/servers.txt` contains a list of line separated server hostnames or UUIDs.

### Upcoming reboot party (aka. windows)

```
cat /var/tmp/windows.csv | ./bin/sebastian tickets create --jira=OPS-X --template=scheduled_maintenance/compute_windows -
[2016-09-30T09:48:29.393Z] logfile: /var/tmp/sebastian-2016-09-30T09:48:29.094Z.log
[2016-09-30T09:48:30.620Z] got 7 instances
[2016-09-30T09:48:31.459Z] got 2 customers
[2016-09-30T09:48:32.280Z] summary of information
  Customer richardbradley has 2 days of maintenance
    2016-06-29
      db9684bf-e78f-c7f8-9432-bc2e1472bc98's window is from 10:00:00 to 12:00:00
    2016-07-01
      ecae6dce-67c4-4008-b8a7-fca5cceba8d4's window is from 10:00:00 to 12:00:00
      5c49e7aa-92da-4509-bdd9-d4719208f553's window is from 10:00:00 to 12:00:00
      eb1f8e85-fb7f-4d6c-a0f4-6ddf11a8fe96's window is from 12:00:00 to 14:00:00
      a36b984b-c67a-4018-a714-557a4e17d9ae's window is from 14:00:00 to 16:00:00
  Customer PeterG has 2 days of maintenance
    2016-06-29
      6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99's window is from 10:00:00 to 12:00:00
    TBD
      fb418bd0-9c30-6652-ff3b-961e8c7c2afa's window is from TBD to TBD
...
```

Where `/var/tmp/windows.csv` contains the following.

```
ecae6dce-67c4-4008-b8a7-fca5cceba8d4,20160701T100000Z,20160701T120000Z,4c27d519-f301-4d6b-a654-6b709082be72
eb1f8e85-fb7f-4d6c-a0f4-6ddf11a8fe96,20160701T120000Z,20160701T140000Z
a36b984b-c67a-4018-a714-557a4e17d9ae,20160701T140000Z,20160701T160000Z
db9684bf-e78f-c7f8-9432-bc2e1472bc98,20160629T100000Z,20160629T120000Z
6bad634a-0e36-ccfc-fe8b-a5ca0f56ef99,20160629T100000Z,20160629T120000Z
fb418bd0-9c30-6652-ff3b-961e8c7c2afa,TBD,TBD
5c49e7aa-92da-4509-bdd9-d4719208f553,20160701T100000Z,20160701T120000Z,4c27d519-f301-4d6b-a654-6b709082be72
```

**Note** Only 3 columns are required and used by the tool, which are `resource_uuid,start,end`. The fourth column above is ignored, but sometimes useful to populate when creating this list so that some form of pre-sorting can be done.

**Note** The `start` or `end` date can be populated with the string `"TBD"` if a date isn't confirmed for this resource, but will definitely be included in the maintenance.
