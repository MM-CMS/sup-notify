# sebastian

![sebastian.gif](./tools/sebastian.gif)

In Disney's The Little Mermaid, Sebastian is Triton's servant. Sebastian is tasked with notifying Triton of any changes in Ariel (going to the surface, exchanging her voice for a potion with Ursula that turns her human, etc).

In Joyent's Triton Cloud, Sebastian is the Support Team's servant. `sebastian` is tasked with notifying customers of any changes in the Triton Cloud (maintenance, incidents, etc).

`sebastian` talks to each of the datacenters in the Triton Cloud in order to gather information, massages this information, then creates tickets for our customer via ZenDesk. Eventually this will also be a node_module used by some other forms of front-ends (API, web front-end).

The immediate goal is to turn some input into a list of affected containers, and with this list create a notification from a template. Examples of "some input":

- Server UUID or hostname
- Container UUID
- Customer email address

The longer term goal is to have "some input" be an INC/CM JIRA ticket. This ticket would contain the relevant input fields (see above list for examples), the template to be used, and start/end times of the incident/maintenance. Once the JIRA ticket has been sufficiently filled out (as determined by the Incident Manager), it is at this point that `sebastian` can be invoked with the JIRA ticket ID and the notifications will go out to the customer. Exactly how this will happen (e.g. automatically via some JIRA trigger, manually via CLI giving JIRA ID) is yet to be determined.

## Documentation

See [usage.md](./docs/usage.md) on how to use the tool, and [templates.md](./docs/templates.md) on how to create templates.
