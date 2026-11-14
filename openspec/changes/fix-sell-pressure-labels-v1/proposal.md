## Why

参与度页把 `sell_pressure_change_1d`、`sell_pressure_change_3d` 标成"卖出占比 1 日变化""卖出占比 3 日趋势"。投研平台核实（2026-11-15）：这两个字段来自上游 `sell_release_1d/3d`，**正值表示卖压缓和**，3d 是 3 天的变化值，不是趋势。现在的标注会让用户把正值读成"卖出增加"，意思正好反了。

## What Changes

- `web/src/pages/Participation.vue` 第 14 行："卖出占比 1 日变化" → "卖压缓和程度（1 日变化，正值为缓和）"
- 第 15 行："卖出占比 3 日趋势" → "卖压缓和程度（3 日变化，正值为缓和）"
- 页面上没有这两项的 tooltip、说明或图例，不需要另改。小程序不显示这两项，不改。
- 数值、字段、接口都不变。

措辞由用户确认（2026-11-15）。

## Capabilities

### New Capabilities
- `participation-labels`：参与度页卖压字段的标注含义

## Impact

- 只改 `web/src/pages/Participation.vue` 两处文字。
