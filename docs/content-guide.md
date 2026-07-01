# Content Writing Guide

DossierKit is designed for expert evaluation, not decorative portfolio copy.

## Public Voice

All profile content is outward-facing. The audience is recruiters, hiring managers, CEOs, potential partners, and senior technical evaluators.

Write in a professional presentation voice:

- Prefer active, outcome-based statements: `负责`, `主导`, `建设`, `沉淀`, `交付`, `owned`, `led`, `built`, `delivered`.
- Avoid first-person pronouns in profile pages and case studies unless a long-form narrative explicitly requires them.
- Do not publish internal planning language such as `待补`, `后续补`, `当前短板`, `真实项目待补充`, `for now`, or `to be filled`.
- Do not use defensive positioning such as `不是 demo`, `不需要包装`, `不作为主线`, or `not a demo`. State the production scope positively.
- Keep one strategic narrative: enterprise Agent platform architecture. Earlier Alibaba and SenseTime work should support this positioning.
- Omit missing details from public pages. Track them privately or phrase them as neutral discussion areas.

## Case Study

Recommended structure:

```mdx
## Context
## Problem
## My Role
## Architecture
## Key Decisions
## Evaluation
## Impact
## Failure & Lessons
```

Write cases with sanitized but specific signals:

- system boundary
- constraints
- ownership
- alternatives considered
- metrics or qualitative signals
- lessons from failures

## Lab

Use Lab entries for experiments, evaluation, data loops, and model/product learning. Include:

- hypothesis
- dataset shape
- evaluation method
- result
- limitation

## Writing

Use Writing entries for method notes, retrospectives, and reusable thinking. Keep them linked to target roles when possible.

## Translation

Use the same `slug` and `translationKey` across Chinese and English versions. Set `translationStatus` to one of:

- `draft`
- `machine-translated`
- `reviewed`
- `complete`
