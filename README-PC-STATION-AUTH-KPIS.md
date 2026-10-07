# Production Control — Station authorization + Management KPIs

## Security model

- Normal employees do **not** sign in.
- Each production device is authorized once with `PC_DEVICE_SETUP_KEY` and is paired to HTL, HTW or HTFT.
- The server stores a signed, HttpOnly cookie on the device. The browser never receives `FIREBASE_SERVICE_ACCOUNT_KEY` or `PC_DEVICE_SIGNING_KEY`.
- Operational API calls remain server-side through Firebase Admin SDK.
- The existing Firestore rules for `pc_*` must remain `allow read, write: if false`.
- Management KPIs require Firebase Authentication and one of these exact emails:
  - hottacosmanagement@hotmail.com
  - admin@nixinx.com
  - admin@hottacosrestaurant.com
- The server verifies the Firebase ID token before calculating or returning KPIs.

## New Vercel environment variables

Add to Production (and Preview if needed):

- `PC_DEVICE_SETUP_KEY` — strong secret entered only when pairing a new station.
- `PC_DEVICE_SIGNING_KEY` — strong random signing secret; do not expose as `NEXT_PUBLIC_*`.

Existing server variable still required:

- `FIREBASE_SERVICE_ACCOUNT_KEY`

Existing Firebase client variables are still used for superadmin login:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Generate strong values locally, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice: use one result for `PC_DEVICE_SETUP_KEY` and the other for `PC_DEVICE_SIGNING_KEY`.

## First production use

1. Deploy to Vercel with the environment variables above.
2. Open Production Control on the kitchen device.
3. Select the location.
4. Enter the station setup key once.
5. The device receives a signed HttpOnly authorization cookie for 180 days.
6. Employees use counts and production normally without user authentication.

Local `next dev` keeps the development bypass and does not require station pairing.

## Management KPIs

The Management button uses Firebase Email/Password authentication. Only the three hard-coded superadmin emails can open the dashboard. The restriction is enforced both in the client and again on the server endpoint.

KPIs currently include:

- complete opening/closing count pairs
- incomplete count-pair days
- late count entries
- signer mismatch count
- correction count
- active vs completed production batches
- produced bags and kg
- tracked labor hours
- running timers
- ingredient-entry volume
- estimated consumption (opening inventory + same-day completed production - closing inventory)
- comparison by location
- labor/activity by employee
- production by product
- monthly production history
- operational exception / traffic-light alerts

### Data Mart note

`estimatedConsumptionKg` is an operational estimate, not an accounting consumption measure. It is calculated only when both opening and closing counts exist for the same site/date/product. Preserve the formula as a semantic definition if it is later promoted into a Data Mart measure.

## Firestore Rules

**Do not modify the Firestore rules for this patch.** The application continues to use Firebase Admin SDK on the server. In particular, keep all `pc_*` collections blocked from direct client reads/writes.
