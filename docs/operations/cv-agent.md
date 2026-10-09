# Unlisted Agent CV

The optional `profiles/{profileId}/cv-agent.yaml` supplies a separate presentation at `/zh/cv-agent/` and `/en/cv-agent/`. The legacy `/cv/`, `CVLayout`, profile files, existing resumes and public collections are unchanged. Identity, job titles, periods, education and metric values come from the canonical ProfilePack. Curated summaries, architecture and research live only in this opt-in view; they are never added to ProfilePack or its JSON export.

## Visibility

There are no inbound navigation, homepage, role, note or case links. The standalone layout has no global navigation, analytics/page-view registration or Pagefind body. Sitemap filtering, page metadata and scoped Cloudflare `X-Robots-Tag` headers exclude indexing; PDF files use `/resumes/cv-agent/`. `Referrer-Policy: no-referrer` avoids passing the unlisted URL to research links or other origins. Do not add robots.txt Disallow rules: crawlers must fetch the page to observe noindex. This is link sharing, not authentication; anyone holding the URL can open or forward it.

## Content provenance

Current business metrics are carried from the existing career material, not newly measured. Cowork is explicitly presented as architecture design and engineering research. The repository `Nunchakus888/cowork` returned 404 to the connected reader on 2026-10-07; no implementation, production scale, or rollout claim was inferred from its roadmap. Research links point to existing notes; CAVA and other third-party research are attributed as analyses, not original inventions. English uses reviewed counterparts where available, otherwise labels and links the Chinese original.

## Validation and export

```sh
pnpm exec tsx scripts/test-cv-agent.ts
CV_AGENT_PDF=1 pnpm build
pnpm exec playwright install --with-deps chromium
# A CJK font package, such as fonts-noto-cjk on Ubuntu, is required for Chinese export.
pnpm exec tsx scripts/generate-cv-agent-pdf.ts
node scripts/verify-cv-agent-build.mjs --require-pdf
```

CI runs these checks before deployment. The optional `pdfFilenameBase` in `cv-agent.yaml` controls the descriptive download name and the public PDF basename, adding `-zh.pdf` / `-en.pdf` to avoid language collisions. For the default profile these are `George-AI Agent开发专家-zh.pdf` and `George-AI Agent开发专家-en.pdf`. Public URLs percent-encode the filename; the export also keeps the previous `george-zh.pdf` and `george-en.pdf` PDFs working as aliases for already shared links. The print header includes clickable mailto, GitHub and canonical online CV links with inline SVG icons; PDF generation validates link annotations. Without `CV_AGENT_PDF=1`, normal development builds show Print / Save as PDF but no ungenerated download link. Export writes only to the new dist namespace and a private CI review artifact; it never invokes or modifies the legacy PDF generator. Browser checks cover 320/390/1280px, both language PDFs must have two A4 pages, and build checks reject public inbound links, sitemap/JSON/feed exposure, missing notes or PDF targets, and Pagefind fragment leakage. Profiles without this optional file generate no Agent CV routes.
