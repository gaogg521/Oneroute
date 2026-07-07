# CONTEXT.md — 当前工作进度（滚动更新）

> **新会话最高优先级**：断网/切客户端/换模型后，**第一件事先完整读此文件**，再读 CLAUDE.md，即可 100% 恢复上下文，无需用户重新讲述。
>
> - `CLAUDE.md` = **永久项目规范**（架构、规则、约束），不写进度。
> - `CONTEXT.md`（本文件）= **滚动工作进度日志**（进展、待办、决策、坑）。

---

## 关键环境（快速回忆）

| 项目 | 值 |
|------|----|
| 后端端口 | 3000（`.env` 中 `PORT=3000`，生产单二进制模式） |
| 工作目录 | `D:\AI_Agent\new-api` |
| 前端构建 | `cd web\default && bun run build` → 产物内嵌到二进制 |
| 后端编译 | `go build -o new-api.exe .` |
| 重启命令 | `Get-Process new-api -EA SilentlyContinue \| Stop-Process -Force; Start-Sleep 1; Start-Process -FilePath "D:\AI_Agent\new-api\new-api.exe" -WorkingDirectory "D:\AI_Agent\new-api" -WindowStyle Hidden` |
| 数据库 | MySQL（`SQL_DSN=root:root@tcp(127.0.0.1:3306)/root`） |
| 测试账号 | zhaogao（超管）；oneone（普通用户，qwer1@34）；zhaogao1（次要测试） |

---

## 模块命名约定（强制，不得混淆）

| 路由 | 名称 | 说明 |
|------|------|------|
| `/team` | **团队管理** | 邀请制，跨组织分布式团队，团队长管理成员；超管登录时自动切换为全局视图（含对账、踢出） |
| `/teamv3` | **企业团队** | 邀请码制，同组织，共享额度，角色权限 |
| `/admin-teamv3` | **企业团队管理** | 超管后台，查看/解散全系统企业团队，展开成员 |

**注意**：`/admin-team` 独立路由不存在，「团队管理管理 v2」超管视图嵌入在 `/team` 路由内（超管登录自动触发）。  
**禁止**称 `/team` 为"旧的"或"old"，两个模块并列存在，不冲突。

---

## 已完成功能（按时间倒序）

