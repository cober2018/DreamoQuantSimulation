---
title: MCP 接入概览
lede: 通过 MCP，你自己的大模型可以直接读取知数星耀的数据。服务即将推出，地址上线后公布。
group: mcp
order: 1
updated: 2026-11-18
status: stub
---

> **即将推出**：MCP 服务还在内部测试，服务地址是 `%MCP_URL%`。

MCP（Model Context Protocol）让 Claude、Cursor 等客户端里的大模型调用外部工具。接入后，你的模型能按交易日读取知数星耀的数据，再按你的要求整理。

- **只读**：所有工具只返回数据和统计，不含分析结论或建议。
- **同口径**：返回的数据和网页同页同口径、按同一等级裁剪。每次返回都带数据日期和来源说明。
- **只对会员开放**：各档额度见 [限额](/docs/mcp/limits/)。

接入步骤：[申请令牌](/docs/mcp/token/) → [客户端配置](/docs/mcp/clients/) → [工具列表](/docs/mcp/tools/)。
