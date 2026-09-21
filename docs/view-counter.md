# 浏览量计数器

## 功能范围

文章与列表卡片显示眼睛图标和累计浏览次数；页脚显示全站累计次数。列表卡片只读，不为文章计数。前台可见的页面文档只上报一次，正常刷新会再记一次；不把恢复同一文档的后台标签页、返回缓存或重复脚本初始化当成新访问。

累计表 `view_totals` 和每日汇总表 `view_daily` 保留原 PV；v2 增加短期幂等回执、假名化访客每日去重和来源每日汇总，不保存原始 IP、账号、原始访客标识、完整来源 URL、设备指纹或点击日志。数据库 `sunionpeaks-views` 只绑定 `sunionpeaks` 生产项目，变量名 `VIEWS_DB`，不绑定旧站或 MCP。统计日界线为 `Asia/Shanghai`，与站点现有日期显示保持一致；近 7/30 天为包含今天的自然日。中英文按各自 `语言/slug` 分开计数。计数从首次初始化起累计，不导入有抽样的 RUM 历史数。

## 启用与权限

生产 CI 运行 `python3 scripts/views/provision.py`，按固定名称寻找或创建数据库、增量建表、绑定生产环境，并验证后设置 `PUBLIC_VIEWS_ENABLED=true`。v2 准备失败时停止新部署，保留已上线版本，避免静默关掉正在使用的计数。每次部署的 `view-counter-status` 私有 artifact 明确区分 `active` 与 `code-deployed-awaiting-d1-permission`。

现有部署 token 需要 Account / D1 / Edit（API 权限名称为 D1 Write）。也可保持部署 token 不变，将同账户的专用 D1 token 存入 GitHub Actions secret `CLOUDFLARE_D1_API_TOKEN`。不要把 token 写进仓库、前端、文章或聊天。补齐权限后，重新运行主 CI，流程会自动建表、绑定、构建与验证；不需要再修改文章。

使用 Cloudflare 控制台手工创建数据库和绑定时仍须执行 `migrations/views/0001_views.sql`；推荐使用上述 CI 流程保证不会忘记迁移。生产代码仅获得 D1 binding，不持有管理 API token。

## 聚合查询

```text
GET /api/views                          全站累计
GET /api/views?ref=zh/article-slug      全站及指定文章累计；可重复 ref 批量读取
GET /api/views?mode=summary             全站累计、今日、昨日、近 7/30 天及 30 天趋势
GET /api/views?mode=summary&ref=zh/article-slug
GET /api/views?mode=top&period=all       累计前 10 篇
GET /api/views?mode=top&period=7d        近 7 天前 10 篇
GET /api/views?mode=top&period=30d       近 30 天前 10 篇
```

全部 GET 为只读。POST `/api/views` v2 接收 `{version:2, eventId, occurredAt, visitorId, attribution, path, refs}`；兼容旧页面的 `{path,refs}`，旧协议只计 PV，不伪造 UV 或来源。从构建产物白名单确定文章 ID，不信任客户端自报的文章身份。单个事务原子递增全站和当前文章的累计/当日数据；同一次响应供文章、页脚和前 60 个卡片共享。额外卡片分批只读。正文、图片和静态资源不额外触发计数函数。

接口仅在正式主机可用，POST 校验 Origin、正文大小、路径白名单以及存在时的 Referer。预览、后台、404、API、机器人与部署验证流量排除。公开端点不是严格反作弊系统：可伪造正常浏览器的脚本仍可能刷量；不声称统计的是独立人数、真实读者或阅读完成量。没有对失败的 POST 自动重试，避免请求已提交但响应丢失后再次加一。

数据已公开显示在网站，因此聚合查询也是公开的；不提供任意 SQL、访客明细或管理功能。数据与 Cloudflare RUM 分开，数字不相加，也不要求一致。

## 本人排除与故障表现

在当前浏览器执行：

```js
localStorage.setItem('dossierkit:views:exclude', '1'); // 排除自己，只读取数字
localStorage.removeItem('dossierkit:views:exclude'); // 恢复计数
```

开关仅影响第一方计数，不改变 Cloudflare Analytics。Global Privacy Control、Do Not Track 和 webdriver 使用只读请求。不使用跨设备标识。脚本未运行或被拦截时可能漏计。

