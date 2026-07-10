# CLAUDE.md — 项目开发规范文档
## 会话启动前置要求 — 务必先阅读 `CONTEXT.md`
每次开启新会话（包括断线重连、切换客户端、更换模型后），**必须完整读取项目根目录的 [`CONTEXT.md`](./CONTEXT.md)**。
该文件是实时更新的工作进度日志，记录当前待办任务、进行中的方案、遗留踩坑点。
本 `CLAUDE.md` 存放**永久固定项目开发规范**；`CONTEXT.md` 存放**实时项目运行状态**。两份文档均具备最高权威性，二者内容不可出现逻辑冲突。
完成一个开发阶段后，需在 `CONTEXT.md` 末尾追加一行进度小结，保证下次会话可无缝接续工作。

## 项目概述
本项目是基于 Go 开发的 AI 接口网关/中转代理服务。
统一封装对接 40+ 家上游大模型厂商（OpenAI、Claude、Gemini、Azure、AWS Bedrock 等），对外提供标准化统一接口；配套完整用户管理、计费系统、限流控制、后台管理面板功能。

## 技术栈
- **后端**：Go 1.22+、Gin Web 框架、GORM v2 数据库ORM
- **前端**：React 19、TypeScript、Rsbuild、Base UI、Tailwind CSS
- **数据库**：同时兼容 SQLite、MySQL、PostgreSQL 三种数据库
- **缓存**：Redis（go-redis）+ 进程内存缓存
- **身份认证**：JWT、WebAuthn 通行密钥、OAuth（GitHub / Discord / OIDC 等标准）
- **前端包管理器**：优先使用 Bun，不推荐 npm/yarn/pnpm

## 分层架构
标准分层：路由层 → 控制器层 → 服务层 → 数据模型层
```
router/        HTTP路由定义（接口中转、后台面板、网页静态路由）
controller/    请求处理器
service/       核心业务逻辑
model/         数据模型与数据库操作（GORM）
relay/         AI接口中转代理，内置各厂商适配器
  relay/channel/ 各模型厂商专属适配器（openai/、claude/、gemini/、aws/ 等）
middleware/    中间件：鉴权、限流、跨域、日志、负载分发
setting/       全局配置管理（计费比例、模型配置、运营参数、系统性能配置）
common/        通用工具库（JSON序列化、加密、Redis、环境变量、限流工具等）
dto/           数据传输结构体（请求/响应入出参）
constant/      全局常量（接口类型、渠道类型、上下文标识）
types/         类型定义（中转消息格式、文件源、自定义错误）
i18n/          后端国际化（go-i18n，中英文）
oauth/         OAuth第三方登录实现
pkg/           内部封装工具包（缓存工具 cachex、网络工具 ionet）
web/             前端页面容器目录
 web/default/   默认新版前端（React19、Rsbuild、Base UI、Tailwind）
  web/classic/  经典旧版前端（React18、Vite、Semi Design）
  web/default/src/i18n/ 前端国际化（i18next，支持中英法俄日越）
```

## 国际化 i18n 规范
### 后端国际化（`i18n/` 目录）
- 依赖库：`nicksnyder/go-i18n/v2`
- 支持语言：英文、中文

### 前端国际化（`web/default/src/i18n/`）
- 依赖库：`i18next` + `react-i18next` + `i18next-browser-languagedetector`
- 语言优先级：英文（基准）、中文（兜底）、法语、俄语、日语、越南语
- 翻译文件路径：`web/default/src/i18n/locales/{语言标识}.json`
  文件为扁平JSON结构，键名统一使用英文原文文案
- 组件使用方式：调用 `useTranslation()` 钩子，通过 `t('英文键名')` 获取翻译文本
- 命令行工具：进入 `web/default/` 目录执行 `bun run i18n:sync` 同步翻译词条

## 强制开发规则
### 规则1：JSON序列化 — 统一使用 `common/json.go`
所有JSON序列化、反序列化操作**必须**调用 `common/json.go` 封装工具函数，禁止业务代码直接引入、调用标准库 `encoding/json`：
- `common.Marshal(v any) ([]byte, error)` 序列化结构体
- `common.Unmarshal(data []byte, v any) error` 字节数组反序列化
- `common.UnmarshalJsonStr(data string, v any) error` 字符串反序列化
- `common.DecodeJson(reader io.Reader, v any) error` 数据流反序列化
- `common.GetJsonType(data json.RawMessage) string` 获取JSON数据类型

补充说明：代码中可以引用 `encoding/json` 提供的 `json.RawMessage`、`json.Number` 等类型定义，但实际编解码逻辑必须走common封装方法。
封装层统一处理序列化逻辑，后续可无缝切换更高性能JSON库，保证全项目行为一致。

### 规则2：数据库兼容 — 同时兼容 SQLite / MySQL ≥5.7.8 / PostgreSQL ≥9.6
所有数据库相关代码必须同时兼容三种数据库，不能出现数据库专属语法。
#### 优先使用GORM封装能力
优先调用GORM内置方法（Create、Find、Where、Updates等），尽量避免手写原生SQL；主键交由GORM自动生成，禁止直接写 `AUTO_INCREMENT` / `SERIAL` 数据库自增语法。

