# 浏览量计数器

## 功能范围

文章与列表卡片显示眼睛图标和累计浏览次数；页脚显示全站累计次数。列表卡片只读，不为文章计数。前台可见的页面文档只上报一次，正常刷新会再记一次；不把恢复同一文档的后台标签页、返回缓存或重复脚本初始化当成新访问。

后台只有累计表 `view_totals` 和每日汇总表 `view_daily`；不保存访客记录、IP、身份、来源、设备或行为日志。数据库 `sunionpeaks-views` 只绑定 `sunionpeaks` 生产项目，变量名 `VIEWS_DB`，不绑定旧站或 MCP。统计日界线为 `Asia/Shanghai`，与站点现有日期显示保持一致；近 7/30 天为包含今天的自然日。中英文按各自 `语言/slug` 分开计数。计数从首次初始化起累计，不导入有抽样的 RUM 历史数。

## 启用与权限

生产 CI 运行 `python3 scripts/views/provision.py`，按固定名称寻找或创建数据库、增量建表、绑定生产环境，并验证后设置 `PUBLIC_VIEWS_ENABLED=true`。未准备好时不会显示小眼睛或伪造 0，也不会阻止原站正常部署。每次部署的 `view-counter-status` 私有 artifact 明确区分 `active` 与 `code-deployed-awaiting-d1-permission`。

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

全部 GET 为只读。POST `/api/views` 仅接收 `{path, refs}`，从构建产物白名单确定文章 ID，不信任客户端自报的文章身份。单个事务原子递增全站和当前文章的累计/当日数据；同一次响应供文章、页脚和前 60 个卡片共享。额外卡片分批只读。正文、图片和静态资源不额外触发计数函数。

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
