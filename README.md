# sup-notify

In Joyent's Triton Cloud, `sup-notify` is tasked with notifying customers of any changes in the Triton Cloud (maintenance, incidents, etc).

`sup-notify` talks to each of the datacenters in the Triton Cloud in order to gather information, massages this information, then creates tickets for our customer via ZenDesk. Eventually this will also be a node_module used by some other forms of front-ends (API, web front-end).

The immediate goal is to turn some input into a list of affected containers, and with this list create a notification from a template. Examples of "some input":

- Server UUID or hostname
- Container UUID
- Customer email address

The longer term goal is to have "some input" be an INC/CM JIRA ticket. This ticket would contain the relevant input fields (see above list for examples), the template to be used, and start/end times of the incident/maintenance. Once the JIRA ticket has been sufficiently filled out (as determined by the Incident Manager), it is at this point that `sup-notify` can be invoked with the JIRA ticket ID and the notifications will go out to the customer. Exactly how this will happen (e.g. automatically via some JIRA trigger, manually via CLI giving JIRA ID) is yet to be determined.

## Documentation

See [usage.md](./docs/usage.md) on how to use the tool, and [templates.md](./docs/templates.md) on how to create templates.

## History

sup-notify was originally named "[sebastian](https://github.com/joyent/node-sebastian/blob/e9c6bf112568659f856f6ab7c6e6c138b1f6cba9/README.md)".