#### 必须手写原生SQL时的兼容处理
1. 字段引号区分：PostgreSQL 使用 `"字段名"`，MySQL/SQLite 使用 `` `字段名` ``
2. 关键字字段：`model/main.go` 提供 `commonGroupCol`、`commonKeyCol` 变量，用于 `group`、`key` 这类保留字字段
3. 布尔值区分：PostgreSQL 识别 `true/false`，MySQL/SQLite 使用 `1/0`，统一调用 `commonTrueVal` / `commonFalseVal`
4. 数据库分支判断：
   使用 `common.UsingMainDatabase(common.DatabaseTypeX)` 判断业务主库；
   使用 `common.UsingLogDatabase(common.DatabaseTypeX)` 判断日志库（日志库现已支持ClickHouse）；
   废弃旧全局变量 `common.UsingPostgreSQL` / `common.UsingMySQL` / `common.UsingSQLite` / `common.LogSqlType`，禁止继续使用。

#### 禁止使用无兼容方案的数据库专属语法
- MySQL专属函数（如 `GROUP_CONCAT`），必须配套PostgreSQL等价函数 `STRING_AGG` 做兼容分支
- PostgreSQL专属操作符（`@>`、`?`、JSONB相关运算符）
- SQLite 不支持 `ALTER COLUMN` 修改字段，只能通过新增字段方案迂回实现
- 数据库专属字段类型，JSON存储统一使用 `TEXT`，禁止直接使用 `JSONB`

#### 数据库迁移文件要求
所有迁移脚本必须在三种数据库均可正常执行；SQLite修改字段只能使用 `ALTER TABLE ... ADD COLUMN` 新增字段，参考 `model/main.go` 提供的标准写法。

### 规则3：前端工程 — 优先使用 Bun
前端目录 `web/default/` 统一使用 Bun 作为包管理器与脚本执行工具：
- `bun install` 安装依赖
- `bun run dev` 启动本地开发服务
- `bun run build` 打包生产环境代码
- `bun run i18n:*` 国际化词条同步工具

### 规则4：部署与编译 — 服务器端编译，禁止本地交叉编译上传二进制

**生产服务器**：`101.47.9.133`（Rocky Linux 9.5 x86_64），域名 `ai.oneroute.vip`，SSH 私钥 `C:\Users\allenzhao\Downloads\allen-AI中转用.pem`，用户 `root`。
项目路径 `/opt/oneroute/`，服务管理 `systemctl restart oneroute`，日志 `journalctl -u oneroute -f`。

**部署流程（必须严格遵守）**：
1. **只上传修改的源码文件**到服务器（`scp` 单个文件或目录），**禁止**本地交叉编译后上传整个二进制（149MB 太慢，且不可持续）。
2. 在服务器上编译：前端 `cd /opt/oneroute/web/default && ~/.bun/bin/bun install && ~/.bun/bin/bun run build`（classic 前端同理），然后后端 `cd /opt/oneroute && /usr/local/go/bin/go build -o new-api .`。
3. 编译成功后 `systemctl restart oneroute`。
4. 部署完成后验证：`curl -sS -m 5 -o /dev/null -w '%{http_code}' https://ai.oneroute.vip/` 应返回 200。

**禁止事项**：绝对不要在本地执行 `GOOS=linux go build` 然后 scp 二进制。每次部署只传变更的源码文件。

### 规则5：新增模型渠道 — StreamOptions 流式配置兼容
新增厂商中转渠道适配器时：
1. 确认该厂商接口是否支持 `StreamOptions` 流式参数配置
2. 若支持，将渠道标识加入 `streamSupportedChannels` 支持列表

### 规则6：上游中转请求DTO — 保留显式零值
用于接收客户端JSON、再转发给上游厂商的请求结构体（中转转换链路专用），必须遵循以下规范：
1. 可选基础类型字段**必须使用指针类型 + omitempty标签**（`*int`、`*uint`、`*float64`、`*bool`），禁止非指针基础类型
2. 语义约束：
   - 客户端JSON不传该字段 → 指针为nil → 序列化时自动省略该参数
   - 客户端显式传入0/false零值 → 指针非nil → 必须完整转发给上游厂商
3. 禁止给可选参数使用非指针基础类型+omitempty：原生零值（0、0.0、false）会在序列化时被自动丢弃，造成上游参数缺失。

### 规则7：计费表达式系统 — 修改前必读 `pkg/billingexpr/expr.md`
开发阶梯计费、动态表达式计价相关功能时，**必须先完整阅读 `pkg/billingexpr/expr.md`**。
文档包含整套计费系统设计思路、表达式语法（内置变量、函数、示例）、完整架构流程（编辑器→存储→预扣费→结算→日志展示）、Token归一化规则（自动剔除提示词/输出标记）、配额换算、表达式版本管理。
所有计费表达式相关代码修改，必须严格遵循文档内标准写法。