| 日期 | 模块 | 内容 |
|------|------|------|
| 2026-07-07 | 模型别名管理器 | 新增管理员页 `/model-aliases`（侧边栏「模型别名」，Combine 图标）：解决「同一真实模型在不同渠道命名不一」的统一调用问题。**派生式无新表**：打开时读 `GET /api/channel/model_mapping/overview`（新端点，精简视图不含 key），前端 `lib/alias-grouping.ts` 按名称相似度自动聚类（`normalizeModelName` 保守剥日期/版本/数字尾巴，**不剥** -mini/-nano 规格词；`buildAliasGroups`/`buildUpdatesFromGroups`）。用户在卡片里核对：改统一别名、勾选渠道、逐渠道下拉选真实上游名，「应用」/「全部应用」调 `POST /api/channel/batch/model_mapping`（新端点）→ model 层 `BatchUpdateChannelModelMapping` 仿 EditChannelByTag（map 补丁 + UpdateAbilities + InitChannelCache 一次）。**两个产品决策**：①追加保留原名（别名加入 Models，原名仍可调用）②系统自动分组建议（可手动增删/改名兜底）。改动文件：后端 `controller/channel.go`(+2 handler)、`model/channel.go`(+BatchUpdateChannelModelMapping)、`router/channel-router.go`(+2 route, ChannelRead/ChannelWrite)；前端新 `features/model-aliases/`（api/types/lib/index/components）+ `routes/_authenticated/model-aliases/index.tsx` + `use-sidebar-data.ts` + en/zh i18n(17 key)。校验：go build+vet 过、bun 单测 8/8 过、typecheck+build 过、路由 wiring 401(非404)确认、SPA `/model-aliases` 200。**待做**：管理员登录浏览器冒烟（缺 zhaogao 口令，未做交互验证，本地二进制已用新前端重建并跑在 :3000）；fr/ja/ru/vi 17 key 暂英文兜底。 |
| 2026-06-26 | 文档中心 | **集成指南扩充至 7 个工具**：在 Claude Code CLI 基础上新增 6 篇（Claude Desktop、Codex CLI、Gemini CLI、OpenCode、CodeBuddy/WorkBuddy、Hermes Agent），仿 EvoLink 同名页并本站化（品牌→systemName、域名→origin、Key→/keys、模型清单→/pricing）。新文件 `features/docs/pages/{claude-desktop,codex-cli,gemini-cli,opencode,codebuddy,hermes}.tsx` + 同名路由 + nav/barrel；`doc-section` 补回 `DocOl`。**6 语全译**：按官方 i18n-translate skill 流程，96 个新 key 补 en(=key)+zh+fr+ja+ru+vi（每语 ~91），残留未译均为产品名(Codex CLI/OpenCode/Hermes Agent…)/法语同源词(FAQ/Configuration)/UI 字段名(Gateway base URL)。base 仍 en、0 污染、tsc 过、build 过。实测 Codex/Claude Desktop 页日文渲染正常、动态 URL 正确、侧栏列出全部 7 个指南。**未移植**：OpenClaw 系列 4 页（聊天机器人网关，偏小众，用户未要）。 |
| 2026-06-26 | 文档中心 | ①**新增「使用 API / 快速接入」页**（`/docs/quick-start`，归入「开始使用」组）：操练场测试、获取 Base URL（动态 origin）+令牌（链 `/keys`）、Python/Claude/Gemini 代码示例、支持端点总表（chat/completions、embeddings、images、audio、rerank、responses、realtime、models 等）。仿 newapi.pro「使用 API」页并本站化。新文件 `features/docs/pages/use-api.tsx`+`routes/docs/quick-start.tsx`，nav/barrel 已接。②**文档页补齐 fr/ja/ru/vi**：按官方 `.agents/skills/i18n-translate` 流程翻译全部 219 个 docs key（含新页 35 个先补 en+zh）。残留少量未译均为合法情形（专有名词 Claude Code CLI、API 端点名 Chat Completions/Responses API/Embeddings、法语同源词 Documentation/Type/Introduction）。base 仍 en、0 污染、tsc 过、`bun run build` 过。**结论**：`/docs` 四页（介绍/使用API/CLI/Nanobanana）中英法日俄越全可用。翻译默认走该 skill（见 memory [[i18n-sync-workflow]]）。 |
| 2026-06-26 | i18n 修复+多语言 | ①**修复 sync 污染回归**：之前跑 `i18n:sync` 时 zh.json 因新增 key 变成最富 locale→被选为 base→把 152 个「英文 key、但 en 缺失」的条目用**中文值**回填进了 en.json（昨天首页 + 团队功能文案），导致英文模式显示中文。已把 en/fr/ru/ja/vi 这 152 条 Latin-key+中文值的条目恢复为英文（ja 用「从 en 推导 key 集」避免误伤真日文汉字）；现 en.json 0 污染、sync base 回到 en。②**首页补齐 fr/ja/ru/vi**：用官方 `.agents/skills/i18n-translate` 流程，对首页 169 个公共 key 翻译四语（~107/语），剩余少量为合法同源词/缩写（法语 Production/Console/Multimodal/FAQ、日语 LLM API 等保持原样）。已 `bun run build`。**结论**：首页中/英/法/日/俄/越全可用，0 中文串漏。详见 memory [[i18n-sync-workflow]]。**待办**：文档页(features/docs ~167 key)的 fr/ja/ru/vi 仍是英文兜底，用户若需可同法补齐。 |
| 2026-06-26 | 文档中心 | 新增站内文档中心 `/docs`（Mintlify 风：左侧分组侧边栏 + 正文 + 复制代码块），移植 EvoLink 三篇文档并本地化：①平台介绍 ②Claude Code CLI 接入指南（含 14 条 FAQ）③Nanobanana 2 图像生成 API。新增 `web/.../features/docs/`（types/lib(use-docs-endpoints,use-docs-nav)/components(docs-layout,docs-sidebar,doc-section,doc-code-block,doc-callout,param-table)/pages×3）+ 路由 `routes/docs/{route,index,integration/claude-code-cli,api/nanobanana-2}`。**自适配**：品牌名走 `systemName`、接口域名走 `window.location.origin`、API Key 链接→`/keys`、模型清单→`/pricing`。**中英双语 i18n**：180 个 key，英文基准（en.json）+ 中文（zh.json）均补全，`i18n:sync` 已跑（base 现为 zh.json）。**坑**：`sync-i18n.mjs` 不扫描代码、会把仅存在于非 base locale 的 key 移入 `_extras`，故新 key 必须**同时**写入 en.json 与 zh.json；i18next 虽 `keySeparator='.'` 但含句点的扁平自然语言 key 仍能命中（已验证）。导航：后端 `general_setting.go` 默认 `DocsLink` 由 `https://docs.newapi.pro` 改为 `""`，使顶栏/页脚/落地页(hero/why-us) Docs 入口默认指向内部 `/docs`（`docs_link` 非空时仍走外链覆盖）。**注意**：已有部署若 DB 持久化了 `general_setting.docs_link=https://docs.newapi.pro`，需在「系统设置→运营/通用」把文档链接清空才会切到内部 /docs；前端已 `bun run build`、后端 setting 包 `go build` 通过 |
| 2026-06-25 | 支付网关 | 新增 Antom(支付宝海外版)直连充值网关,内部 key `antom`、显示名「Alipay」。后端:`setting/payment_antom.go`(8 配置项)、`controller/antom_sign.go`(RSA2 签名/验签,标准库)、`controller/topup_antom.go`(RequestAntomPay 下单+AntomNotify 回调验签)、`model.RechargeAntom`(仿 RechargeCreem)、option 注册、可用性判定、`/api/user/antom/pay` + `/api/antom/notify` 路由。前端:支付触发并入 Stripe 的 pay_link 分支、支付网关新增「支付宝(Antom)」配置区。镜像 Stripe,不新增表。凭据留空待填;`go build`+`bun build`+`go vet`+控制器测试全过。**待用户拿到 Antom 商户号后填入并做沙箱端到端联调**(签名易错,用 Antom 签名校验工具排查) |
| 2026-06-25 | 首页 | 复刻 EvoLink 风格落地页：新增 7 个 section（WhyUs/ModelsByType/ModelFamilies/Production/Integration/FAQ/SiteFooterNav）+ 改造 Hero/CTA 文案（保留终端 demo），重组 `home/index.tsx` 默认视图；自定义首页/iframe 分支与全局 Footer（含品牌署名）保持不动；品牌名走 `systemName` 动态注入；zh.json 追加 113 条中文（文本级插入，未碰混淆品牌 key）。FAQ 数据安全条软化了 SOC2/GDPR 具体认证声明以免虚假资质 |
| 2026-06-23 | 支付网关 | 每个支付方式新增「启用」开关（桌面表格列 + 手机卡片），关闭后该方式对用户隐藏（`parsePaymentMethods` 过滤 `enabled: false`） |
| 2026-06-23 | 系统设置 | 新增「团队管理」「企业团队」两个独立开关（系统设置→运维→系统行为）；开关控制侧边栏入口显示隐藏，默认全开；后端 `TeamManagementEnabled`/`TeamV3Enabled` 通过 `/api/status` 暴露 |
| 2026-06-19 | 团队管理管理 | 超管全局视图嵌入 `/team` 页：一屏对账、成员穿透、一键复制、一键踢出（注：非独立路由） |
| 2026-06-19 | 企业团队管理 | 解决白屏问题：重构 SectionPageLayout 为规范的复合组件，类型 100% 编译通过 |
| 2026-06-19 | 团队管理 | 连带补全同僚视图 GetTeamCoMembers 脱敏 API 密钥注入，激活前端展示列 |
| 2026-06-19 | 企业团队 | 事务一致性重构：CreateTeamMemberV3 合并为单 model.DB.Transaction 原子操作，防数据污染 |
| 2026-06-19 | 团队管理 | 冗余代码清理：GetTeamById 第 124-127 行死代码已安全删除 |
| 2026-06-18 | 团队管理 | 成员列表新增 API 密钥列：脱敏展示、禁止复制（hover 提示）、多密钥可展开/收起 |
| 2026-06-18 | 管理员 | 新增管理员企业团队管理页（`/admin/teamv3`）：查看所有团队、展开成员、解散团队；修复 React Fragment key bug |
| 2026-06-17 | 服务器 | `.env` PORT 从 3001 改为 3000，统一访问端口 |
| 2026-06-17 | 企业团队 | 新增：API Key 复制按钮、额度改用 $ 单位、删除成员二次确认弹窗、岗位（position）列 |
| 2026-06-17 | 团队管理 | 修复成员互见开关：按下属人数判断是否是团队长；修复描述文字换行 |
| 2026-06-17 | 计费 | 团队成员 API 用量扣团队创建者钱包；PreWssConsumeQuota/PostConsumeQuota websocket 路径同步修复 |
| 2026-06-17 | 企业团队 | 完整企业团队模块（teamv3）：创建/加入/成员管理/Token/用量统计/设置 |

