# DossierKit 技术方案与 Codex 实现任务书

**版本**：v1.0  
**日期**：2026-06-26  
**定位**：一个 Git-backed、CMS-enabled、data-driven 的双语专家档案模板系统  
**目标用户**：AI / 技术专家、架构师、算法专家、产品技术负责人、研究员、咨询顾问  
**核心目标**：换一个人只需替换配置与内容数据，不改页面代码；任何设备打开 `/admin` 即可维护内容；一次更新自动生成网站、PDF 简历、AI 可读数据与搜索索引。

---

## 0. 摘要

DossierKit 不是普通个人主页，也不是单份在线简历。它是一个**个人能力信息聚合系统模板**，用于展示一个资深候选人的履历、案例、实验、文章、目标岗位匹配度、PDF 简历和 AI 可读数据。

最终形态：

```text
响应式双语网站
+ Git-backed 在线 CMS 后台
+ Profile Pack 数据包
+ 角色定向页
+ PDF 简历自动导出
+ llms.txt / profile.json 自动导出
+ 搜索索引
+ 可复用模板仓库
```

最终使用体验：

```text
手机 / 电脑打开 yourdomain.com/admin
        ↓
登录后编辑 Profile、Experience、Case、Lab、Writing 等内容
        ↓
保存后提交到 GitHub
        ↓
Cloudflare Pages 自动构建
        ↓
网站、PDF、profile.json、llms.txt、搜索索引同步更新
```

---

## 1. 产品定位

### 1.1 项目名称

建议命名：

```text
DossierKit
```

完整定义：

```text
DossierKit: Data-driven Personal Expert Dossier Template
```

中文定义：

```text
DossierKit 是一个数据驱动、可配置、双语、可导出、可在线维护的个人专家档案模板系统。
```

### 1.2 目标不是“好看的个人站”

目标不是做一个视觉炫酷的 Portfolio，而是建立一个可验证的专家档案系统。

它应该让访问者在不同时间窗口内完成不同判断：

| 时间 | 访问者要得到的判断 |
|---|---|
| 30 秒 | 这个人是谁，背景是什么，适合什么岗位。 |
| 5 分钟 | 这个人做过什么代表案例，是否有架构和落地能力。 |
| 15 分钟 | 这个人的方法论、实验、复盘和技术深度是否可信。 |

### 1.3 典型使用场景

```text
猎头初筛：发首页 + PDF 简历
HR 流程：发 /cv + 中文 PDF
技术负责人：发 /work/agent-platform
算法团队：发 /lab + /for/posttraining
内推人：发 /for/agent-platform
外企/全球团队：发 /en + 英文 PDF
```

---

## 2. 设计原则

### 2.1 数据驱动

模板代码里不写任何个人信息。

所有个人信息来自：

```text
profiles/{profileId}/profile.yaml
profiles/{profileId}/experience.yaml
profiles/{profileId}/skills.yaml
profiles/{profileId}/roles.yaml
profiles/{profileId}/theme.yaml
profiles/{profileId}/resume.yaml
profiles/{profileId}/content/{locale}/...
```

换人时只替换 `profiles/{profileId}`。

### 2.2 配置驱动

首页模块、角色页、主题、PDF 简历、导航、目标岗位都应通过配置控制。

页面代码只负责：

```text
读取配置
校验数据
渲染组件
生成导出物
```

### 2.3 可在线维护

非开发维护者不应依赖本地环境。

标准维护入口：

```text
/admin
```

后台应支持表单化编辑：

```text
Profile
Experience
Skills
Roles
Cases
Lab
Writing
Assets
Resume Config
Theme Config
```

### 2.4 一源多出

同一套结构化数据应生成：

```text
网站页面
中文 PDF 简历
英文 PDF 简历
角色定向版 PDF
profile.json
llms.txt
sitemap.xml
搜索索引
Open Graph 元数据
```

### 2.5 双语优先

系统必须完整支持中文和英文。

推荐路径：

```text
/zh
/en
/zh/cv
/en/cv
/zh/work/agent-platform
/en/work/agent-platform
```

### 2.6 移动端优先维护，PC 端优先深读

移动端用于猎头转发、微信查看、快速联系。  
PC 端用于案例深读、技术负责人评估、面试前研究。

---

## 3. 最终交付形式

### 3.1 面向最终使用者的交付

