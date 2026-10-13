# Engineering map — version 2

Route: `/zh/engineering-map/`. The map remains an unlisted review surface. Both CVs, navigation, collections and the sitemap filter remain unchanged. The route has robots metadata and Pagefind exclusion. Unlisted does not mean access-controlled.

## Reading model

- All six groups and eighteen capability nodes are rendered and readable immediately.
- Nodes lead with concrete technology names, then the actual project and a short contribution.
- Desktop uses a single connected diagram. Mobile reflows the same semantic HTML into an expanded vertical tree; there are no folded skill groups.
- Shared root connectors express grouping. Two separately labeled dependency paths express cross-domain relationships.
- Project problem, contribution and validation boundary stay visible. Only the detailed source records use native, in-place `details` disclosure.
- There is no interaction JavaScript, selection state, page-jump handler, local storage, client graph engine or added dependency.

## Content boundaries

`profiles/default/engineering-map.json` version 2 separates projects, capability contributions, dependencies and research/planning. Every node carries technology terms, its project, contribution mode, engineering problem and validation boundary. All claims are based on supplied experience, not a newly completed source-code or runtime audit. Pi loop/compaction is integration, and multi-Agent work is planning. Three project records retain evidence summaries and do not link to the separate unlisted CV.

## Files and verification

- `src/lib/engineering-map/render.mjs`: escaped, framework-independent server renderer and referential validation.
- `src/lib/engineering-map/map.css`: standalone responsive diagram; neutral light/dark palette.
- `src/pages/[locale]/engineering-map.astro`: optional active-profile route with no client script.
- `scripts/test-engineering-map.mjs`: run `node --test scripts/test-engineering-map.mjs` for structure, ownership boundaries, initial visibility, HTML escaping, historical fragments and route isolation.

The shared HTML/CSS renderer was checked in Chromium, with JavaScript disabled, at 320, 390, 768, 1024, 1280 and 1440 CSS pixels in both light and dark schemes. Checks covered 18 non-hidden nodes, no horizontal document overflow or overlapping branch rows, and three native source disclosures that do not change the URL. These are browser viewport tests, not physical iOS/Safari certification. The normal repository build and live publication check remain separate release gates.
