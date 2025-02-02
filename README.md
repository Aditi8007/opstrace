<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD033 -->

![Build status](https://badge.buildkite.com/df9e995b3a5e4b0bebce8b432b0bf48b092fd261b7017b65c1.svg)
[![License](https://img.shields.io/github/license/opstrace/opstrace)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v2.0%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md)

<img src="https://user-images.githubusercontent.com/19239758/97793010-00161b00-1ba3-11eb-949b-e62eae6fdb9c.png" width="350">

# The Open Source Observability Distribution

Opstrace is a secure, horizontally-scalable, open source observability platform installed in your cloud account.

Highlights:

* Horizontally **scalable**.
* Inexpensive **long-term** retention of observability data.
* Rigoriously **tested** end-to-end.
* Easy and reliable **upgrades**.
* **Secure** by default with [TLS](https://letsencrypt.org) and authenticated endpoints.
* **Easy to configure** with GUIs and APIs.

We walk on the shoulders of giants; Opstrace uses open source projects you know and love:

* [Cortex](https://github.com/cortexproject/cortex)
* [Loki](https://github.com/grafana/loki)
* [Grafana](https://github.com/grafana/grafana)
* [Hasura](https://github.com/hasura/graphql-engine)
* [Kubernetes](https://github.com/kubernetes/kubernetes)
* [Prometheus](https://github.com/prometheus/prometheus)
* [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
* and many more

## Key Features

### Installation and Upgrades

Both installation and upgrades are initiated by a simple CLI command.
In this example, you can see an abbreviated installation and upgrade cycle:

```bash
$ cat << EOF > config.yaml
 tenants:
  - staging
  - prod
EOF
```

```text
$ ./opstrace create aws tracy -c config.yaml
...
info: create operation finished: tracy (aws)
info: Log in here: https://tracy.opstrace.io
```

A week later...

```text
$ curl -L https://go.opstrace.com/cli-latest-release-macos | tar xjf -
$ ./opstrace upgrade aws tracy -c config.yaml
...
info: upgrade operation finished for tracy (aws)
```

### Alert Management

Alertmanager can be difficult to configure, especially [for Cortex](https://cortexmetrics.io/docs/architecture/#alertmanager) when multiple tenants are used.
Opstrace configures a horizontally scalable Ruler and Alertmanager out of the box to support reliable alerts.
It also deploys a Grafana instance for each tenant, which can be now used to manage Cortex/Loki alerts thanks now to [Grafana 8's Unified Alerting](https://grafana.com/blog/2021/06/14/the-new-unified-alerting-system-for-grafana-everything-you-need-to-know/) feature.
Before, you'd have to manage each of these components independently, keeping them in sync manually.

![opstrace ui alert overview](docs/assets/alerts-overview.jpg)

### Tenant Management

The Opstrace UI allows for dynamic [tenant creation and deletion](docs/guides/administrator/managing-tenants.md):

![tenants can be managed holistically](https://p95.p4.n0.cdn.getcloudapp.com/items/4gunxZZe/0d056830-92be-4417-aa90-21c8fa261f48.jpg?source=viewer&v=3ce7d21798ba7cf02869e35dfcfa70c6)

[Tenants](docs/references/concepts.md#tenants) provide isolation for logically separate entities.
For example, they can be used to represent different teams.
The Opstrace UI also allows for setting per-tenant configuration, which can be used for example to set write/read rate limits on a per-tenant basis.


## Quick Start

Install Opstrace in your own cloud account with our [quick start](https://go.opstrace.com/quickstart).
The Opstrace CLI uses your local credentials to setup the necessary cloud resources (e.g., a EKS or GKE cluster) and then deploys the Opstrace controller which orchestrates all of the app-level deployments.
For example:

```bash
opstrace create aws <choose_a_name> <<EOF
tenants:
  - dev
  - staging
  - prod
env_label: try_opstrace
cert_issuer: letsencrypt-prod
EOF
```

In addition to AWS we also support GCP.

See our configuration reference for details: [docs/references/configuration.md](docs/references/configuration.md).

Don't forget to clean up if you're done kicking the tires:

```bash
opstrace destroy aws <choose_a_name>
```

Note: add the `--region` flag to ensure the CLI can locate any dangling resources, should you run into any sort of trouble cleaning up on AWS (for example, after a failed install).

## Community

Authentic collaboration in a community setting is important to us.
Please join us to learn more, get support, or contribute to the project.

* Join our [Slack Community](https://go.opstrace.com/community)
* Ask a question in our [GitHub Discussions](https://github.com/opstrace/opstrace/discussions)
* Contribute a [proposal](https://github.com/opstrace/opstrace/issues/new?assignees=&labels=thinktank:%20proposal&template=2-proposal.md&title=) or a [bug report](https://github.com/opstrace/opstrace/issues/new?assignees=&labels=type:%20bug&template=1-bug_report.md&title=)
* Or just send us an email at [hello@opstrace.com](mailto:hello@opstrace.com)

You can find out more on [our community page](https://opstrace.com/community), including shoutouts to some of the main open source projects that we're building with.

## Documentation

You can find the Opstrace documentation in [/docs](./docs).
We invite you to improve these docs together with us, and have a [corresponding guide](./docs/guides/contributor/writing-docs.md) for that.

## Contributing

We :heart: working on open source projects, and we hope you do too.
Please join us and make some contributions, however big or small.

* Start by reading the [Contributing guide](./CONTRIBUTING.md) to become familiar with the process.
* Then review our [Development guide](./docs/guides/contributor/setting-up-your-dev-env.md) to learn how to set up your environment and build the code.
* If you'd like to find a place to start and get your feet wet, just reach out and ask in [our community Slack](https://go.opstrace.com/community). (It's also a good idea to try out our [quick start](https://go.opstrace.com/quickstat).)

Take a look at our [high-level roadmap](./docs/references/roadmap.md) to see where we're heading, and feel free to [get in touch](https://go.opstrace.com/community) with us regarding questions and suggestions.

IMPORTANT NOTE: We welcome contributions from developers of all backgrounds.
We encode that in a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).
By participating in this project, you agree to abide by its terms.

# Privacy

At Opstrace, we host a service that automatically provisions subdomains like `<my_name>.opstrace.io`.
This makes it easy and clean to use the URLs for both humans and machines.
To accomplish this safely, we require login via Auth0 subject to our [privacy poicy](https://go.opstrace.com/privacy-policy).

Get in touch with us to discuss support for custom domains!

## Security Reports

We take security seriously.
If you believe you have found a security issue in our project or any related projects, please email us at [security@opstrace.com](mailto:security@opstrace.com) to responsibly disclose the issue.
