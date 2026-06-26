# Content Writing Guide

DossierKit is designed for expert evaluation, not decorative portfolio copy.

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

Write cases with sanitized but specific evidence:

- system boundary
- constraints
- ownership
- alternatives considered
- metrics or qualitative proof
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