| 交付物 | 说明 |
|---|---|
| 响应式双语网站 | PC / Mobile / Tablet 全适配。 |
| `/admin` 后台 | 在线编辑内容，提交到 Git。 |
| 中文 PDF 简历 | 从数据生成，适配国内投递。 |
| 英文 PDF 简历 | 从数据生成，适配外企/全球团队。 |
| 角色定向页 | 如 `/zh/for/agent-platform`、`/zh/for/posttraining`。 |
| 案例库 | 用深度 Case Study 展示能力。 |
| Lab 实验库 | 用实验记录展示算法/工程补强。 |
| 技术文章库 | 长期沉淀方法论与行业理解。 |
| AI 可读数据 | `/profile.json`、`/llms.txt`。 |
| 搜索索引 | 本地静态搜索，无需搜索服务。 |

### 3.2 面向模板复用者的交付

| 交付物 | 说明 |
|---|---|
| Starter Repo | 可 fork 的模板仓库。 |
| Example Profile Pack | 高质量示例人物数据。 |
| Schema 文档 | 字段解释、示例、校验规则。 |
| 写作指南 | 教别人如何写 Case Study、Lab、履历。 |
| 部署文档 | Cloudflare Pages / Vercel / Netlify。 |
| CLI 脚本 | 创建 profile、校验、生成 PDF、导出 profile pack。 |

---

## 4. 技术架构

### 4.1 推荐主架构

```text
Astro + Tailwind + MDX + YAML
+ GitHub Repository
+ Decap CMS / Sveltia CMS
+ Cloudflare Pages
+ Playwright PDF Export
+ Pagefind Search
```

### 4.2 架构图

```text
┌──────────────────────────────┐
│  PC / Mobile Browser          │
│  public website + /admin       │
└───────────────┬──────────────┘
                │
                ▼
┌──────────────────────────────┐
│  Git-backed CMS               │
│  Decap CMS / Sveltia CMS      │
│  Edit YAML / MDX / Assets      │
└───────────────┬──────────────┘
                │ commit / PR
                ▼
┌──────────────────────────────┐
│  GitHub Repository            │
│  profiles/{activeProfile}/     │
│  config + content + assets     │
└───────────────┬──────────────┘
                │ push triggers build
                ▼
┌──────────────────────────────┐
│  Build Pipeline               │
│  validate schema              │
│  build static site            │
│  generate PDF                 │
│  generate llms.txt            │
│  generate profile.json        │
│  generate search index        │
└───────────────┬──────────────┘
                ▼
┌──────────────────────────────┐
│  Cloudflare Pages / CDN       │
│  /zh /en /cv /work /lab        │
└──────────────────────────────┘
```

### 4.3 分层设计

```text
展示层：Layouts / Components / Theme Tokens
内容层：MDX Case / Lab / Writing
数据层：YAML Profile / Experience / Skills / Roles
配置层：site.config.ts / theme.yaml / resume.yaml
生成层：PDF / llms.txt / profile.json / sitemap / search index
维护层：/admin Git-backed CMS
```

---

## 5. 技术选型

### 5.1 主栈

| 模块 | 推荐技术 | 原因 |
|---|---|---|
| Framework | Astro | 适合内容型静态站，性能好，结构清晰。 |
| Language | TypeScript | 方便 schema、配置和组件类型约束。 |
| Styling | Tailwind CSS | 主题化与响应式开发效率高。 |
| Long-form Content | MDX | 案例、文章、实验记录可嵌入组件。 |
| Structured Data | YAML | 非开发用户更容易编辑。 |
| Validation | Zod | 对 profile、case、lab 等数据做强校验。 |
| CMS | Decap CMS default / Sveltia CMS optional | Git-backed，支持浏览器编辑。 |
| Deployment | Cloudflare Pages | Git push 自动部署，成本低，CDN 快。 |
| PDF | Playwright | 从 CV 页面打印生成 PDF。 |
| Search | Pagefind | 静态搜索，无需数据库。 |
| Access Control | Cloudflare Access | 保护 `/admin` 和私密页面。 |

### 5.2 CMS 选择策略

默认支持：

```text
Decap CMS
```

原因：生态成熟、文档多、Git-backed 逻辑清晰。

可选支持：

```text
Sveltia CMS
```

原因：UI 更现代，移动端体验更好，适合个人随时维护。

不建议 V1 作为主方案：

```text
Notion API：结构约束弱，双语和 schema 复杂。
Sanity / Contentful：偏团队 CMS，对个人模板过重。
自研后台 + 数据库：维护成本高，不符合轻量目标。
```

---

## 6. 仓库结构

推荐结构：