数字异步显示；请求失败或 8 秒超时后隐藏，不显示假 0，不弹错，不阻塞正文。已经成功读到的真实 0 可以正常显示。重部署只运行幂等建表语句，绝不重置数据。修改标题或域名不改 `语言/slug` 身份；改 slug 需单独迁移两张表对应 key，迁移时不能覆盖已存在的新 key。

## 验证

```sh
pnpm test:views
PUBLIC_VIEWS_ENABLED=true pnpm build
pnpm exec playwright install chromium
node scripts/views/browser-test.mjs
```

单元测试使用 SQLite 执行真实 SQL 和事务，再验证浏览器调用逻辑。浏览器展示测试使用隔离模拟 API，覆盖桌面/手机与失败模式，不写生产数据。主 CI 验证真实线上 API 的启用或显式停用状态，HTTP 健康与内容发布仍走原流程。部署成功不能替代 D1 激活成功；以 `live-receipt.json` 的 `counterActive` 为准。

官方依据：
- https://developers.cloudflare.com/pages/functions/bindings/#d1-databases
- https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/


## v2：幂等 PV、浏览器 UV、来源与独立页面

原笔记保持 `zh/slug` / `en/slug`；简历等页面使用 `page:/zh/cv`。全部正式语言页面独立计数。查询参数、片段、末尾斜杠及 index.html 不拆分页面身份。中英文分开。

小眼睛继续显示 PV。正常刷新生成新事件，PV +1；同一事件在 24 小时接收窗口内重复上报只认一次。首次登记及全部递增受同一 D1 事务和请求所有权条件控制。不是忽略重复 INSERT 后继续无条件加一。不做 30 分钟刷新合并。幂等回执 48 小时过期，清理后的原请求已超过接收窗口。

UV 使用本地随机 UUID，最长 90 天，Web Locks 可用时跨标签页创建互斥；存储不可用时只计无法识别身份的 PV，不伪造新的 UV。D1 仅存站点 HMAC-SHA256 摘要。运行密钥 `VIEWS_HASH_SECRET` 自动生成一次，仅保留在 Pages secret，部署不轮换。GPC、DNT、webdriver、本人排除仍只读。

UV 在全站或指定页面分别 COUNT DISTINCT，跨日、跨页面、跨来源都不相加。summary.uv 提供 today/yesterday/last7Days/last30Days、启用日、90 天保留范围及 identifiableViews30Days。身份是独立浏览器，不是跨设备的真实自然人，不提供永久累计 UV。

来源只接受规范化 utm_source/utm_medium 或外部来源域名，并保留 basis。新入口标签优先，其次 referrer；同标签页 30 分钟活跃入口链内的站内跳转继承来源；新的外部入口覆盖，无来源直接进入重置 Unknown。来源是分发证据，不保证真实平台。API 请求头 Referer 继续做页面校验，不当成来源。

```text
GET /api/views?path=/zh/cv/
GET /api/views?mode=summary&path=/zh/cv/
GET /api/views?mode=sources&period=7d
GET /api/views?mode=sources&period=30d&path=/zh/cv/
GET /api/views?mode=top&type=pages&period=30d
GET /api/views?mode=top&type=all&period=7d
```

Sources 是入口链归因 PV/UV，不冒充访问会话或入口次数；最多 50 个来源，并标示 truncated。只公开聚合，不公开事件、访客摘要或任意 SQL。UV、来源及非笔记页面独立 PV 从升级开始，旧 PV 保留，无法补算旧 UV。

`View counter retention` 每日 workflow 使用现有 D1 凭据，只删除过期 view_events 及 90 个自然日以前的 view_visitors，不删累计、每日 PV 或来源聚合。GitHub 调度可能延迟或暂停，必要时可手动运行；不承诺精确到秒删除，底层备份策略独立适用。不新增独立 Worker 或统计平台。

页脚“统计与隐私”包含双语说明及当前浏览器退出开关。开关只影响第一方计数，不改变 Cloudflare Web Analytics。测试覆盖重复并发、失败回滚、旧数保留、CV 独立计数、跨日去重、存储失败、来源清洗及入口继承。runtime-test.mjs 使用本地 Miniflare D1 binding；浏览器展示验证使用隔离数据，不写生产计数。
