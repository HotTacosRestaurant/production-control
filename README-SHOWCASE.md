# Showcase — Nixinex Business Transformation

## Purpose

`/showcase` is a read-only, client-neutral portfolio view. It does not reuse the operational navigation and it never exposes raw Firestore documents, employee names, product names, locations, document IDs, absolute production quantities, or labor-hour totals.

The public endpoint is:

- `GET /api/showcase`

It returns a deliberately small DTO containing four percentages and normalized trend indices only.

## Default mode: synthetic demo

The secure default is demo mode. No real Firestore data is published unless both environment variables are explicitly set:

```text
SHOWCASE_MODE=live
SHOWCASE_OWNER_APPROVED_REAL_DATA=true
```

If either variable is missing or different, `/showcase` displays synthetic data and clearly labels it as demonstration data.

## Vercel variables

Recommended production variables:

```text
SHOWCASE_MODE=demo
SHOWCASE_OWNER_APPROVED_REAL_DATA=false
SHOWCASE_REFRESH_SECONDS=300
NIXINEX_FRAME_ANCESTORS='self' https://YOUR-NIXINEX-DOMAIN.com https://www.YOUR-NIXINEX-DOMAIN.com
```

When written in the Vercel UI, the value of `NIXINEX_FRAME_ANCESTORS` should be the CSP source list itself. Do not add an extra pair of wrapping quotes around the entire value.

Example after the final Nixinex domain is known:

```text
'self' https://nixinex.com https://www.nixinex.com
```

For a Vercel preview of the Nixinex portal, add only the exact preview origin that you intentionally authorize. Avoid `*`.

## Real-data mode

Use real mode only after the owner of the information has explicitly approved publication of aggregated metrics:

```text
SHOWCASE_MODE=live
SHOWCASE_OWNER_APPROVED_REAL_DATA=true
```

The live builder uses the existing server-side KPI calculation, then applies a separate publication boundary:

- Inventory control coverage: percentage only.
- Production batch closure: percentage only.
- Data quality: percentage only.
- Operational control score: weighted percentage only.
- Trend periods are renamed `P-5` ... `P0`.
- Production and labor-efficiency trends are normalized to a base index of `100`.

No absolute kilograms, employee hours, calendar months, site names, product names, employee names, or source records are returned.

## Firestore rules

**No Firestore Rules change is required or recommended.**

Production Control continues to use Firebase Admin SDK on the Next.js server. The browser remains blocked from all `pc_*` collections by the existing Firestore rules. `/api/showcase` also reads on the server and only returns its approved aggregate DTO.

Do not open `pc_*` collections to public reads for the Showcase.

## iframe integration

Nixinex embeds:

```text
https://THIS-APP-DOMAIN/showcase
```

`next.config.ts` sends `Content-Security-Policy: frame-ancestors ...` only on the Showcase route. If `NIXINEX_FRAME_ANCESTORS` is not configured, framing is restricted to `'self'` by default.

The operational application does not gain any new iframe permission from this change.

## Admin access

The existing Management dashboard remains authenticated and separate from Showcase. `admin@nixinex.com` has been added to the existing server-side superadmin allow-list without removing the previously configured superadmin accounts.

## Management role authorization

Management Information now requires all three checks:

1. Firebase Authentication succeeds.
2. The email is in the server-side superadmin allow-list.
3. `portal_users/{uid}` exists with `active: true` and `role: "admin"`.

For `admin@nixinex.com`, create the Firebase Authentication account and its `portal_users` record before using Management. Because this validation is performed by Firebase Admin SDK on the server, it does not require opening any Firestore collection to the browser.