```text
dossierkit/
  package.json
  astro.config.mjs
  tailwind.config.ts
  tsconfig.json
  src/
    components/
      common/
      dossier/
      layout/
    layouts/
      BaseLayout.astro
      CaseLayout.astro
      LabLayout.astro
      CVLayout.astro
    pages/
      [locale]/
        index.astro
        cv.astro
        work/
          index.astro
          [slug].astro
        lab/
          index.astro
          [slug].astro
        writing/
          index.astro
          [slug].astro
        for/
          [role].astro
        contact.astro
      admin/
        index.html
      llms.txt.ts
      profile.json.ts
    lib/
      config.ts
      profile-loader.ts
      i18n.ts
      schema.ts
      seo.ts
      content-query.ts
      generate-llms.ts
      generate-profile-json.ts
    styles/
      global.css
      theme.css

  profiles/
    default/
      profile.yaml
      experience.yaml
      education.yaml
      skills.yaml
      roles.yaml
      metrics.yaml
      theme.yaml
      resume.yaml
      home.yaml
      content/
        zh/
          cases/
          lab/
          writing/
        en/
          cases/
          lab/
          writing/
      assets/
        avatar.jpg
        diagrams/
        og/
        resumes/

  public/
    admin/
      config.yml

  scripts/
    create-profile.ts
    validate-profile.ts
    generate-pdf.ts
    generate-og.ts
    generate-admin-config.ts
    export-profile.ts

  docs/
    quickstart.md
    schema.md
    content-guide.md
    cms-guide.md
    deployment.md
    privacy.md
```

---

## 7. Profile Pack 设计

### 7.1 基本概念

一个人对应一个 Profile Pack：

```text
profiles/{profileId}/
```

例如：

```text
profiles/you/
profiles/ai-expert-demo/
profiles/product-leader-demo/
profiles/researcher-demo/
```

通过环境变量切换：

```bash
ACTIVE_PROFILE=you pnpm build
```

`.env` 示例：

```text
ACTIVE_PROFILE=you
DEFAULT_LOCALE=zh
PUBLIC_SITE_URL=https://example.com
```

### 7.2 Profile Pack 内容

```text
profile.yaml       基本信息
experience.yaml    工作经历
education.yaml     教育经历
skills.yaml        能力分层
roles.yaml         目标岗位与定向页
metrics.yaml       关键指标
home.yaml          首页 section 配置
theme.yaml         主题配置
resume.yaml        PDF 简历配置
content/           双语长内容
assets/            图片、图表、附件
```

---

## 8. 核心配置示例

### 8.1 `profile.yaml`

```yaml
id: "you"
name:
  zh: "你的名字"
  en: "Your Name"

headline:
  zh: "企业级 Agent 平台与大模型应用架构专家"
  en: "Agent Platform & LLM Application Architect"

summary:
  zh: "阿里 + 商汤背景，10 年工程经验，擅长将 LLM/Agent 从 Demo 落到企业核心流程。"
  en: "10 years of engineering experience across Alibaba and SenseTime, focused on turning LLM/Agent demos into reliable enterprise workflow products."

yearsOfExperience: 10

location:
  zh: "中国 / 可远程 / 可 relocation"
  en: "China / Remote / Open to relocation"

companies:
  - name: "Alibaba"
    type: "work"
  - name: "SenseTime"
    type: "work"

targetRoles:
  - id: "agent-platform"
    priority: 1
  - id: "llm-application-architect"
    priority: 2
  - id: "posttraining"
    priority: 3
  - id: "ai-fde"
    priority: 4

links:
  email: "name@example.com"
  github: "https://github.com/example"
  linkedin: "https://linkedin.com/in/example"
  maimai: ""
  huggingface: ""
  website: "https://example.com"

availability:
  status:
    zh: "开放高质量机会"
    en: "Open to high-quality opportunities"
  preferredLocations:
    - "Shanghai"
    - "Beijing"
    - "Hangzhou"
    - "Shenzhen"
  expectedPackage:
    zh: "100–200w RMB 年包"
    en: "RMB 1M–2M annual package"
```

### 8.2 `roles.yaml`

```yaml
roles:
  - id: "agent-platform"
    path: "agent-platform"
    title:
      zh: "Agent 平台架构师"
      en: "Agent Platform Architect"
    headline:
      zh: "我如何匹配 Agent 平台架构师岗位"
      en: "Why I fit Agent Platform Architect roles"
    focusAreas:
      - "Agent Runtime"
      - "Tool-use"
      - "LLMOps"
      - "Evaluation"
      - "Permission & Audit"
      - "Enterprise Integration"
    relatedCases:
      - "enterprise-agent-platform"
      - "ai-saas-workflow"
    relatedLabs:
      - "dpo-tool-use"
      - "eval-harness"

  - id: "posttraining"
    path: "posttraining"
    title:
      zh: "后训练应用算法专家"
      en: "Applied Post-training Algorithm Expert"
    headline:
      zh: "我如何从 Agent 应用切入后训练算法"
      en: "How I connect Agent applications with post-training"
    focusAreas:
      - "SFT"
      - "DPO"
      - "GRPO"
      - "RLVR"
      - "Data Flywheel"
      - "Evaluation Harness"
    relatedCases:
      - "posttraining-data-flywheel"
    relatedLabs:
      - "sft-agent"
      - "dpo-tool-use"
      - "grpo-agent"
```

