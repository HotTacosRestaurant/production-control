# Access matrix — Production Control (2026-10)

| Surface | Access | Data |
|---|---|---|
| Operational PWA (`/`, `/api/pc/snapshot` and operational POST actions) | Shared device PIN via `PC_OPERATIONS_PIN`, stored in `sessionStorage` for one browser tab session | Real catalog, operators, counts, batches, ingredient and movement records |
| Management `/api/pc/management`, `/api/pc/report`, `/api/pc/export` | Firebase ID token, email allow-list, `portal_users/{uid}` active/admin | Real KPIs, report details, forecasts and Excel source data |
| Public `/showcase`, `/api/showcase`, `/api/showcase-report` | No login | Functional, mathematically consistent demo numbers; never customers' Firestore records |

**Firestore Security Rules do not protect Admin SDK queries.** Next.js API auth checks are essential. `PC_OPERATIONS_PIN` is mandatory in production; without it the operational endpoints return 503 and do not open publicly. Apply WAF/rate limits for PIN guessing and use HTTPS; a shared PIN is not person-level authentication.

Important: this version does not issue purchase orders, approve simulated production batches or reconcile financial balances. Production plans are simulations pending operational authorization.
