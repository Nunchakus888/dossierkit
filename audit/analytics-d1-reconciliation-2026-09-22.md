# Cloudflare Web Analytics / D1 read-only reconciliation — 2026-09-22

## Provenance and scope

Production host: sunionpeaks.pages.dev. Production commit c5280dadad79a8305d80fc7d5eacc8e41769d306 remains unchanged. This audit only reads Cloudflare GraphQL analytics, D1 SELECT queries, and public HTTP GET endpoints. No deployment, migration, counter write, or credential change was performed. No visitor identifiers, visitor hashes, or secrets were exported.

Audit run: 35682777439. Raw aggregate artifact: 10675920914 (analytics-d1-reconciliation). Audit branch only; this report is not deployed as site content.

D1 snapshot: 2026-09-22 03:20:27.612 UTC / 11:20:27.612 Asia/Shanghai. Audit ended at 03:20:55.274 UTC. Reporting timezone: Asia/Shanghai, UTC+8.
D1 initialized: 2026-09-21 09:39:23.085 UTC / 17:39:23.085 local.
V2 initialized: 2026-09-21 10:09:33.719 UTC / 18:09:33.719 local. These are initialization timestamps, not exact deployment completion timestamps.

## PV comparison

| Aligned window (UTC+8) | Cloudflare PV | D1 PV | CF minus D1 | CF mean sampleInterval |
| --- | ---: | ---: | ---: | ---: |
| September 22, 00:00 to 11:20:27 | 5 | 5 | 0 | 1.0000 |
| September 21, 17:39:23 to midnight | 23 | 21 | 2 | 1.0952 |
| Since D1 initialization to snapshot | 28 | 26 | 2 | 1.0769 |
| Since V2 initialization to snapshot | 23 | 21 | 2 | 1.0952 |
| Since V2 initialization to September 22 11:05, excluding newest 15 minutes | 23 | 21 | 2 | 1.0952 |

D1 is 2/28 = approximately 7.1% below the Cloudflare reported cumulative PV in the aligned window. This is a net difference, not proof that exactly two individual events differ. Cloudflare count values are used as returned, without multiplying or dividing them by sampleInterval. Sampling may contribute but is not established as the sole cause.

Last 7 days Cloudflare: 114 PV / 55 Visits / sampleInterval 1.0755. Last 30 days: 260 PV / 100 Visits / sampleInterval 13.6842. These windows include traffic before D1 was enabled and must not be compared directly to D1 cumulative 26 as a measure of lost traffic. Returned RUM hosts over 7 days contain only sunionpeaks.pages.dev.

## September 22 per-page comparison

| Page | Cloudflare PV | D1 PV |
| --- | ---: | ---: |
| /zh/ | 2 | 2 |
| /zh/cv/ | 1 | 1 |
| /zh/notes/agentaudit-execution-trace-agent/ | 1 | 1 |
| /zh/notes/github-copilot-agent-runtime-rust-ffi-harness-ai/ | 1 | 1 |
| Total | 5 | 5 |

All returned page groups in this daily window have sampleInterval=1. Five matching page views are a limited sample, not a guarantee of perfect capture under all browsers and networks.

## V2-period per-page comparison

D1 values below come from V2 source rollups, not article lifetime PV including V1 data.

| Page | Cloudflare PV | D1 V2 PV | CF sampleInterval |
| --- | ---: | ---: | ---: |
| /zh/ | 9 | 9 | 1 |
| /zh/cv/ | 6 | 5 | 1.2 |
| /zh/notes/agentaudit-execution-trace-agent/ | 4 | 2 | 1 |
| /zh/notes/github-copilot-agent-runtime-rust-ffi-harness-ai/ | 1 | 1 | 1 |
| /zh/notes/cava-canonical-action-runtime-governance/ | 1 | 1 | 1 |
| /zh/privacy/ | 2 | 2 | 2 |
| /en/privacy/ | No returned group | 1 | Not available |

