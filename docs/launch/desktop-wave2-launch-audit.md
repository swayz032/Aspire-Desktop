# Desktop Wave 2 Launch Audit

Date: 2026-03-13
Scope: Launch-critical desktop surfaces only.

## Route Classification

- `/(tabs)/index` -> `live`
- `/(tabs)/inbox` -> `live`
- `/(tabs)/mic` -> `live`
- `/(tabs)/receipts` -> `live`
- `/(tabs)/more` -> `live`
- `/finance-hub` -> `partially live` (depends on connected provider data)
- `/finance-hub/payroll` -> `live` with fail-closed behavior when provider data is unavailable

## Changes Applied In This Wave

- Removed synthetic fallback dataset usage from `finance-hub` charts and KPI sparks.
- Replaced disconnected finance labeling from `Demo` to `Disconnected`.
- Removed fallback display of non-finance authority queue items in `finance-hub`.
- Payroll create flow now disables action when provider is not connected or no provider employees are available.
- Payroll paystub modal no longer presents demo/calculated values when live provider paystub data is absent.

## Launch Gate Notes

- `finance-hub` now avoids fabricated visual data and degrades to explicit no-live-data states.
- `finance-hub/payroll` now fails closed for paystub details and print/download actions without live provider data.
- Non-launch/demo utility routes remain outside this Wave 2 scope.