### 8.3 `home.yaml`

```yaml
sections:
  - type: "hero"
    variant: "editorial"
  - type: "bento"
    variant: "expert-dashboard"
  - type: "targetRoles"
  - type: "featuredCases"
    limit: 3
  - type: "posttrainingLab"
    limit: 3
  - type: "proofWall"
  - type: "writing"
    limit: 3
  - type: "contact"
```

### 8.4 `theme.yaml`

```yaml
preset: "swiss-bento"

colors:
  background: "#F7F5F0"
  foreground: "#1F1F1F"
  muted: "#6F6F6F"
  border: "#DFDDD7"
  accent: "#355C7D"
  accentSoft: "#E6EEF5"

typography:
  sans: "Inter, Noto Sans SC, system-ui"
  mono: "JetBrains Mono, IBM Plex Mono, monospace"
  headingWeight: 600
  bodyWeight: 400

layout:
  maxWidth: "1120px"
  cardRadius: "20px"
  density: "comfortable"
  heroStyle: "editorial"
  dashboardStyle: "bento"

motion:
  enabled: true
  level: "subtle"
```

---

## 9. 页面与路由规划

### 9.1 公开页面

```text
/zh
/en
/zh/cv
/en/cv
/zh/work
/en/work
/zh/work/[slug]
/en/work/[slug]
/zh/lab
/en/lab
/zh/lab/[slug]
/en/lab/[slug]
/zh/writing
/en/writing
/zh/writing/[slug]
/en/writing/[slug]
/zh/stack
/en/stack
/zh/about
/en/about
/zh/contact
/en/contact
/zh/for/[role]
/en/for/[role]
```

### 9.2 系统导出页面

```text
/llms.txt
/profile.json
/cases.json
/lab.json
/sitemap.xml
/resumes/[file].pdf
```

### 9.3 管理后台

```text
/admin
```

后台应受 GitHub OAuth 与 Cloudflare Access 保护。

---

## 10. 首页设计

首页由 `home.yaml` 控制 section 顺序。

### 10.1 核心模块

```text
Hero
Bento Dashboard
Target Roles
Featured Cases
Post-training Lab Preview
Proof Wall
Writing Preview
Contact Panel
```

### 10.2 AI 专家版本 Hero 示例

中文：

```text
企业级 Agent 平台与大模型应用架构专家

阿里 + 商汤背景，10 年工程经验。
擅长将 LLM/Agent 从 Demo 落到企业核心流程，
建设可评测、可审计、可扩展的 Agent 系统与后训练数据闭环。
```

英文：

```text
Agent Platform & LLM Application Architect

10 years of engineering experience across Alibaba and SenseTime.
I build enterprise-grade Agent systems and post-training data loops
that turn LLM demos into reliable workflow products.
```

### 10.3 Bento 卡片配置示例

```yaml
bento:
  cards:
    - type: "metric"
      title:
        zh: "10 年"
        en: "10 Years"
      description:
        zh: "工程与 AI 落地经验"
        en: "Engineering and AI delivery experience"

    - type: "capability"
      title:
        zh: "Agent Platform"
        en: "Agent Platform"
      tags:
        - "Runtime"
        - "Tool-use"
        - "MCP"
        - "Eval"

    - type: "case"
      caseSlug: "enterprise-agent-platform"

    - type: "lab"
      labSlug: "dpo-tool-use"
```

---

## 11. Case Study 设计

每个案例是一个 MDX 文件。

推荐结构：

```text
Title
One-line result
Context
Problem
My Role
Architecture
Key Decisions
Implementation
Evaluation
Impact
Failure & Lessons
Artifacts
```

### 11.1 Case frontmatter 示例

```yaml
slug: "enterprise-agent-platform"
locale: "zh"
title: "企业级 Agent 平台"
summary: "建设可评测、可审计、可扩展的企业级 Agent Runtime 与工具调用体系。"
role: "架构设计 / 核心模块 / 评测体系 / 跨部门推进"
period: "2025"
confidentiality: "sanitized"
featured: true
tags:
  - "Agent Runtime"
  - "Tool-use"
  - "LLMOps"
  - "Evaluation"
targetRoles:
  - "agent-platform"
  - "llm-application-architect"
metrics:
  - label: "任务成功率"
    value: "+xx%"
    description: "脱敏展示，可在面试中展开。"
artifacts:
  - type: "diagram"
    title: "Agent Runtime Architecture"
    url: "/assets/diagrams/agent-runtime.svg"
    visibility: "public"
```

