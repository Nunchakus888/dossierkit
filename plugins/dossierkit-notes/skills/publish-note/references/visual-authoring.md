# Visual and technical authoring

Use this reference when a note needs a cover, body diagram, mathematical expression, protocol sample, or substantial code comparison. Apply the global authoring constraints in SKILL.md first.

## Establish the explanatory purpose

Ask what becomes easier to understand when the reader sees relationships, branching, timing, or spatial organization. A body visual should make an otherwise abstract mechanism concrete, not repaint a paragraph, list, or table as a set of labeled boxes. Ordinary prose that already communicates the point needs no additional illustration. "Illustrated" does not imply a minimum number of pictures.

For content that benefits from structured explanation, the preference is **Mermaid > Table > SVG > Text**. Choose the first suitable form, not the first form that is merely possible. A parameter matrix fits a table better than a flowchart; a single definition fits prose better than a diagram. Keep one primary representation per relationship and put only interpretation, assumptions, or evidence in adjacent prose.

## Design the scan path first

The first screen should not be a wall of prose. After the direct thesis and 3–5 takeaways, place at most one primary diagram or table when it explains the core relationship faster than text. Do not put a decorative visual there just to break up paragraphs.

A reader who scans only headings, bold lead-ins, and structured elements should recover the argument. If several visible paragraphs repeat a relationship that could be read from one table or diagram, compress or move the support into progressive disclosure. Key evidence limits remain visible beside the claim they constrain.

## Select one effective representation

| Order | Question or relationship | Preferred representation |
|---|---|---|
| 1. Mermaid | Consequential branches, dependencies, responsibility boundaries, or data movement | Compact `flowchart` with labeled edges |
| 1. Mermaid | Who calls whom, what is returned, and when execution resumes | `sequenceDiagram` with the important return or failure path |
| 1. Mermaid | Task, approval, repair, or recovery transitions | `stateDiagram-v2` or a branching flowchart |
| 2. Table | Aligned comparisons, parameter mappings, conditions, or exact values | A compact table with consistent columns |
| 3. SVG | Spatial or conceptual mechanisms that Mermaid and a table cannot explain clearly | A bespoke body SVG asset |
| 4. Text | Simple definitions, conclusions, qualifications, or a readable fallback | Concise prose; a minimal code or wire sample when syntax is the subject |
| Separate cover requirement | Topic recognition in search/social sharing previews | Topic-specific `cover.svg`, rendered to PNG by the site |

Prefer `flowchart TB` for long flows and vertical reading. Use a sequence diagram for call/return semantics; split an oversized diagram at a meaningful boundary rather than shrinking its text. Keep diagram labels short and edges meaningful. Include rejection, timeout, retry, or recovery branches only where they matter to the argument. Prefer a few well-labeled states to a wide poster filled with paragraphs. Check mobile legibility and preserve intrinsic aspect ratio; do not force a narrow diagram to a minimum width. Explain the key consequence instead of narrating every arrow.

DossierKit Markdown supports Mermaid code fences. For semantic HTML, use `<pre><code class="language-mermaid">…</code></pre>`. Keep Mermaid source in the document rather than duplicating it as an SVG asset. If a rendering path is unavailable, choose a useful table or concise prose rather than storing a second copy of the same diagram.

The Markdown/MDX path can preserve supported MathML markup. The current semantic HTML sanitizer does not preserve MathML elements, so choose an accessible prose, table, or code representation for HTML notes unless the server contract changes and the rendering path is verified.

## Escalate media only when it improves explanation

Plain prose is the default for a simple definition or conclusion. A table handles exact values or aligned differences; Mermaid handles branches, state, responsibility, and calls. Their ordering is a fit test, not a universal superiority claim. A body SVG is for a mechanism the other static forms cannot show well. Each relation has one main representation, with prose for implications and caveats rather than label-by-label repetition.

Distinguish reading interaction from computational interaction. Supported native details/summary can disclose supplementary evidence without custom JavaScript. Keep the central argument, critical assumptions, and failure limits visible. A simulation needs a meaningful input, an explicit rule or model, an observable output, reset behavior, and at least one boundary test. Clearly distinguish sample or simulated data from measured results. Animation without a testable relationship is not a simulation.

