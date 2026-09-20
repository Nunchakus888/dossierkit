# 笔记配图与插件（MCP 1.5）

## 一个可选参数

`save_note` 保留原参数，只增加 `assets: {"cover.svg": "<svg ...>...</svg>"}`。`cover.svg` 是分享封面，不需要 share、id、role、路径或素材 manifest。Markdown 使用 `![图意](asset:cover.svg)`，HTML 使用 `<img src="asset:cover.svg" alt="图意">`。正文没有引用也能用于分享；普通插图不参与分享。

文件名采用小写字母开头的字母、数字、连字符加 `.svg`，不含路径。每篇最多 8 个文件，每个最多 100 KB UTF-8，合计最多 400 KB。SVG 需要 xmlns、从 0 0 开始的 viewBox 和一个有意义的根 title。封面为 1200×630，其他图最大 2400×2400。

支持静态图形、文字、分组、渐变、局部 marker/clipPath。拒绝脚本、样式、外部资源、图片嵌套、foreignObject、use、动画、DTD、XML 声明和注释。通过属性设置颜色和字体，推荐 Noto Sans CJK SC。模型一次生成完成的图；MCP 与构建不调用模型。不得把完整 SVG 再复制到正文。只支持直接图片引用，不采用 Markdown 引用式图片定义。

## 编辑与版本

先 `get_note`，保留 noteRef 与格式。省略 assets 保留旧图；同名更新；值为 null 明确删除，正文仍引用时拒绝。去掉正文引用不删除素材。需要修改图片时使用 `get_note({query: noteRef, includeAssets: true})` 获取源码；平时只返回 assetNames，减少上下文。

MCP 固定一次读取快照，复用 canonical 正文逻辑，正文与图片写入同一个 Git tree/commit；分支只允许非强制更新。并发冲突或请求结果不确定时先回读再重试，禁止盲目重发。重试相同笔记包不产生新提交。保存结果只表示已提交，公开展示需等待 CI。

有素材时，工具返回的 contentHash 覆盖正文与所有 SVG；没有素材时与旧版本一致。磁盘正文的 canonical contentHash 仍只用于正文完整性检查。删除工具接收本次 get_note 返回的 hash，原子删除该正文及其独占素材；Git 历史与外部分享缓存不因此抹除。保存操作保护请求执行期间的分支并发，不承诺跨用户编辑会话的自动冲突合并。

## 存储与构建

源文件只保存在 `profiles/<profile>/assets/notes/<locale>/<note-key>/*.svg`。正文记录 `/profile-assets/<profile>/notes/<locale>/<note-key>/...` 标准路径，get_note 转回 asset: 引用。修改标题保持 noteRef，不搬目录。无引用文件不自动清理；整篇删除会清理其专属目录，构建不会发布不存在笔记的孤立素材。

现有 `pnpm build` 在 Astro 前将 cover.svg 转为一张 PNG。普通 SVG 原样输出，PNG 位于 public/_generated（忽略 Git）并进入 dist；它不是第二份可维护素材。原图、固定字体、渲染器版本一起决定图片 URL。没有 cover.svg 的旧文章使用站点默认封面。封面不会强制插入正文。

渲染复用 Astro 锁定的 sharp，无新增 npm 依赖。构建预备阶段从固定 Noto CJK 提交下载并校验字体到 `.cache`，字体不写入 Git、不进入站点和插件包。Linux 构建需要 fontconfig（GitHub Ubuntu runner 自带；本地缺失时安装）。图片渲染不允许源 SVG 请求网络；缓存字体下载是独立的构建依赖获取。升级 Astro/sharp 后必须验证生成器和卡片测试。

## 验证与插件

```sh
pnpm test:notes
pnpm test:assets
pnpm test:integrations
pnpm build
pnpm exec tsx scripts/export-publication.ts
node scripts/test-publication-build.mjs
node scripts/verify-note-covers.mjs
pnpm package:plugin
```

仍只有 ci.yml 部署站点与隔离 MCP；social-assist 不构建、不部署、不代发 X。图片改变会更新发布指纹，但不会把文章当作新文章重复分发。

插件源码在 plugins/dossierkit-notes，只有一个 publish-note Skill。默认不配置任何 MCP，避免 Fork 误连接作者实例。configure.mjs 生成标准 HTTP MCP、Codex 兼容配置；Web 需要真实注册连接 ID 才生成 .app.json。插件 ZIP 是安装素材，不代表已经在账户安装、获得 OAuth 授权或通过市场审核。不要向包写入令牌。README 包含各平台安装入口与兼容回退。
