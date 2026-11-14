# Third-Party Icons, Catalog Packs, and Trademark Attributions

## 1. Built-in Icon Set (Material Symbols)

FlowTrace uses **Google Material Symbols** (`material-symbols-outlined`) for generic architecture and business block icons (`lib:*` identifiers).

- **Source**: [Google Material Design Icons](https://github.com/google/material-design-icons)
- **License**: Apache License 2.0

## 2. Cloud and Technology Block Packs (`aws`, `gcp`, `tech`)

Per architectural decision `DEC-17` (`docs/adr/0010-advanced-diagram-editor.md`):

- All built-in Cloud and Technology block packs (`catalog/aws.json`, `catalog/gcp.json`, `catalog/tech.json`) ship by default with **neutral, vendor-agnostic icons** (`lib:dns`, `lib:bolt`, `lib:storage`, `lib:database`, `lib:layers`, `lib:router`, `lib:public`, `lib:hub`) and neutral category labels (`Compute Instance`, `Serverless Function`, `Object Storage`, `Managed Relational DB`, `Managed Queue`), paired with an editable `vendorLabel` property.
- Official vendor architecture icons are only loaded when explicitly enabled after trademark usage verification (`H-18`).

## 3. Non-Affiliation Notice

FlowTrace is an independent observability and request-flow visualization platform and is **not affiliated with, endorsed by, or sponsored by** Amazon Web Services (AWS), Google Cloud, Stripe, Kubernetes, Apache Kafka, Redis, PostgreSQL, or any other third-party vendor referenced in user-configured labels. All product names, logos, and brands are property of their respective owners.
