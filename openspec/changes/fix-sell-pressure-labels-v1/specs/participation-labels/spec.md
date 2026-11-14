## ADDED Requirements

### Requirement: Sell-pressure fields labeled by upstream meaning
参与度页 SHALL 按上游定义标注 `sell_pressure_change_1d` 和 `sell_pressure_change_3d`：两者都是卖压缓和程度的变化值，正值表示卖压缓和；3 日一项 MUST 标为"3 日变化"，MUST NOT 标为"趋势"或"卖出占比"。

#### Scenario: Labels state direction
- **WHEN** 打开网页参与度页的"市场参与与卖压"模块
- **THEN** 两项分别显示"卖压缓和程度（1 日变化，正值为缓和）"和"卖压缓和程度（3 日变化，正值为缓和）"，页面不再出现"卖出占比 1 日变化""卖出占比 3 日趋势"
