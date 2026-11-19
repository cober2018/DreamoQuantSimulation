---
title: 客户端配置
lede: 在 Claude Desktop、Claude Code、Cursor、Cherry Studio、Cline / VS Code 里配置知数星耀的 MCP 服务。
group: mcp
order: 3
updated: 2026-11-18
status: ready
---

> **即将推出**：服务地址上线后公布，下面的 `%MCP_URL%` 到时替换成正式地址；`zsmcp_你的令牌` 换成你在账号页创建的令牌。

服务使用 MCP 的 Streamable HTTP 传输，用请求头 `Authorization: Bearer <令牌>` 鉴权。

## 选择客户端

<div data-tabs>
<section>

### Claude Desktop

配置文件位置：

- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows：`%APPDATA%\Claude\claude_desktop_config.json`

通过 `mcp-remote` 转接远程服务（需要本机装有 Node.js）：

```json
{
  "mcpServers": {
    "zhishu": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "%MCP_URL%", "--header", "Authorization:Bearer ${ZHISHU_TOKEN}"],
      "env": { "ZHISHU_TOKEN": "zsmcp_你的令牌" }
    }
  }
}
```

保存后完全退出并重新打开 Claude Desktop。

</section>
<section>

### Claude Code

在终端运行：

```bash
claude mcp add --transport http zhishu "%MCP_URL%" --header "Authorization: Bearer zsmcp_你的令牌"
```

运行 `claude mcp list` 确认已连接。

</section>
<section>

### Cursor

编辑 `~/.cursor/mcp.json`（全局）或项目里的 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "zhishu": {
      "url": "%MCP_URL%",
      "headers": { "Authorization": "Bearer zsmcp_你的令牌" }
    }
  }
}
```

</section>
<section>

### Cherry Studio

打开 **设置 → MCP 服务器 → 添加服务器**：

- **类型**：可流式传输的 HTTP（streamableHttp）
- **URL**：`%MCP_URL%`
- **请求头**：`Authorization=Bearer zsmcp_你的令牌`

</section>
<section>

### Cline / VS Code

**Cline**：在 Cline 面板打开 **MCP Servers → Configure**，编辑 `cline_mcp_settings.json`：

```json
{
  "mcpServers": {
    "zhishu": {
      "type": "streamableHttp",
      "url": "%MCP_URL%",
      "headers": { "Authorization": "Bearer zsmcp_你的令牌" }
    }
  }
}
```

**VS Code 自带的 MCP**：在项目里新建 `.vscode/mcp.json`：

```json
{
  "servers": {
    "zhishu": {
      "type": "http",
      "url": "%MCP_URL%",
      "headers": { "Authorization": "Bearer zsmcp_你的令牌" }
    }
  }
}
```

</section>
</div>

## 确认连接成功

在客户端里让模型调用 `list_datasets`。能列出数据集，就说明配置好了。连接失败时查 [错误码](/docs/mcp/errors/)。

各客户端的配置界面会随版本变化，以客户端当前版本的说明为准。
