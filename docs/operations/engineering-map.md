# Isolated engineering map

Route: `/zh/engineering-map/`. This review surface does not replace either CV, join a collection, or add navigation. No English counterpart is generated. Its own robots metadata, Pagefind ignore boundary and sitemap exclusion keep it unlisted, not access-controlled. Anyone holding the URL can read it.

## Structure

- `profiles/default/engineering-map.json`: six domains, eighteen capabilities, three shared projects, contribution-level ownership modes, sources and typed relations.
- `src/lib/engineering-map/render.mjs`: framework-independent, escaped server rendering and referential validation.
- `src/lib/engineering-map/map.css`: isolated document stylesheet, responsive domains and system light/dark appearance.
- `src/lib/engineering-map/interactions.js`: native details enhancement, fragment navigation, evidence disclosure, focus restoration and print expansion. No storage, graph engine, drag or zoom dependency.
- `src/pages/[locale]/engineering-map.astro`: optional active-profile route. Profiles without this JSON file generate no map.

## Evidence policy

Current evidence is the provided CV and author clarification, not a source-code or execution audit. Keep Pi loop/compaction integration separate from authored task controls. Multi-Agent collaboration remains planning. Every contribution keeps its own project; every node states its verification boundary. Research does not count as implemented Cowork behavior. No scale, performance, availability or business metrics are inferred.

## Verification

Run `node --test scripts/test-engineering-map.mjs` for data integrity, contribution boundaries, HTML escaping, anchors and unlisted-route metadata.

The initial review tested the shared HTML renderer, CSS and interaction module in Chromium at widths 320, 390, 768 and 1440, including light/dark views, no horizontal overflow, node switching, evidence disclosure, relationship traversal, browser Back, return focus, no-JS disclosure and evidence fragment entry. This offline browser harness does not replace the native Astro build or a live deployment check.

Before release, build with the normal repository pipeline and verify the actual route plus sitemap exclusion. Do not claim physical iOS/Safari testing from viewport emulation alone.
