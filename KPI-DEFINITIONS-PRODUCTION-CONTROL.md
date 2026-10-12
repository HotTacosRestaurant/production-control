# KPI definitions v2 — Production Control

| KPI | Formula / rule | Source |
|---|---|---|
| Inventory kg | Full bags × bag weight snapshot + kg in the opened bag | `pc_counts.lines[]` |
| Finished production kg | Full bags × bag weight snapshot + partial finished kg | `pc_batches` |
| Equivalent finished bags | Finished kg ÷ bag weight snapshot | `pc_batches` |
| Normal daily consumption kg | Opening kg + production kg − closing kg − exceptional outgoing movements kg | `pc_counts`, `pc_batches`, `pc_movements` |
| Valid daily consumption observation | Paired opening/closing counts for same location, date and product, producing a nonnegative result | Daily derived report |
| Baseline daily demand | Mean of VALID days in independently selected baseline range, after exclusion ranges | Scenario; invalid days omitted |
| Future planned demand | Baseline mean × (1 + sum event percentages/100) + additional daily event kg | Scenario |
| Minimum kg | Baseline mean × minimum coverage days | `pc_products` / Scenario |
| Target kg | Baseline mean × target coverage days | `pc_products` / Scenario |
| Planned lot | Needed to restore target, rounded UP by whole raw-material unit × expected yield if configured | Scenario |
| Production start date | Planned production availability date − configured production lead days | Scenario |
| Purchase-by date | Production start date − configured supplier lead days | Scenario |
| Labor productivity | kg finished ÷ recorded labor hours, when both present | `pc_batches`, `pc_activities` |
| Real yield | kg finished ÷ kg of primary raw ingredient consumed × 100; convert g/lb to kg, never treat unit/liter as kg | `pc_batches`, `pc_inputs`, `pc_products.primaryIngredientId` |
| Expected yield | Product's catalog target yield percentage | `pc_products` |
| Ingredients estimated for planned lot | Mean historical ingredient amount per kg output × planned finished kg, **same unit only** | `pc_inputs`; not a validated recipe |

Limitations: Operations on absent dates are not zero consumption. A movement requires explicit entry to be excluded. An incoming Food Truck receipt is not yet mirrored as a verified inter-site transfer. Measurement error in opened bags is possible; users can correct audited counts. No automatically approved purchase or finance operation is created by a forecast. Exports v1 are incremental within the selected operational-date window, with explicit update watermark; consumers must upsert IDs and retain scheme versions. Hard deletion/tombstones are not yet modeled.
