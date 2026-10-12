# Production Control · Showcase contract v2 (2026-10)

The public `/showcase`, `/api/showcase`, and `/api/showcase-report` display **functional demonstration data**. They DO NOT query private `pc_*` collections and do not expose names, identifiable dates, physical customer locations, employee IDs or actual customer transactions. Metrics are internally consistent with the simulated forecast.

The showcase demonstrates actual capabilities, with illustrative numbers:
- Count integrity and production performance KPIs.
- Kilograms produced, equivalent bags, tracked labor hours and estimated consumption.
- Yield vs expected yield and labor productivity when the example has matching inputs.
- Historical opening/closing inventory, future forecast, min/target reference levels.
- Whole raw-material units, production dates, labor, and ingredient requirements.
- Editable scenario controls (dates, baseline, exclusions, events, procurement delays).

NEVER switch public endpoints to `buildManagementData()` or live records without an explicit reviewed customer publication process. Real, anonymized data are not inherently safe merely because a name has been removed; verify re-identification risk case by case. This policy permits full, useful, NUMERIC demos without publishing customers' internal records.

Admin-only exports, actual inventory, staff, original batch IDs, operational details and real datasets must remain behind `/api/pc/report`, `/api/pc/export`, and `/api/pc/management` with Firebase ID token and `portal_users` admin role.
