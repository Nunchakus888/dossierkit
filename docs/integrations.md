# 互动与辅助分享

保留现有 `ci.yml` 作为唯一生产构建、部署入口。Notes 仍在 Git 中；评论、反馈与统计不写回文章、不触发部署。不接 X 付费 API、GoatCounter、自建账户或互动数据库。

## 配置与内容管理

可选配置：`profiles/<id>/integrations.yaml`。缺少文件时所有集成关闭。两种生成命令均在 Decap 的 Profile Config 中加入「互动与分享 / Integrations」：

```sh
pnpm generate-admin-config
pnpm dossier generate-admin-config
```

笔记仍通过 canonical MCP/Git 管理；不把 HTML Notes 塞入 Markdown 编辑器。

| 配置 | 用途 |
|---|---|
| `productionOrigin` | 正式 HTTPS origin；浏览器在其他域名不启用集成 |
| `instanceRepository` | 绑定生产仓库，Fork 构建不使用原实例的互动配置 |
| `siteId` | 稳定站点身份，不随文章标题变化 |
| `analytics` | 仅 Cloudflare；Pages 自动注入或手工 beacon 二选一 |
| `comments` | giscus 仓库、分类、反应和主题 |
| `social` | 读者分享、作者待发 Issue、存量基线、语言和每次上限 |
| `overrides` | 按 noteRef 关闭功能、覆写短文案或保留迁移前讨论标识 |

配置只放公开标识，不放 Cloudflare API token、GitHub token 或 X 凭据。访问数、点赞数、待发状态不进入文章 frontmatter。

## Cloudflare Web Analytics

默认 `provider: cloudflare`、`mode: pages`，`token` 留空，保留 Pages 自动注入。若账户尚未开启，在现有 Pages 项目开启 Web Analytics；后续部署由 Cloudflare 注入 beacon。代码不会假装已经修改账户开关。

非自动注入部署可使用 `mode: manual` 并填公开 beacon token，不能填 Cloudflare API token。schema 禁止 Pages 模式同时填写 token；浏览器也检查已有 beacon，避免重复。

只提供 Cloudflare 后台统计，不伪造公开访问计数、自定义事件或 UTM/点击率归因。生产统计不应启用于预览域名。

官方说明：https://developers.cloudflare.com/pages/how-to/web-analytics/

## 评论与反馈

生产源仓库保持私有。启用 `comments.provider: giscus` 前，必须选择一个公开仓库，开启 Discussions、设置专用分类，并安装 giscus GitHub App。从 https://giscus.app/ 获取真实的 `repo`、`repoId`、`category`、`categoryId`，填入配置后通过原 CI 发布。

组件懒加载评论与 reactions，加载失败保留 GitHub Discussions 入口。评论账户授权与 Decap OAuth、Notes MCP Access 分开；reactions 需要 GitHub 登录，不是匿名点赞。

在**讨论仓库**放置 `giscus.json`，不要误以为私有源仓库的配置会控制另一个仓库：

```json
{"origins":["https://YOUR-PRODUCTION-HOST"],"defaultCommentOrder":"oldest"}
```

讨论使用 `siteId:profileId:noteRef` 的 specific + strict 映射；改标题或附加 URL 查询参数不分裂讨论。改文件名、profileId 或 siteId 时，通过 override 保留旧 threadKey。代码升级不能代替仓库公开设置及 App 安装授权。

## X：仅辅助发送

文章页提供「分享到 X」和「复制链接」。前者只打开官方编辑框，不发送帖子。文案使用确定性模板；按 X 单权重 Unicode 区间保守计算，URL 预留 23 字符，组合 emoji 可能被高估，但不会截断字素。不额外安装依赖，最终校验与发送由 X 完成。

`social-assist.yml` 不安装依赖、不构建、不部署，仅在成功的 push-to-main CI 后或手动运行时执行：

1. 校验上游运行和不可变的 `notes-publication` artifact。
2. 用完整已部署清单对账，按 `baselineSha` 排除所有存量 Notes。
3. 校验正式 URL、canonical、noteRef 和重新计算的文章指纹。
4. 创建或刷新私有 `[待分享 X]` Issue；记录创建提交、部署提交与固定文案。

GitHub Issue 是持久待发记录。不要删除记录或编辑机器标识。关闭或已经确认的任务不自动重开；文章改动只刷新未发送草稿，并保留人工备注。文案变化会更新 draftHash。若创建 Issue 请求超时，不在原调用内盲目重试，下次先全量读取记录再对账。

在 Actions → Social assist → Run workflow 中：

| action | 操作 |
|---|---|
| `prepare` | 默认读取最近成功生产 CI；可指定 run_id 补偿检查 |
| `confirm` | 人工发出后，填 Issue 编号、当前 draftHash 和真实帖子 URL；记为 published_manual 并关闭 |
| `skip` | 填 Issue 编号，记为跳过并关闭 |

`published_manual` 只代表作者确认，不是 X API 核验。打开编辑框、复制链接均不代表成功发送。手动关闭未登记的任务也不会被重新创建。

每次生成/刷新数量受 `maxPerRun` 限制；有积压或临时 URL 错误时重新运行 prepare。默认不轮询。artifact 保留 90 天，过期后使用一次新的成功生产 CI。发送前总是检查正式文章，尤其是笔记已删除或关闭分发的情况。

分发任务仅使用普通 GitHub token 的 contents/actions 读取与 Issues 写入权限，不接触 Cloudflare、MCP 或 X 凭据。下载的 artifact 仅作为有大小和来源约束的 JSON，不执行其中的代码。

## 验证

```sh
pnpm test:notes
pnpm test:integrations
pnpm build
node scripts/test-publication-build.mjs
```

唯一静态构建同时生成 `/meta/notes.json` 和文章身份元数据；CI 逐篇验证构建产物、分享和评论开关，仅在既有两个部署成功后上传该清单。

上线后检查真实文章按钮、canonical 与指纹，配置完成后再核验 giscus iframe，并确认页面只有一个 Cloudflare beacon。HTTP 200 或源码存在组件，不等于外部服务已启用。
