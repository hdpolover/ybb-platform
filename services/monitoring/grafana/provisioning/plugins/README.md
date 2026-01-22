# Grafana Plugins

This folder is used to provision Grafana plugins via configuration or volume mounts if necessary.

Currently, we are relying on the bundled plugins or installing them via the `GF_INSTALL_PLUGINS` environment variable if needed.

If custom plugin provisioning logic is needed in the future, it goes here.