### 11.2 Case 正文模板

```mdx
## Context

描述业务背景、团队背景、技术约束和不可公开边界。

## Problem

明确原系统或原流程的问题。

## My Role

说明你的职责、决策权、协作对象和交付边界。

## Architecture

放架构图，并解释核心模块。

## Key Decisions

- 为什么这样设计。
- 有哪些替代方案。
- 最终取舍是什么。

## Evaluation

说明评测集、指标、线上反馈和回归机制。

## Impact

用脱敏指标说明业务影响和工程收益。

## Failure & Lessons

写失败复盘，体现专家可信度。
```

---

## 12. Lab 实验设计

Lab 用于展示后训练、评测、数据飞轮和实验能力。

### 12.1 Lab 类型

```text
SFT
DPO
GRPO
RLVR
Eval
Data Flywheel
```

### 12.2 Lab frontmatter 示例

```yaml
slug: "dpo-tool-use"
locale: "zh"
title: "DPO for Tool-use Preference"
method: "DPO"
summary: "用 chosen/rejected 偏好数据优化企业 Agent 的工具调用决策。"
featured: true
baseModel: "Qwen / Llama small model"
dataset:
  source: "Agent badcases and synthetic preference pairs"
  size: "2k pairs"
  format: "prompt / chosen / rejected"
evaluation:
  - "tool selection accuracy"
  - "task success rate"
  - "hallucination rate"
results:
  - metric: "win-rate"
    before: "baseline"
    after: "+xx%"
limitations:
  - "小规模实验，结果用于证明闭环能力，不代表生产级模型效果。"
relatedRoles:
  - "posttraining"
  - "agent-platform"
```

---

## 13. 双语维护策略

### 13.1 短字段

短字段在 YAML 中内置双语：

```yaml
headline:
  zh: "企业级 Agent 平台与大模型应用架构专家"
  en: "Agent Platform & LLM Application Architect"
```

适合：

```text
姓名
标题
摘要
按钮
SEO 描述
目标岗位
城市
联系状态
```

### 13.2 长内容

长内容分文件维护：

```text
content/zh/cases/enterprise-agent-platform.mdx
content/en/cases/enterprise-agent-platform.mdx
```

每篇内容带翻译状态：

```yaml
translationKey: "enterprise-agent-platform"
translationStatus: "reviewed"
lastReviewedAt: "2026-06-26"
```

状态值：

```text
draft
machine-translated
reviewed
complete
```

### 13.3 构建检查

构建时应检查：

```text
中文有，英文缺失：warning
英文有，中文缺失：warning
translationKey 不一致：error
translationStatus 为 draft：warning
```

---

## 14. `/admin` 在线维护后台

### 14.1 后台目标

维护者可以在手机或电脑上完成：

```text
改个人定位
改联系方式
改目标岗位
新增工作亮点
新增案例
更新 Lab 实验
上传架构图
编辑双语内容
发布后自动部署
```

### 14.2 推荐 CMS

V1 默认：

```text
Decap CMS
```

可选：

```text
Sveltia CMS
```

系统应把 CMS 看作可替换编辑层。底层数据仍然是 Git 中的 YAML / MDX。

### 14.3 后台集合

```text
Profile
Experience
Education
Skills
Roles
Metrics
Theme
Resume
Cases - zh
Cases - en
Lab - zh
Lab - en
Writing - zh
Writing - en
Assets
```

### 14.4 后台配置生成

因为 active profile 可切换，`public/admin/config.yml` 不应长期手写。建议由脚本生成：

```bash
pnpm generate:admin-config
```

读取：

```text
ACTIVE_PROFILE
profiles/{activeProfile}/...
```

输出：

```text
public/admin/config.yml
```

---

## 15. PDF 导出方案

### 15.1 目标

从同一份数据生成多种 PDF：

```text
中文通用简历
英文通用简历
Agent 平台架构师版本
后训练应用算法专家版本
AI FDE 版本
```

### 15.2 数据配置

`resume.yaml` 示例：

```yaml
resumes:
  - id: "general-cn"
    locale: "zh"
    title: "中文通用简历"
    fileName: "YourName_General_CN.pdf"
    sections:
      - summary
      - experience
      - selectedCases
      - skills
      - education
      - links

  - id: "agent-platform-cn"
    locale: "zh"
    title: "Agent 平台架构师方向"
    targetRole: "agent-platform"
    fileName: "YourName_Agent_Platform_CN.pdf"
    sections:
      - summary
      - experience
      - selectedCases
      - skills
      - education
      - links

  - id: "posttraining-en"
    locale: "en"
    title: "Applied Post-training Algorithm Expert"
    targetRole: "posttraining"
    fileName: "YourName_Posttraining_EN.pdf"
    sections:
      - summary
      - lab
      - experience
      - selectedCases
      - skills
      - education
      - links
```

