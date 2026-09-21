# One-time integration on the isolated implementation branch; not part of the final source tree.
from pathlib import Path
import json
p=Path('.')
def replace(path, old, new):
    file=p/path
    text=file.read_text()
    if text.count(old)!=1:
        raise RuntimeError('Unexpected source context: '+path)
    file.write_text(text.replace(old,new,1))
replace('src/layouts/BaseLayout.astro','import Header from','import ViewCounterClient from "../components/views/ViewCounterClient.astro";\nimport Header from')
replace('src/layouts/BaseLayout.astro','    <CloudflareAnalytics />','    <CloudflareAnalytics />\n    <ViewCounterClient />')
replace('src/components/dossier/NoteCard.astro','import Icon from','import ViewCount from "../views/ViewCount.astro";\nimport Icon from')
replace('src/components/dossier/NoteCard.astro','{timestamp && <time datetime={timestamp}>{timestampLabel}</time>}','{timestamp && <time datetime={timestamp}>{timestampLabel}</time>}\n      <ViewCount noteRef={`${locale}/${entry.slug}`} locale={locale} />')
replace('src/pages/[locale]/notes/[slug].astro','import BaseLayout from','import ViewCount from "../../../components/views/ViewCount.astro";\nimport BaseLayout from')
replace('src/pages/[locale]/notes/[slug].astro','<span>{readingMinutes} {locale === "zh" ? "分钟阅读" : "min read"}</span>','<span>{readingMinutes} {locale === "zh" ? "分钟阅读" : "min read"}</span>\n        <ViewCount noteRef={`${locale}/${entry.slug}`} locale={locale} />')
replace('src/components/layout/Footer.astro','import type { Locale }','import ViewCount from "../views/ViewCount.astro";\nimport { viewsEnabled } from "../../lib/view-counter/config";\nimport type { Locale }')
replace('src/components/layout/Footer.astro','  tagline && (','  (tagline || viewsEnabled) && (')
replace('src/components/layout/Footer.astro','<p>{localize(tagline, locale)}</p>','{tagline && <p>{localize(tagline, locale)}</p>}\n        <ViewCount locale={locale} />')
replace('src/components/layout/Footer.astro','    text-align: center;','    text-align: center;\n    display: grid;\n    justify-items: center;\n    gap: .5rem;')
f=p/'package.json'; data=json.loads(f.read_text()); data['scripts']['test:views']='node --experimental-sqlite --test scripts/views/counter.test.mjs'; data['scripts']['build']+=' && node scripts/views/generate-manifest.mjs'; f.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
replace('.github/workflows/ci.yml','      - name: Validate active profile','''      - name: Test aggregate page-view counter
        run: pnpm test:views

      - name: Prepare optional view-counter database and production binding
        if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_D1_API_TOKEN: ${{ secrets.CLOUDFLARE_D1_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: python3 scripts/views/provision.py

      - name: Validate active profile''')
replace('.github/workflows/ci.yml','      - name: Record successful production publication','''      - name: Verify live counter or explicit inactive state
        if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        run: node scripts/views/verify-live.mjs

      - name: Record view-counter activation receipt
        if: always() && github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: view-counter-status
          path: artifacts/views/
          if-no-files-found: warn
          retention-days: 14

      - name: Record successful production publication''')
replace('docs/integrations.md','不接 X 付费 API、GoatCounter、自建账户或互动数据库。','不接 X 付费 API、GoatCounter 或自建账户。公开浏览量使用独立 D1 聚合计数表，不保存访客记录。')
replace('docs/integrations.md','只提供 Cloudflare 后台统计，不伪造公开访问计数、自定义事件或 UTM/点击率归因。生产统计不应启用于预览域名。','Cloudflare 后台保留原有统计；公开浏览次数来自独立的 D1 计数器，不与 RUM 数据相加，不提供 UTM 或行为归因。详见 `docs/view-counter.md`。生产统计不启用于预览域名。')
f=p/'docs/privacy.md';f.write_text(f.read_text()+'''\n## Public view counter\n\nThe first-party `/api/views` endpoint stores only cumulative and daily aggregate counts by published article ID. It does not persist IP addresses, visitor identifiers, referrers, device data, query strings, cookies, or per-visit logs. The request body contains a public page path and public article IDs only. Existing Cloudflare Web Analytics remains a separate integration.\n\nThe counter is disabled on previews, admin and missing pages. Failed/unconfigured counters stay hidden. To opt out on the current browser, set `localStorage.setItem('dossierkit:views:exclude', '1')`; remove it to resume counting. This setting applies only to the first-party counter, not to Cloudflare Web Analytics. Global Privacy Control, Do Not Track and automated browser contexts use read-only requests. Counts represent browser page loads, not unique people or verified reading.\n''')