---

## 待办 / Backlog

- [ ] **cyber 科技主题**（Task #1）：尚未实质开始，仅在任务列表标记 in_progress
- [x] **团队管理 co-members 视图**：当成员互见开启时，co-members 视图缺少 API 密钥列（`GetTeamCoMembers` 未注入 token）
- [ ] **管理员企业团队**：目前仅查看+解散，可考虑增加「代用户创建团队」功能
- [x] **企业团队事务一致性**：`CreateTeamMemberV3` 三步（建用户+建成员+建token）已通过 InsertWithTx 重构为单 Transaction 事务原子操作
- [x] **model/team.go dead code**：`GetTeamById` 第 124-127 行有无意义的 `Count(func()...)` 调用，已安全清理

---

## 关键改动文件速查

| 文件 | 最近改动 |
|------|----------|
| `controller/team.go` | GetMyTeam 注入成员 token（脱敏）；GetTeamSettings 按下属人数判断角色 |
| `controller/team_v3.go` | UpdateTeamMemberV3 加 position 字段；AdminListTeamsV3/AdminDisbandTeamV3/AdminGetTeamMembersV3 |
| `model/team.go` | TeamMember 加 Position；UpdateTeamMember 加 position；GetTeamOwnerForMember；GetMemberUsedQuota；AdminGetAllTeams |
| `service/quota.go` | PreWssConsumeQuota/PostConsumeQuota 团队计费重定向 |
| `router/api-router.go` | 新增 /admin/teamv3 路由组（AdminAuth） |
| `web/.../team/index.tsx` | 成员列表加 API 密钥列（MaskedKeyCell 组件，ChevronDown/Up 展开） |
| `web/.../teamv3/index.tsx` | 复制按钮、$ 单位额度、删除确认、岗位列、EditMemberDialog position 字段 |
| `web/.../admin-teamv3/index.tsx` | 新文件：管理员企业团队管理页 |
| `setting/operation_setting/operation_setting.go` | 新增 TeamManagementEnabled / TeamV3Enabled |
| `model/option.go` | 注册并加载 TeamManagementEnabled / TeamV3Enabled |
| `controller/misc.go` | /api/status 暴露 team_management_enabled / team_v3_enabled |
| `web/.../system-behavior-section.tsx` | 新增两个团队功能开关 |
| `web/.../use-sidebar-data.ts` | 侧边栏按开关条件渲染团队相关入口 |
| `.env` | PORT=3000 |

