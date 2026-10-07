# KPI access matrix — Production Control

## Public Showcase (`/showcase`)

Public by design. No login is required because the publication boundary contains only approved aggregate/normalized metrics.

Published fields:

- Inventory control coverage percentage.
- Production batch closure percentage.
- Data-quality percentage.
- Weighted operational-control score.
- Generic `P-n` trend periods.
- Normalized throughput index (base 100).
- Normalized labor-efficiency index (base 100).
- Control-coverage trend percentage.
- Static transformation-capability descriptions.

Not published:

- Absolute kilograms or bags.
- Absolute labor hours.
- Estimated consumption kilograms.
- Location/site names or comparisons.
- Employee-level KPIs.
- Product-level KPIs.
- Exception details.
- Late-entry counts, correction counts or signer mismatch details.
- Firestore IDs or source documents.

## Internal Management dashboard

Authentication + server-side role authorization is required.

Requirements:

1. Valid Firebase Authentication ID token.
2. Email must be in the server-side superadmin allow-list.
3. `portal_users/{uid}` must exist with:

```text
active = true
role = admin
```

The internal dashboard may display the richer management dataset because it is not part of the public publication boundary:

- Absolute output kg and bags.
- Absolute tracked labor hours.
- Estimated consumption kg.
- Location comparison.
- Employee ranking/workload information.
- Product production information.
- Operational exception details.
- Data-quality exception counts.
