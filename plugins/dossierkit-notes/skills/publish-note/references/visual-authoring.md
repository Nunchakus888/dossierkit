# Visual and technical authoring

Use this reference when a note needs a cover, body diagram, mathematical expression, protocol sample, or substantial code comparison.

## Select one effective representation

| Relationship | Preferred representation |
|---|---|
| Three or more exact mappings or responsibility boundaries | Table |
| Components and data flow | Mermaid `flowchart` with responsibility subgraphs |
| Client, runtime, and server interaction | Mermaid `sequenceDiagram` |
| Task, session, approval, or recovery lifecycle | Mermaid `stateDiagram-v2` |
| Version evolution or event order | Mermaid `timeline` or a small flowchart |
| Topic identity and sharing preview | `cover.svg` asset |
| Bespoke spatial explanation that Mermaid cannot express clearly | Body SVG asset |
| Mathematical hierarchy | MathML only in a verified compatible format |
| Behavioral or protocol change | Minimal old/new code or wire sample |

One visual should answer one question. Label actual objects passed across boundaries, include consequential rejection, timeout, or recovery paths, and explain the resulting engineering judgment in adjacent text.

DossierKit Markdown supports Mermaid code fences. For semantic HTML, use `<pre><code class="language-mermaid">…</code></pre>`. Keep Mermaid source in the document rather than duplicating it as an SVG asset.

The Markdown/MDX path can preserve supported MathML markup. The current semantic HTML sanitizer does not preserve MathML elements, so choose an accessible prose, table, or code representation for HTML notes unless the server contract changes and the rendering path is verified.

## SVG asset contract

Use lowercase letters, digits, and hyphens in flat filenames. Each name begins with a letter and ends in `.svg`. A note may contain at most 8 SVG files, each up to 100 KB and 400 KB in total.

Each SVG has one root element:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">
  <title>A readable description</title>
  ...
</svg>
```

`cover.svg` uses `viewBox="0 0 1200 630"`. Other SVGs may be up to 2400×2400. When width and height are present, they match the viewBox. Keep generous margins, short labels, and a stable `Noto Sans CJK SC, sans-serif` font stack.

The accepted static vocabulary is:

- shapes: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`;
- structure and text: `g`, `text`, `tspan`, `title`, `desc`;
- local definitions: `defs`, linear or radial gradients, markers, and clip paths;
- presentation attributes such as fill, stroke, opacity, transform, and font attributes.

Produce self-contained static artwork. The server accepts local typed references and built-in XML entities. It rejects active behavior, embedded or external media, remote resources, CSS blocks, inline style attributes, document declarations, custom entities, nested SVG, and unsupported elements.

The root `<title>` states the image's accessible meaning. Body image alt text states what the reader should learn from the image. Keep the full source in the `assets` map and use only a direct `asset:name.svg` image reference in the document.

## Cover composition

Make the cover topic-specific and legible at sharing-card size. Use one dominant idea, a short title, clear hierarchy, restrained color, and sufficient whitespace. Align the visual metaphor with the opening philosophical proposition and the technical mechanism. The cover may remain sharing-only; body placement follows the article's needs.

## Code and protocol samples

Compare the same task, input, and abstraction level. Show the smallest old behavior and the smallest new behavior, then identify whether the change belongs to the wire contract, state ownership, execution model, or application policy.

Use current official schemas and SDK documentation. Mark framework-neutral reference logic and pseudocode explicitly. Include the relevant identity, authorization, idempotency, concurrency, expiry, retry, and failure behavior. Explain the assumptions that make the code valid.
