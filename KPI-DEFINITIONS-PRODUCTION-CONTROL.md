# KPI Definitions — Production Control

These definitions are the initial semantic layer for the future Data Mart.

| KPI | Definition | Source |
|---|---|---|
| Count pair completion % | Complete site/date pairs with both opening and closing / site/date pairs where at least one count exists | `pc_counts` |
| Single-count days | Site/date pairs where only opening or only closing exists | `pc_counts` |
| Late entries | Counts where `isLateEntry == true` | `pc_counts` |
| Signer mismatches | Counts where starter and signer differ | `pc_counts` |
| Count corrections | Sum of `correctionCount` | `pc_counts` |
| Active batches | Batches with `status == active` | `pc_batches` |
| Completed batches | Batches with `status == completed` | `pc_batches` |
| Bags produced | Sum of `bagCount` for completed batches | `pc_batches` |
| Output kg | Sum of `outputKg` for completed batches | `pc_batches` |
| Tracked labor hours | Sum of elapsed activity intervals | `pc_activities` |
| Running timers | Activities with `running == true` | `pc_activities` |
| Ingredient entries | Count of ingredient input records | `pc_inputs` |
| Estimated consumption kg | Opening kg + completed production kg on same site/date/product - closing kg; floored at zero; only when both counts exist | `pc_counts` + `pc_batches` |

## Interpretation cautions

- Employee hours measure recorded production activity, not total paid labor hours.
- Ingredient-entry count measures data-capture activity, not quantity consumed.
- Count pair completion cannot identify a completely missing business day unless an operating calendar is later added to the Data Mart.
- Estimated consumption assumes production for that operational date should be included between opening and closing inventory and excludes transfers, waste, purchases, or other unmodeled movements.
