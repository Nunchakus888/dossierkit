# DossierKit Content Voice

This repository publishes outward-facing career material for recruiters, hiring managers, CEOs, partners, and senior technical evaluators.

Use a public, professional voice:

- Write as external presentation copy, not internal notes or self-review.
- Prefer concise active statements such as "负责", "主导", "建设", "沉淀", "交付", "owned", "led", "built", and "delivered".
- Avoid first-person pronouns unless a long-form narrative explicitly requires them.
- Avoid incomplete-status language such as "待补", "后续补", "当前短板", "真实项目待补充", "for now", or "to be filled".
- Avoid self-justifying language such as "不是 demo", "不是算法负责人", "不需要包装", or "不作为主线". Convert it into positive scope statements.
- Avoid addressing the reader as an interviewer or evaluator. Use "适合沟通", "可展开讨论", "evidence includes", or "discussion areas" instead.
- Keep one strategic positioning: enterprise Agent platform architecture. Past Alibaba and SenseTime experience should support this positioning, not create scattered target directions.
- Sanitized metrics are acceptable; missing metrics should be omitted from public pages rather than called out as missing.

Before committing content changes, scan public content for placeholder or internal wording: `demo`, `example`, `待补`, `后续`, `短板`, `面试官`, `不需要`, `不作为`, `not a demo`, `to be filled`.

## Public UI actions

Use the shared `IconAction` for familiar utility actions (share, copy, language, contact, download, print, back, zoom, close). Keep utility chrome icon-first, neutral, and quiet. Remove redundant action headings and explanatory prose. Retain meaningful navigation labels and content titles where an icon would be ambiguous. Every icon-only action needs a localized accessible name and hover title, visible keyboard focus, and a 44px touch target. Success feedback may be a temporary check mark with a live-region announcement; keep a usable fallback when an operation fails. Do not change collection semantics, metrics, content, or destinations during visual-only changes.

Language switches resolve published counterparts by translationKey or slug at build time; missing translations keep the reader on the current page with a compact choice of original or target-language index. Keep an actual, valid fallback href for no-JS and modified clicks. Share utilities align right. The site wordmark uses the existing Pacifico signature face; do not add a second font library. Mermaid previews preserve intrinsic aspect ratio and never upscale narrow diagrams to a fixed minimum width.
