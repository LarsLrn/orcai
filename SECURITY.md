# Security Policy

## Supported Versions

OrcAI is under active development and has not reached a stable release. Security fixes are applied to the latest commit on `main`; older commits and deployments are not supported.

## Reporting a Vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Report them through [GitHub private vulnerability reporting](https://github.com/LarsLrn/orcai/security/advisories/new). If private reporting is not available, email [sokratest@hochschule-rhein-waal.de](mailto:sokratest@hochschule-rhein-waal.de) with a brief request for a secure reporting channel before sending sensitive details.

Include the affected component, reproduction steps, impact, and any suggested mitigation. Avoid including real credentials or personal data. You should receive an acknowledgement within seven days.

## Deployment Responsibility

The default Compose values and local overrides are intended for development only. Before exposing OrcAI to a network, replace every placeholder secret, enable transport security for external services, configure SMTP, restrict infrastructure ports, and establish backups and monitoring.