### 规则9：与官方上游仓库（QuantumNous/new-api）同步规范
本仓库的 git 远端 `origin` 就是**本派生仓库自己的远端**（`gaogg521/Oneroute`，对应生产环境 `ai.oneroute.vip`），日常提交、`git push origin main` 都是推自己的仓库，无需额外确认或顾虑。
官方上游仓库是 `QuantumNous/new-api`，与 `origin` 是两个不同的远端——如需拉取上游更新，需单独添加（如未添加：`git remote add upstream https://github.com/QuantumNous/new-api.git`），从 `upstream/main` 合并进本仓库后再推回 `origin main`。将上游main分支代码合并至本派生仓库时，严格按以下四条优先级执行：
1. **保留本地 `CLAUDE.md` 文件**：绝不直接覆盖上游版本，本文件记录派生仓库专属开发规范，包含本条同步规则。
2. **不可移除本地新增功能**：团队管理 `/team`、新版企业团队 `/teamv3` & `/admin-teamv3`、蚂蚁支付网关、文档中心 `/docs`、首页改版、模型价格可视化编辑器保存按钮修复等自研功能必须保留。
   若上游完整重写冲突文件，以上游代码为基底，再手动叠加本地自研功能，不可直接二选一覆盖。
3. **不覆盖本地专属文档/数据**：`CONTEXT.md` 为本仓库独有文件（上游不跟踪，不会产生冲突），合并流程中禁止丢弃该文件及其他项目专属文档。
4. **其余上游新增功能、Bug修复默认全量接纳**：不能因为文件存在本地定制内容就直接全盘舍弃上游更新，需手动调和冲突，而非简单选择「我方版本」。

#### 合并完成后校验项（必须全部通过才算完成）
1. 后端编译：`go build -o new-api.exe .` 无编译报错
2. 前端构建：进入 `web/default`，执行 `bun run typecheck` 类型校验、`bun run build` 打包，无报错；路由文件 `web/default/src/routeTree.gen.ts` 通过打包自动生成，禁止手动合并修改
3. 全局检索废弃API：检索项目内所有 `common.UsingPostgreSQL` / `common.UsingMySQL` / `common.UsingSQLite` / `common.LogSqlType`，此类旧全局变量已重构，检索到残留代码需全部替换为新接口
4. 国际化JSON冲突处理：`web/default/src/i18n/locales/*.json` 翻译文件采用三向合并，合并所有语言词条，不直接覆盖任意一方；合并完成执行 `bun run i18n:sync` 标准化文件格式
5. 浏览器全功能冒烟测试（管理员账号登录）：首页、团队管理 `/team`、新版团队 `/teamv3`、后台团队管理 `/admin-teamv3`、文档中心 `/docs`、计费设置-支付渠道（蚂蚁支付Tab与开关）、模型价格编辑器；同时切换至少一种非中文语言页面验证正常。

#### 上游合并标准工作流（适用于大批量提交同步）
1. **合并前先评估冲突范围**，不要直接执行git merge
   - 存在未提交代码时，使用 `git stash create` 快照备份（仅生成提交哈希，不改动工作区与暂存区，随时可执行）
   - 使用 `git merge-tree --write-tree <当前快照/HEAD> upstream/main`（Git版本≥2.38），无副作用输出全部冲突文件，提前预估合并工作量
   - 对比冲突文件双方修改行数：上游改动5000行、本地仅改动5行 → 以上游文件为基底，重新叠加本地5行逻辑；双方均改动50行左右 → 逐行手动调和冲突标记
2. **先提交本地未完成代码**，剔除构建产物、日志缓存等垃圾文件，保证合并前工作区干净，避免合并丢失本地代码
3. **新建临时分支执行合并**，禁止直接在main主分支合并；全部校验通过后，再合并至main分支
4. **按分类处理冲突**
   - 自有文档/配置文件：直接保留本地版本 `git checkout --ours -- 文件路径`
   - 自动生成文件：先使用上游版本占位，再执行构建命令重新生成
   - 双方改动行数接近：打开文件手动调和冲突标记，保留两边业务逻辑
   - 上游完整重写文件、本地仅少量补丁：先拉取上游完整文件，再对比合并前本地diff，手动适配原有业务逻辑（上游可能重构组件、拆分函数、重命名变量，禁止无脑粘贴旧代码）
   - 大批量扁平化字典（国际化JSON）：不手动处理冲突标记，编写临时Node脚本读取三个版本（基准/本地/上游）合并所有键名；两边同时修改的词条记录日志人工核对，合并完成执行项目i18n同步工具标准化
5. **不手动全局检索替换所有重命名变量**，编译校验是最可靠手段：冲突解决后执行 `go build` / `bun run typecheck`，编译器会精准定位所有废弃引用，循环修复至无报错
6. **上线main分支前必须浏览器完整功能测试**，仅编译通过不代表业务功能正常，需验证所有自研页面、计费、中转功能可正常渲染、调用。