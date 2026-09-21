# Pages consolidation and traffic audit — 2026-09-21

## Provenance

Cloudflare REST and GraphQL queried from the authenticated CI environment. No API keys, OAuth secrets or GitHub token values were exported.

Verified code commit: `ddbb7a44ec143ad0f36cfe6dcbd13670ecae5b9d`.
GitHub Actions CI run: `35574950535`, successful.
Evidence artifact: `site-routing-and-analytics`, artifact ID `10627865255`.
Files: `artifacts/site-routing/receipt.json`, `audit/cloudflare-site-audit.json`.
Final audit generated: 2026-09-21 07:53:45 UTC / 16:53:45 Asia/Seoul.

## Verified production changes

| Check | Observed result |
| --- | --- |
| sunionpeaks root | HTTP 301 directly to /zh/ |
| Root UTM query | Preserved in Location |
| Chinese / English homepage | 200; no meta refresh or Open DossierKit; exactly one beacon |
| robots.txt | 200; text/plain; correct sitemap URL |
| sitemap-index.xml / sitemap-0.xml | 200; application/xml |
| Missing page | 404; no HTML homepage fallback; no beacon |
| dossierkit root | 301 to https://sunionpeaks.pages.dev/zh/ |
| Legacy article, locale, robots paths | 301 preserving path and query |
| Legacy production Functions | false |
| Legacy runtime bindings | Empty; GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET removed |

Production deployments: sunionpeaks `6a94f1f2-906f-4322-8d5d-f28f6c2eafdb`; dossierkit redirect-only `fd36cdef-330b-43ee-a0a0-7df1d8f0162b`; independent Notes MCP `1011bb5c-43f1-4b70-9ff6-6b650053feae`.

There are still three Pages projects: one content website (`sunionpeaks`), one redirect-only legacy entry (`dossierkit`), and the isolated publishing backend (`dossierkit-notes-mcp`). No project was deleted, and historical deployment snapshots were not purged. Do not describe this as literally one Pages project or deletion of all legacy history. The legacy production content and Functions have been replaced, not the MCP publishing service.

The credential-scoped Zone listing returned an empty array. No custom domain was configured or purchased. Public canonical origin remains https://sunionpeaks.pages.dev.

## Analytics scope and sampling

There is one RUM site in the visible account. All returned 7-day and 30-day host groups belong to sunionpeaks.pages.dev. The old site had no RUM beacon and no RUM records: this does not establish zero old HTTP traffic.

Window ends 2026-09-21 07:53:45 UTC. Seven-day start: 2026-09-14 07:53:45 UTC. Thirty-day start: 2026-08-22 07:53:45 UTC.

| Window | Page views | Visits | Average sampleInterval |
| --- | ---: | ---: | ---: |
| 7 days | 82 | 31 | 1.051282 |
| 30 days | 250 | 90 | 13.888889 |

Counts are Cloudflare API results and include adaptive estimates, not unique people. The seven-day query is slightly sampled too. Sparse 30-day breakdowns can omit categories present in the seven-day results; do not present these as exact channel counts or compute precise growth rates.

## Seven-day entry sources

| Referrer host | Page views | Entry visits |
| --- | ---: | ---: |
| Missing / Direct / Unknown | 29 | 29 |
| github.com | 1 | 1 |
| weixin110.qq.com | 1 | 1 |
| sunionpeaks.pages.dev | 51 | 0 |

29/31 = 93.5% of entries lack an identifiable referrer. Missing referrer does not imply typed URL, a specific app, or a human visitor. Self-referrals are internal navigation, not external acquisition. The GitHub entry landed on the Chinese GitHub Copilot Runtime article. The weixin110.qq.com entry landed on /zh/cv/; this is not proof of WeChat organic acquisition or a human rather than checking activity. No identifiable Google/Bing/Baidu referrer was returned, which does not establish whether pages are indexed.

## Seven-day geography and devices

| Region | PV | Visits |
| --- | ---: | ---: |
| KR | 33 | 6 |
| US | 30 | 14 |
| JP | 9 | 1 |
| NL | 2 | 2 |
| DE | 2 | 2 |
| IL | 2 | 2 |
| FR | 1 | 1 |
| CN | 1 | 1 |
| ES | 1 | 1 |
| CA | 1 | 1 |

Desktop 64 PV / 23 visits; mobile 18 PV / 8 visits. Browsers: Chrome 64/23; ChromeMobile 12/3; MobileSafari 5/4; ChromeMobileWebview 1/1. Operating systems: MacOSX 34/8; Linux 18/7; iOS 15/6; Windows 12/8; Android 3/2.

Countries describe connection geography, not nationality or verified residence. The audit has no reliable own-traffic exclusion. bot=0 for returned groups means not flagged by that classifier; it does not prove unique human readership.

## Seven-day content signals

Chinese home /zh/: 34 PV / 3 entries.
Cloudflare Computer / Agent Runtime article: Chinese 17 PV / 17 entries; English 2 PV / 2 entries. Together 19/31 = 61.3% of entries, all with missing referrer.
GitHub Copilot Runtime Chinese article: 6 PV / 2 entries.
Notes index: 5 PV / 0 entries.
OpenAI Agents API Chinese article: 4 PV / 0 entries.
Old root interstitial /: 3 PV / 3 entries.

The Cloudflare article is a landing-page signal, not proof of a particular acquisition channel or successful reader conversion. Removing the interstitial may reduce pageview noise without reducing readers. No dwell/read/share/contact conversion events exist in this dataset.

## Seven-day real-user performance

| Device | Web Vitals event count | LCP P75 | INP P75 | CLS P75 | TTFB P75 |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop | 77 | 1.300 seconds | 56 ms | 0 | 651 ms |
| mobile | 17 | 1.504 seconds | 48 ms | 0 | 515 ms |

The schema defines time values in microseconds, converted above. Event counts are not unique visitors or each metric's independent valid sample size. These windows straddle the change, so do not claim a before/after speed gain.

## Operational behavior and remaining work

The main CI deploy target is pinned to sunionpeaks. It separately deploys the isolated Notes MCP, enforces absence of Notes write credentials on the content site, verifies the legacy redirect-only production host, and captures private analytics evidence. A manual read-only Cloudflare site audit workflow is available. Report filters use the exact production host, not preview hosts or raw request totals.

Cloudflare Web Analytics does not currently log UTM/query strings or custom events. UTM preservation has been verified, but UTM ingestion and custom conversion tracking have NOT been implemented. Specific group/channel attribution requires a separately designed first-party collection layer or a supported analytics platform; past unknown referrers cannot be reconstructed. No second third-party tracker or paid analytics product was introduced.

Official definitions: Cloudflare Pages Redirects; Web Analytics High-level Metrics; Web Analytics FAQ (sampling, UTM, custom events); Core Web Vitals documentation.