### 15.3 生成流程

```text
YAML / MDX 数据
        ↓
/zh/cv?resume=agent-platform-cn
        ↓
Playwright print to PDF
        ↓
public/resumes/YourName_Agent_Platform_CN.pdf
```

### 15.4 验收要求

```text
A4 尺寸
可打印
ATS 友好
中英文各一份
角色版本可选
文件名专业
无乱码
无截断
```

---

## 16. AI 可读导出

### 16.1 `/profile.json`

自动生成结构化个人数据：

```json
{
  "name": "Your Name",
  "headline": "Agent Platform & LLM Application Architect",
  "yearsOfExperience": 10,
  "targetRoles": [
    "Agent Platform Architect",
    "LLM Application Architect",
    "Applied Post-training Algorithm Expert"
  ],
  "focusAreas": [
    "AI Agents",
    "LLMOps",
    "SFT",
    "DPO",
    "GRPO",
    "Enterprise AI"
  ],
  "featuredCases": [
    {
      "title": "Enterprise Agent Platform",
      "url": "/en/work/enterprise-agent-platform"
    }
  ],
  "contact": {
    "email": "name@example.com"
  }
}
```

### 16.2 `/llms.txt`

自动生成 Markdown 摘要：

```md
# Your Name

Agent Platform & LLM Application Architect with 10 years of engineering experience across Alibaba and SenseTime.

## Focus Areas

- Enterprise Agent Platform
- LLM Application Architecture
- LLMOps
- Post-training Data Flywheel
- SFT / DPO / GRPO

## Key Pages

- CV: /en/cv
- Agent Platform Case: /en/work/enterprise-agent-platform
- Post-training Lab: /en/lab
- Contact: /en/contact
```

---

## 17. 权限与隐私

### 17.1 内容可见性

每个内容对象可配置：

```text
public
sanitized
private
```

逻辑：

| visibility | 行为 |
|---|---|
| public | 公开展示。 |
| sanitized | 脱敏展示，隐藏客户名、绝对指标、内部细节。 |
| private | 默认不出现在公开站，可选生成私密页。 |

### 17.2 私密页策略

V1 建议：

```text
private 内容不进入公开构建
需要时生成单独 PDF 或面试现场展示
```

V2 可选：

```text
/private/[slug]
Cloudflare Access 保护
```

### 17.3 后台保护

建议两层：

```text
CMS GitHub OAuth
Cloudflare Access for /admin
```

---

## 18. 搜索与导航

### 18.1 搜索

使用 Pagefind 生成静态搜索索引。

搜索范围：

```text
Case Study
Lab
Writing
CV
Stack
```

### 18.2 导航

PC 端：

```text
顶部导航 + 页面内目录
```

移动端：

```text
简洁顶部导航 + Sticky CTA
```

核心 CTA：

```text
Download CV
View Work
View Lab
Contact
English / 中文
```

---

## 19. 响应式设计

### 19.1 断点

```text
< 640px       Mobile
640–1024px    Tablet
1024–1440px   Desktop
> 1440px      Wide Desktop
```

### 19.2 Mobile 重点

移动端优先支持：

```text
快速识别身份
快速查看目标岗位
快速下载 PDF
快速联系
快速切换语言
案例分段折叠
架构图全屏查看
```

### 19.3 PC 重点

PC 端优先支持：

```text
案例深读
文档式目录
架构图展示
指标卡片
Lab 实验细节
文章阅读
```

---

## 20. 质量标准

### 20.1 构建质量

必须通过：

```text
TypeScript check
Zod schema validation
Astro check
ESLint
Prettier
Markdown lint
Broken link check
```

### 20.2 性能目标

```text
Lighthouse Performance >= 90
Accessibility >= 95
SEO >= 95
LCP < 2.5s
INP < 200ms
CLS < 0.1
```

### 20.3 内容质量

构建时应输出内容诊断：

```text
缺失英文翻译
缺失 SEO 描述
缺失 targetRoles
缺失 featured case
图片路径不存在
private 内容被错误引用
PDF 配置引用不存在的 section
```

---

## 21. CLI 设计

### 21.1 命令列表

```bash
pnpm dossier create-profile
pnpm dossier validate
pnpm dossier generate-admin-config
pnpm dossier generate-pdf
pnpm dossier generate-og
pnpm dossier export-profile
```