The current Markdown and semantic HTML pipelines reject active scripts; semantic HTML also rejects inline styles and form controls. Keep that security boundary intact. A richer explainer is a separate, reviewed, authorized deployment or attachment linked from a canonical static note, with a useful static fallback. Do not insert script, iframe, remote executable dependencies, or secret keys into note content, and do not change the sanitizer merely to satisfy an output-format suggestion.

Video is optional, not a new default deliverable. Use it when timing, continuous transformation, or spatial change is essential and the user authorizes the production cost. Review the storyboard before rendering; then verify the agreement of narration, labels, equations, and animation. Include captions, a transcript, playback controls, and an appropriate description of meaningful visual information. Use reduced-motion alternatives where applicable. Confirm an available production tool before promising a generated video, and keep service credentials out of artifacts. The [W3C media planning guide](https://www.w3.org/WAI/media/av/planning/) is the accessibility reference.

Check actual supported rendering on mobile and desktop before reporting it verified. A requested HTML format does not automatically imply a working application, and a screenshot does not verify an interaction. Model self-review is not evidence of improved human understanding. Keep the independent Open Graph cover requirement unchanged.

## SVG asset contract

Use lowercase letters, digits, and hyphens in flat filenames. Each name begins with a letter and ends in `.svg`. A note may contain at most 8 SVG files, each up to 100 KB and 400 KB in total. These are capacity limits, not illustration targets.

Each SVG has one root element:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">
  <title>A readable description</title>
  ...
</svg>
```

`cover.svg` uses `viewBox="0 0 1200 630"`. This is DossierKit's sharing-image contract, not a universal size mandated by the Open Graph protocol. Other SVGs may be up to 2400x2400. When width and height are present, they match the viewBox. Keep generous margins, short labels, and a stable `Noto Sans CJK SC, sans-serif` font stack.

The accepted static vocabulary is:

- shapes: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`;
- structure and text: `g`, `text`, `tspan`, `title`, `desc`;
- local definitions: `defs`, linear or radial gradients, markers, and clip paths;
- presentation attributes such as fill, stroke, opacity, transform, and font attributes.

Produce self-contained static artwork. The server accepts local typed references and built-in XML entities. It rejects active behavior, embedded or external media, remote resources, CSS blocks, inline style attributes, document declarations, custom entities, nested SVG, and unsupported elements.

The root `<title>` states the image's accessible meaning. Body image alt text states what the reader should learn from the image. Keep the full source in the `assets` map and use only a direct `asset:name.svg` image reference in the document.

## Open Graph cover: a separate publication requirement

The cover is the default image deliverable even when the body needs no pictures. Keep it sharing-only unless body placement adds independent value. A request to simplify body images does not remove the cover. During body-only edits, preserve a suitable existing cover and its ownership.

Make the cover topic-specific and legible at sharing-card size. Use one dominant visual idea, a short title, clear hierarchy, restrained color, and sufficient whitespace. Align the visual metaphor with the opening proposition and technical mechanism. Do not use a screenshot of the article or a miniature table/diagram filled with body text as the cover.

DossierKit accepts `cover.svg` as the editable source and generates one public 1200x630 PNG for previews. The author supplies the SVG, not a second PNG or base64 payload. Before reporting publication, verify:

- The article has coherent `og:title`, `og:type`, `og:url`, `og:description`, and `og:image`; the canonical page identity is unchanged on edits.
- `og:image` is an absolute public HTTPS URL. An unauthenticated request succeeds with actual PNG bytes and `image/png`, not an HTML login or error page.
- `og:image:width` and `og:image:height` match the actual 1200x630 image; `og:image:type` and meaningful `og:image:alt` are present. Use the site's existing under-2-MB cover check.
- `twitter:card` is `summary_large_image`; `twitter:image` points to the same generated cover and its alt text is present. Inspect the preview at a small display size.

The Open Graph protocol defines metadata for rich sharing; 1200x630 and PNG are this site's chosen interoperability contract. Do not claim that adding a cover guarantees a search-ranking improvement. Verify protocol fields against the [Open Graph specification](https://ogp.me/) and the site's existing cover checks.

## Code and protocol samples

Compare the same task, input, and abstraction level. Show the smallest old behavior and the smallest new behavior, then identify whether the change belongs to the wire contract, state ownership, execution model, or application policy.

Use current official schemas and SDK documentation. Mark framework-neutral reference logic and pseudocode explicitly. Include the relevant identity, authorization, idempotency, concurrency, expiry, retry, and failure behavior. Explain the assumptions that make the code valid.
