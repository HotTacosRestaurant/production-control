# Public Showcase Data Contract

Schema version: `1`

The public endpoint may return only:

```text
schemaVersion
generatedAt
mode
refreshSeconds
metrics.inventoryControlCoveragePct
metrics.batchClosurePct
metrics.dataQualityPct
metrics.operationalControlScorePct
trend[].period
trend[].throughputIndex
trend[].laborEfficiencyIndex
trend[].controlCoveragePct
```

It must not return:

```text
client/company names
location/site names
employee names or IDs
product names or IDs
Firestore document IDs
raw counts
raw batches
raw activities
raw inputs
absolute production quantities
absolute labor-hour totals
actual calendar month labels
email addresses
phone numbers
```

This contract is the publication boundary for future Nixinex portfolio integrations. Internal Management KPIs may remain richer because they are protected by Firebase Authentication and server-side superadmin authorization.