### 21.2 `create-profile`

交互式创建新人数据包：

```text
Profile name?
Default locale?
Profile type?
Target roles?
Theme preset?
Generate example content? yes/no
```

输出：

```text
profiles/{profileId}/...
```

### 21.3 `validate`

检查：

```text
YAML schema
MDX frontmatter
翻译状态
slug 唯一性
role 引用
case 引用
asset 路径
resume 配置
visibility 规则
```

### 21.4 `export-profile`

将某个 profile pack 打包：

```text
exports/{profileId}-profile-pack.zip
```

用途：

```text
迁移
分享
备份
模板示例
```

---

## 22. 实施路线图

### Phase 1：核心模板

目标：站点能跑，数据能渲染。

任务：

```text
创建 Astro + Tailwind 项目
建立 profile pack 目录
实现 profile loader
实现 Zod schema
实现双语路由
实现首页、CV、Work、Case Detail、Lab、Contact
```

验收：

```text
pnpm dev 可运行
pnpm build 成功
/zh 和 /en 可访问
至少一个 case 和一个 lab 可渲染
```

### Phase 2：配置化与主题

目标：页面模块和主题由配置控制。

任务：

```text
实现 home.yaml section renderer
实现 theme.yaml tokens
实现 Bento Dashboard
实现角色定向页 /for/[role]
```

验收：

```text
调整 home.yaml 可改变首页模块顺序
调整 theme.yaml 可改变颜色、圆角、布局密度
/zh/for/agent-platform 可由 roles.yaml 自动生成
```

### Phase 3：在线维护后台

目标：通过 `/admin` 维护内容。

任务：

```text
接入 Decap CMS
实现 admin index.html
实现 config.yml
实现 generate-admin-config 脚本
配置 profile/cases/lab/writing/assets 集合
```

验收：

```text
/admin 可打开
能编辑 profile.yaml
能新增 case.mdx
能上传图片
保存后产生 Git commit 或 PR
```

### Phase 4：导出能力

目标：一次维护，多格式输出。

任务：

```text
生成 PDF 简历
生成 profile.json
生成 llms.txt
生成 sitemap
生成 Pagefind search index
```

验收：

```text
/resumes/*.pdf 存在
/profile.json 合法
/llms.txt 可访问
搜索可用
```

### Phase 5：模板复用与文档

目标：别人可以 fork 使用。

任务：

```text
实现 create-profile CLI
实现 validate CLI
补 docs
补 example profiles
补 README
```

验收：

```text
新用户可以在 10 分钟内跑起来
替换 profile pack 后不需要改页面代码
```

---

## 23. Codex 实现任务书

### 23.1 给 Codex 的总目标

```text
请实现 DossierKit：一个 Astro + TypeScript + Tailwind + MDX + YAML 的双语、数据驱动、Git-backed CMS-enabled 个人专家档案模板系统。

核心要求：
1. 所有个人信息来自 profiles/{ACTIVE_PROFILE}。
2. 支持中文和英文路由。
3. 支持首页、CV、Work、Case Detail、Lab、Writing、Role Pages、Contact。
4. 支持 /admin 在线维护，默认 Decap CMS。
5. 支持从同一份数据生成 PDF 简历、profile.json、llms.txt。
6. 支持 schema 校验和示例 profile。
7. 模板代码中不得写死具体个人信息。
```

### 23.2 Codex 实现约束

```text
- 使用 TypeScript。
- 使用 Astro Content Collections 或自定义 loader + Zod。
- 使用 Tailwind CSS。
- 使用 pnpm。
- 不引入数据库。
- 不引入需要后端常驻服务的依赖。
- 不在代码中硬编码个人履历。
- 所有 profile 数据来自 profiles/{ACTIVE_PROFILE}。
- 所有长内容用 MDX。
- 所有配置用 YAML。
- 每个阶段完成后确保 pnpm build 通过。
```

### 23.3 推荐 Codex 分批任务

#### Task 1：初始化项目

```text
初始化 Astro + TypeScript + Tailwind 项目，建立基础目录结构、layout、全局样式、配置读取工具。
```

验收：

```text
pnpm install
pnpm dev
pnpm build
```

#### Task 2：实现 Profile Loader 与 Schema

```text
实现 profiles/{ACTIVE_PROFILE} 读取逻辑，并用 Zod 校验 profile、experience、skills、roles、theme、resume。
```

验收：

```text
ACTIVE_PROFILE=default pnpm validate 成功
缺字段时 validate 给出清晰错误
```

#### Task 3：实现双语路由

```text
实现 /zh 和 /en 页面，支持 localized string 读取与语言切换。
```

验收：

```text
/zh 首页显示中文
/en 首页显示英文
语言切换链接正确
```

