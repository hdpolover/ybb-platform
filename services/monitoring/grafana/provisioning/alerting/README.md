# Alerting Provisioning

This folder is reserved for provisioning Grafana Alerting resources as code.

## Upcoming Implementation (Phase 3)
As part of the Observability Roadmap Phase 3, this folder will contain YAML configuration files for:

- **Contact Points**: Definitions for Slack, Email, PagerDuty, etc.
- **Notification Policies**: Routing rules for alerts.
- **Alert Rules**: Prometheus and Grafana managed alert definitions.

## Structure
- `contact-points.yaml`
- `notification-policies.yaml`
- `rules.yaml`

See [Grafana Alerting Provisioning Docs](https://grafana.com/docs/grafana/latest/administration/provisioning/#alerting) for more details.