---

## 生产环境部署（2026-07-06）

| 项目 | 值 |
|------|----|
| 生产 IP | 101.47.9.133 |
| 域名 | https://ai.oneroute.vip |
| 服务器 | Rocky Linux 9.5, 2C8G, 40GB |
| Go 版本 | 1.25.1 (阿里云镜像) |
| Bun 版本 | 1.3.14 (GitHub Releases) |
| 数据库 | MySQL 8.0.46, 库名 `oneapi`, 用户 `oneapi` |
| 部署目录 | /opt/oneroute |
| 二进制路径 | /opt/oneroute/new-api (132MB) |
| 日志目录 | /opt/oneroute/logs |
| systemd 服务 | `systemctl start/stop/restart new-api` |
| nginx 配置 | /etc/nginx/conf.d/oneroute.conf |
| TLS 证书 | Let's Encrypt, 2026-10-04 到期, 自动续期 |
| SSH | `ssh -i <key.pem> root@101.47.9.133` |
| 初始状态 | 系统未初始化，需访问 https://ai.oneroute.vip 完成设置向导创建管理员 |

**classic 前端本地构建后 SCP 上传**：服务器上 date-fns@4 与 date-fns-tz@1 不兼容（rspack exports 限制），改为本地 `bun run build` 后 scp dist 到服务器，绕过兼容性问题。

**数据库已从本地迁移**（2026-07-06）：本地 MySQL `root` 库 dump → 服务器 `oneapi` 库导入。21 用户、6 渠道、完整系统配置均已迁移。SESSION_SECRET 已同步。

## 计费架构（企业团队 v3，已打通）

1. `middleware/auth.go` — 请求进来时若 token 用户是**非 owner 的企业团队成员**，调 `model.GetTeamOwnerForMember()` 拿 owner id + 成员 quota_limit，写入 context
2. `relay/common/relay_info.go` — relayInfo 读取 `TeamOwnerId` / `TeamMemberQuotaLimit`
3. `service/quota.go` + `service/billing_session.go` — 扣费重定向到 owner 钱包，按 quota_limit 限额（超限 403）
