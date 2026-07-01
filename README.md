<div align="center">

![logo](/web/default/public/logo.png)

# Oneroute

**AI API 网关 / 多供应商聚合代理**

基于开源项目 [New API](https://github.com/QuantumNous/new-api)（AGPL-3.0）二次开发的独立部署版本

</div>

---

## 这是什么

Oneroute 是一个自建的 AI API 网关：把 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等 40+ 家上游模型供应商统一封装成一套 OpenAI 兼容接口，对内提供用户管理、计费、限流、渠道调度和管理后台。

代码在开源项目 **New API** 的基础上做了较多本地化二次开发，主要新增了团队协作、支付网关、站内文档中心等能力，详见下文「相对上游的定制」。

## 核心特性

**继承自 New API：**
- 聚合 40+ AI 供应商，统一 OpenAI 兼容 API
- 多渠道负载均衡、失败重试、按量/按次计费
- 用户体系、额度管理、令牌（API Key）管理
- SQLite / MySQL / PostgreSQL 三数据库兼容
- 多语言前端界面

**本项目定制：**
- **团队管理**（`/team`）— 邀请制、跨组织的分布式团队协作，团队长管理成员、查看用量
- **企业团队**（`/teamv3`）— 邀请码制、同组织共享额度，owner/admin/member 角色体系，用量统计
- **企业团队后台**（`/admin-teamv3`）— 超管全局视图，跨团队查看/解散/转让所有权
- **文档中心**（`/docs`）— 站内接入指南，覆盖 Claude Code CLI、Claude Desktop、Codex CLI、Gemini CLI、OpenCode、CodeBuddy、Hermes Agent 等 7 种客户端的接入文档，中/英/法/日/俄/越 6 语言
- **Antom（支付宝海外版）充值网关**，及每个支付方式的独立启用/禁用开关
- 落地页 / 首页改版
- 6 语言 i18n 全量翻译（en / zh / fr / ja / ru / vi）

## 技术栈

- **后端**：Go 1.25+、Gin、GORM v2
- **前端**：React 19、TypeScript、TanStack Router、Rsbuild、Tailwind CSS（`web/default`）
- **数据库**：SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6
- **缓存**：Redis（可选）+ 内存缓存
- **包管理**：前端使用 `bun`（不用 npm/yarn/pnpm）

## 快速开始

### 环境准备

```bash
cp .env.example .env
# 按需编辑 .env：PORT、SQL_DSN（留空则使用内置 SQLite）、REDIS_CONN_STRING、SESSION_SECRET 等
```

### 本地开发（前后端分离，热重载）

```bash
# 后端（默认 3001，由前端 dev server 代理）
go run .

# 前端
cd web/default
bun install
bun run dev
```

Windows 下可直接运行根目录的 `dev.bat` 一键拉起前后端。

### 生产构建（前端产物内嵌进单一二进制）

```bash
cd web/default && bun install && bun run build
cd ../..
go build -o new-api.exe .
./new-api.exe
```

### Docker

```bash
docker compose up -d
```

## 项目结构

```
router/      HTTP 路由
controller/  请求处理
service/     业务逻辑
model/       数据模型（GORM）
relay/       AI 供应商中继与适配器
middleware/  鉴权、限流、CORS
setting/     配置管理
common/      公共工具（JSON、加密、Redis 等）
web/default/ 前端（React 19 + TanStack Router）
```

## 开源协议

本项目基于 [New API](https://github.com/QuantumNous/new-api) 二次开发，遵循其原始协议 **AGPL-3.0**，详见 [LICENSE](./LICENSE)。感谢 New API 及其上游 [one-api](https://github.com/songquanpeng/one-api) 项目的所有贡献者。
