# Schema Reference

All profile data lives under `profiles/{profileId}` and is validated by Zod in `src/lib/schema.ts`.

## Required YAML files

- `profile.yaml`: identity, headline, links, target roles, availability.
- `experience.yaml`: work history with bilingual roles, summaries, and highlights.
- `education.yaml`: education records.
- `skills.yaml`: grouped skills and capability descriptions.
- `roles.yaml`: target role pages and related case/lab references.
- `metrics.yaml`: homepage metrics for the dashboard.
- `theme.yaml`: color, typography, layout, and motion tokens.
- `resume.yaml`: PDF resume sections and highlights.
- `home.yaml`: homepage section order.
- `navigation.yaml`: brand mark, menu labels, paths, icons, and placement.
- `design.yaml`: hero copy, segmented title colors, quick links, contact strip, and visual style.

## Localized strings

Short bilingual fields use:

```yaml
headline:
  zh: "企业级 Agent 平台与大模型应用架构专家"
  en: "Agent Platform & LLM Application Architect"
```

## MDX content

Long-form content lives in:

```text
profiles/{profileId}/content/{locale}/cases
profiles/{profileId}/content/{locale}/lab
profiles/{profileId}/content/{locale}/writing
profiles/{profileId}/content/{locale}/notes
```

Common frontmatter:

```yaml
slug: "enterprise-agent-platform"
locale: "zh"
translationKey: "enterprise-agent-platform"
translationStatus: "reviewed"
title: "企业级 Agent 平台"
summary: "建设可评测、可审计、可扩展的企业级 Agent Runtime。"
featured: true
tags:
  - "Agent Runtime"
targetRoles:
  - "agent-platform"
```

Notes add `date`, `updatedAt`, `kind`, `topics`, and `contentHash`. Their filename and frontmatter slug must match. New notes should enter through the canonical `save_note` MCP action documented in `docs/notes-mcp.md`; the service owns slug generation and file placement.

Run `pnpm validate` after editing. Missing required fields fail the build with file paths and field names.