The AgentAudit 4-versus-2 difference remains unexplained at event level. Its returned group is not sampled. Privacy exclusions, request delivery failures, repeated telemetry or document-restoration behavior are possible mechanisms, not proven causes. Aggregate data does not provide a one-to-one client delivery trace. An omitted Cloudflare group is not asserted to mean zero real visits.

## D1 consistency

- Zero mismatches between each lifetime total and sum of daily counts.
- Site cumulative 26 equals yesterday 21 plus today 5.
- V2 site source PV 21 equals retained event receipts 21 and identifiable PV 21.
- No source rollup exceeds its daily PV; no identified PV exceeds PV; no negative source counts.
- Direct SQL site total 26 equals public /api/views totalViews 26. CV cumulative 5 equals its public summary total 5.
- Site total remained 26 at the closing read; no test PV was injected.
- Lifetime per-page counts sum to 22, versus site 26. In the V1 counter, non-article pages incremented only the site counter. The unallocated historical gap is 4; V2 site PV and V2 per-page PV both sum to 21.
- Reconciliation: site26 = V1-format5 + V2-format21. Per-page22 = V1 article1 + V2 all-pages21. Do not fabricate allocation of the historical four visits.

The raw artifact's matureEvents.completeReceiptCoverage=false is a conservative heuristic because the first event follows V2 initialization, not evidence of actual receipt loss. At audit time V2 has existed for less than the 48-hour receipt retention period; receipt and V2 source totals agree. No conclusion is drawn about client requests that never reached the server.

## UV and sources

September 22: D1 2 browser UV versus Cloudflare 4 Visits. These measure different things. D1 yesterday2 and today2 yield a distinct cross-day UV of3, not4. Last7/30 UV both equal3 and only cover the post-V2 observation period.

V2-period D1 sources: direct-unknown18 PV / 2 UV; t.co3 PV / 1 UV. All21 observed V2 PV carry identifiable browser IDs. This is not a count of verified natural people.

| September 22 source model | t.co | Internal referrer | Direct/unknown | Total PV |
| --- | ---: | ---: | ---: | ---: |
| Cloudflare immediate referrer | 2 | 1 | 2 | 5 |
| D1 inherited entry-chain attribution | 3 | Not a separate source | 2 | 5 |

This distribution is consistent with the deployed source-inheritance rule: an internal page view retains the entry source in D1. It does not indicate one extra site PV. No per-visitor clickstream reconstruction was performed.

## HTTP and collection scope

Chinese/English homepages, CV pages, contact page and checked article return200, each has one Cloudflare beacon and a configured first-party counter. Counter and summary/source endpoints return200. Root returns301; missing page404 has no beacon/counter.

/admin/ and /plugins/dossierkit-notes/ each include a Cloudflare beacon but no first-party counter configuration. They are a real scope mismatch for future traffic. Neither appears in the returned aligned-window RUM path groups, so they are not claimed as the cause of the current two-PV difference.

D1 deliberately excludes opt-out/DNT/GPC/webdriver and some known robot requests, and reports once per visible document. Normal reloads remain new PV; there is no30-minute PV suppression. Cloudflare sampling, JS blocking and collection timing differ. Consequently exact permanent equality is not the implementation contract.

## Conclusion and handling

Today's observed PV align exactly. Historical PV do not completely align. D1 is internally consistent and public API output matches SQL, with no demonstrated ongoing overcount or database aggregation fault. Keep AgentAudit's discrepancy explicitly unresolved rather than attributing everything to sampling.

Use D1 for the public eye counter, compare PV-to-PV on matching host/time/page scope, and do not add the two products together or backfill D1 with sampled Analytics values. Queries/rows-read/rows-written in the D1 infrastructure dashboard are not website PV. Prefer complete local days for subsequent checks. No production correction or new monitoring was installed in this audit.

Official metric definitions: https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/
Sampling, script delivery and reporting timing: https://developers.cloudflare.com/web-analytics/faq/
D1 infrastructure metrics: https://developers.cloudflare.com/d1/observability/metrics-analytics/