#### Task 4：实现基础页面

```text
实现首页、CV、Work、Case Detail、Lab、Lab Detail、Contact。
```

验收：

```text
example case 可渲染
example lab 可渲染
CV 页面可渲染
```

#### Task 5：实现配置化首页和角色页

```text
实现 home.yaml section renderer；实现 roles.yaml 生成 /for/[role] 页面。
```

验收：

```text
修改 home.yaml 可改变首页模块顺序
/zh/for/agent-platform 自动读取 role 配置
```

#### Task 6：接入 CMS

```text
接入 Decap CMS，提供 /admin，配置 profile、cases、lab、writing、assets 集合。
```

验收：

```text
/admin 可打开
CMS 配置路径指向当前 active profile
```

#### Task 7：实现导出

```text
实现 generate-pdf、profile.json、llms.txt、sitemap、search index。
```

验收：

```text
/resumes/*.pdf 存在
/profile.json 可访问
/llms.txt 可访问
搜索可用
```

#### Task 8：模板复用能力

```text
实现 create-profile、validate、export-profile CLI；补 README 和 docs。
```

验收：

```text
pnpm dossier create-profile 可创建新 profile pack
ACTIVE_PROFILE=newProfile pnpm build 成功
```

---

## 24. Definition of Done

项目达到可交付状态必须满足：

```text
1. pnpm install 成功。
2. pnpm dev 可启动。
3. pnpm build 成功。
4. ACTIVE_PROFILE=default 可构建。
5. 至少包含一个完整示例 profile pack。
6. /zh 和 /en 首页可访问。
7. CV、Work、Lab、Contact 可访问。
8. /for/[role] 可由 roles.yaml 自动生成。
9. /admin 可访问并显示 CMS 后台。
10. validate 命令可检查 schema。
11. PDF 简历可生成。
12. /profile.json 可生成。
13. /llms.txt 可生成。
14. README 包含快速开始。
15. docs 包含配置、内容、部署、CMS、隐私说明。
16. 模板代码中没有写死个人信息。
```

---

## 25. V1 范围边界

### V1 必须做

```text
Astro + Tailwind + TypeScript
Profile Pack
双语路由
首页
CV
Work / Case Detail
Lab / Lab Detail
Contact
Role Pages
Decap CMS /admin
Schema validation
PDF export
profile.json
llms.txt
README + docs
```

### V1 不做

```text
自研数据库后台
多人在线协作后台
AI 聊天助手
复杂私密内容权限系统
在线主题编辑器
Notion 双向同步
动态 Dashboard
复杂 3D 动效
```

---

## 26. 风险与规避

| 风险 | 规避方案 |
|---|---|
| CMS 配置与 ACTIVE_PROFILE 不一致 | 用脚本生成 `public/admin/config.yml`。 |
| 双语内容维护复杂 | 短字段内置双语，长内容分文件，并做 translationStatus 校验。 |
| PDF 与网页样式不一致 | 使用专门的 print CSS 和 CV 页面模板。 |
| 模板过度定制导致不可复用 | 个人信息绝不写进组件，只从 profile pack 读取。 |
| 敏感项目泄露 | 默认支持 visibility 字段，private 不进入公开构建。 |
| 移动端后台不好用 | Decap 默认，Sveltia 可选；核心维护字段表单化。 |
| 构建失败难定位 | validate 输出明确错误路径和字段名。 |

---

## 27. 后续 V2 方向

```text
在线 profile pack 生成器
Notion / LinkedIn / GitHub 导入器
私密案例页访问码
多 profile 管理
AI 辅助写 Case Study
自动生成投递页
简历版本 A/B 测试
访问分析 Dashboard
主题市场
模板开源文档站
```

---

## 28. 最终总结

DossierKit 的核心价值是：

```text
内容全部数据化
页面全部配置化
后台全部表单化
发布全部自动化
导出全部自动生成
换人只换 Profile Pack
```

推荐最终技术方案：

```text
Astro + TypeScript + Tailwind + MDX + YAML
+ Zod schema validation
+ Decap CMS / Sveltia CMS
+ GitHub as content source
+ Cloudflare Pages deployment
+ Playwright PDF export
+ Pagefind search
+ profile.json / llms.txt export
```

交给 Codex 实现时，应按阶段推进：

```text
1. 项目初始化
2. Profile Loader + Schema
3. 双语路由
4. 页面与组件
5. 配置化首页和角色页
6. CMS 后台
7. PDF / JSON / llms.txt 导出
8. CLI 与文档
```

最终交付不应只是一个个人网站，而是一套可长期维护、可复用、可分享、可导出的**专家档案基础设施**。
