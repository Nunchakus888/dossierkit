# Codex Implementation Prompt: DossierKit

You are Codex working in a new repository. Implement **DossierKit**, a data-driven, bilingual, Git-backed personal expert dossier template system.

## Product Goal

Build a reusable expert-profile website template. It must allow a user to replace only a `profiles/{profileId}` folder to generate a complete bilingual expert dossier website, including web pages, role-specific pages, PDF resumes, `profile.json`, and `llms.txt`.

The first target persona is an AI / Agent / LLM expert, but the system must be generic enough for engineers, researchers, product leaders, consultants, and founders.

## Core Requirements

1. Use Astro + TypeScript + Tailwind CSS.
2. Use YAML for structured config and MDX for long-form content.
3. Use `ACTIVE_PROFILE` to select the active profile pack.
4. Do not hard-code personal data in components or pages.
5. Support `/zh` and `/en` routes.
6. Support pages:
   - `/[locale]`
   - `/[locale]/cv`
   - `/[locale]/work`
   - `/[locale]/work/[slug]`
   - `/[locale]/lab`
   - `/[locale]/lab/[slug]`
   - `/[locale]/writing`
   - `/[locale]/writing/[slug]`
   - `/[locale]/for/[role]`
   - `/[locale]/contact`
7. Support `/admin` via Decap CMS initially.
8. Support generation of:
   - PDF resumes
   - `/profile.json`
   - `/llms.txt`
   - sitemap
   - static search index
9. Include schema validation using Zod.
10. Include at least one high-quality example profile pack.
11. Include CLI scripts:
    - create-profile
    - validate-profile
    - generate-admin-config
    - generate-pdf
    - export-profile
12. Include documentation.

## Recommended Tech Stack

- Astro
- TypeScript
- Tailwind CSS
- MDX
- YAML parser
- Zod
- Decap CMS
- Playwright for PDF export
- Pagefind for static search
- pnpm

Do not introduce a database or long-running backend service.

## Target Repository Structure

```text
dossierkit/
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

## Implementation Phases

### Phase 1: Scaffold

Set up Astro, TypeScript, Tailwind, layouts, global styles, routing skeleton, and default profile pack.

Acceptance criteria:

```bash
pnpm install
pnpm dev
pnpm build
```

Both `/zh` and `/en` should render.

### Phase 2: Profile Loader and Schema

Implement:

- `src/lib/config.ts`
- `src/lib/profile-loader.ts`
- `src/lib/schema.ts`
- Zod schemas for profile, experience, skills, roles, theme, resume, case, lab, writing.

Acceptance criteria:

```bash
ACTIVE_PROFILE=default pnpm validate
```

Validation must provide clear errors for missing fields.

### Phase 3: Bilingual Rendering

Implement localized string helpers and language switching.

Acceptance criteria:

- `/zh` displays Chinese content.
- `/en` displays English content.
- Links preserve equivalent route across languages where possible.

### Phase 4: Pages and Components

Implement:

- Hero
- BentoDashboard
- ExperienceTimeline
- CaseCard
- LabCard
- RoleFitPanel
- ProofWall
- ContactPanel
- CV page
- Work list and detail
- Lab list and detail
- Writing list and detail
- Contact page

Acceptance criteria:

- Example case renders at `/zh/work/enterprise-agent-platform`.
- Example lab renders at `/zh/lab/dpo-tool-use`.
- CV page renders at `/zh/cv`.

### Phase 5: Config-driven Home and Role Pages

Use `home.yaml` to render homepage sections. Use `roles.yaml` to generate role-specific pages.

Acceptance criteria:

- Reordering `home.yaml` changes homepage order.
- `/zh/for/agent-platform` is generated from config.
- `/en/for/posttraining` is generated from config.

### Phase 6: CMS Admin

Implement `/admin` with Decap CMS.

Acceptance criteria:

- `/admin` loads.
- CMS can edit `profile.yaml`.
- CMS can create Chinese and English case MDX files.
- CMS can upload assets.
- `generate-admin-config` supports `ACTIVE_PROFILE`.

### Phase 7: Exports

Implement:

- `profile.json`
- `llms.txt`
- PDF resume generation with Playwright
- sitemap generation
- Pagefind static search

Acceptance criteria:

- `/profile.json` returns valid JSON.
- `/llms.txt` returns Markdown text.
- PDF files are generated under `public/resumes` or final build output.
- Search works without a database.

### Phase 8: CLI and Documentation

Implement CLI commands and docs.

Acceptance criteria:

```bash
pnpm dossier create-profile
pnpm dossier validate
pnpm dossier generate-admin-config
pnpm dossier generate-pdf
pnpm dossier export-profile
```

Docs required:

- quickstart
- schema reference
- content writing guide
- CMS guide
- deployment guide
- privacy guide

## Data Model Highlights

### profile.yaml

```yaml
id: "default"
name:
  zh: "你的名字"
  en: "Your Name"
headline:
  zh: "企业级 Agent 平台与大模型应用架构专家"
  en: "Agent Platform & LLM Application Architect"
summary:
  zh: "阿里 + 商汤背景，10 年工程经验。"
  en: "10 years of engineering experience across Alibaba and SenseTime."
yearsOfExperience: 10
links:
  email: "name@example.com"
  github: "https://github.com/example"
  linkedin: "https://linkedin.com/in/example"
```

### roles.yaml

```yaml
roles:
  - id: "agent-platform"
    path: "agent-platform"
    title:
      zh: "Agent 平台架构师"
      en: "Agent Platform Architect"
    focusAreas:
      - "Agent Runtime"
      - "Tool-use"
      - "LLMOps"
      - "Evaluation"
    relatedCases:
      - "enterprise-agent-platform"
    relatedLabs:
      - "dpo-tool-use"
```

### Case MDX frontmatter

```yaml
slug: "enterprise-agent-platform"
locale: "zh"
title: "企业级 Agent 平台"
summary: "建设可评测、可审计、可扩展的企业级 Agent Runtime。"
role: "架构设计 / 核心模块 / 评测体系"
confidentiality: "sanitized"
featured: true
tags:
  - "Agent Runtime"
  - "Tool-use"
targetRoles:
  - "agent-platform"
```

## Quality Bar

The project is done only when:

1. `pnpm build` passes.
2. `pnpm validate` passes.
3. `/zh` and `/en` work.
4. `/admin` works.
5. `ACTIVE_PROFILE=default` works.
6. Example profile has at least one case and one lab experiment.
7. Role pages are generated from config.
8. No personal data is hard-coded outside profile packs.
9. PDF export works.
10. `profile.json` and `llms.txt` are generated.
11. Documentation explains how to fork, configure, maintain, and deploy.

## Non-goals for V1

Do not implement:

- Database-backed CMS
- Custom authentication server
- AI chatbot
- Dynamic analytics dashboard
- Notion bi-directional sync
- Multi-user collaboration
- Complex 3D animations
- Marketplace or SaaS hosting

Focus on a clean, maintainable, reusable static template system.
