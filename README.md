# node-jpc-notify

node-jpc-notify is a CLI tool used by the Support and Operations teams to create ZenDesk tickets for customers to inform them of incidents and maintenance.

Eventually this will also be a node_module used by some other forms of front-ends (API, web front-end).

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

The longer term goal is to have "some input" be an INC/CM JIRA ticket. This ticket would contain the relevant input fields (see above list for examples), the template to be used, and start/end times of the incident/maintenance. Once the JIRA ticket has been sufficiently filled out (as determined by the Incident Manager), it is at this point that `jpc-notify` can be invoked with the JIRA ticket ID and the notifications will go out to the customer. Exactly how this will happen (e.g. automatically via some JIRA trigger, manually via CLI giving JIRA ID) is yet to be determined.

## Usage

`jpc-notify` is the command you'll be working with, and it provides a number of interfaces to gather information and create ZenDesk tickets.

### Compute node reboot

`jpc-notify --template=incident-cn-reboot --start_time=YYYYMMDDTHHMMSS --end_time=YYYYMMDDTHHMMSS --server=RA38274`

### Upcoming compute node reboot

#### Singular

`jpc-notify --template=maintenance-cn-reboot --start_time=YYYYMMDDTHHMMSS --end_time=YYYYMMDDTHHMMSS --server=RA38274`

#### Many

`jpc-notify --template=maintenance-cn-reboot --schedule=/path/to/schedule.csv`

Where `/path/to/schedule.csv` would be a csv containing:

```
RA3415342,20160201100000,20160201110000
```

## Questions

### 'Duration' or 'end time'?

I believe something like the following sounds nicer:

> Compute node rebooted at 2015-02-01 10:00 UTC. Back only after 15 minutes.

than:

> Compute node rebooted at 2015-02-01 10:00 UTC. Back online at 2015-02-01 11:00 UTC.

However, it is not precise, and if the duration is particularly long then it sounds more detrimental initially.

Should this vary depending on template? For example, a compute node reboot incident might be better off having an exact end time, but an upcoming compute node reboot might be better having a duration.
