"""One-time candidate integration, removed before the production commit."""
from pathlib import Path

def edit(path, fn):
    p=Path(path); p.write_text(fn(p.read_text()))

def server(s):
    s=s.replace('/** Aggregate-only PV counter. No visitor IDs, IP addresses or per-visit records. */', "/** Public aggregate counter. Never return event receipts or visitor hashes. */\nimport { allRefs, keyForRef, refForPath } from './identity.mjs';\nimport { prepareEvent, recordEvent, readUV, readSources } from './metrics.mjs';")
    s=s.replace('return new Set(Object.values(manifest.pages).filter(Boolean));','return allRefs(manifest);').replace('const keyFor = (ref) => `note:${ref}`;', 'const keyFor = keyForRef;')
    s=s.replace('since: map.get(SITE_KEY)?.started_at || null, timeZone: manifest.timeZone, day', 'since: map.get(SITE_KEY)?.started_at || null, timeZone: manifest.timeZone, day,\n    sinceByRef: Object.fromEntries(refs.map((ref) => [ref, map.get(keyFor(ref))?.started_at || null])),\n    schemaVersion: 2')
    s=s.replace('const article = manifest.pages[path];','const article = refForPath(path, manifest);')
    i=s.index('      const total = db.prepare(`INSERT INTO view_totals')
    s=s[:i]+'''      if (body.version === 2) {
        if (request.headers.get('sec-gpc') === '1' || request.headers.get('dnt') === '1') {
          return json(counts((await totalsSelect(db, refs).all()).results, refs, manifest, day));
        }
        let event;
        try { event = await prepareEvent(body, path, env.VIEWS_HASH_SECRET, now); }
        catch (error) { return json({ error: error instanceof TypeError ? 'Invalid event' : 'Counter temporarily unavailable' }, error instanceof TypeError ? 400 : 503); }
        const result = await recordEvent(db, event, keys, day, totalsSelect(db, refs));
        if (result.conflict) return json({ error: 'Event identity conflict' }, 409);
        return json({ ...counts(result.rows, refs, manifest, day), duplicate: result.duplicate });
      }
      if (body.version != null) return json({ error: 'Unsupported version' }, 400);
      // Already-open v1 clients preserve PV but cannot supply historical UV/source.
'''+s[i:]
    s=s.replace("      const ref = url.searchParams.get('ref');", "      const ref = url.searchParams.get('ref') || (url.searchParams.has('path') ? refForPath(normalizePath(url.searchParams.get('path')), manifest) : null);\n      if (url.searchParams.has('path') && !ref) return json({ error: 'Unknown page' }, 400);")
    s=s.replace('      return json({ ref: ref || SITE_KEY, total:', '      const uvData = await readUV(db, key, day, shiftDay);\n      const { daily: uvDaily, ...uv } = uvData;\n      for (const item of trend) item.uv = uvDaily.get(item.day) || 0;\n      return json({ uv, ref: ref || SITE_KEY, total:')
    s=s.replace("    if (mode === 'top') {", '''    if (mode === 'sources') {
      const period = url.searchParams.get('period') || '7d';
      if (!['today','yesterday','7d','30d'].includes(period)) return json({ error: 'Invalid period' }, 400);
      const path = url.searchParams.get('path');
      const ref = url.searchParams.get('ref') || (path ? refForPath(normalizePath(path), manifest) : null);
      if ((path && !ref) || (ref && !known.has(ref))) return json({ error: 'Unknown page' }, 400);
      const end = period === 'yesterday' ? shiftDay(day,-1) : day;
      const first = period === '7d' ? shiftDay(day,-6) : period === '30d' ? shiftDay(day,-29) : end;
      return json({ ...(await readSources(db, ref ? keyFor(ref) : SITE_KEY, first, end)), ref: ref || SITE_KEY, period, from: first, to: end, timeZone: manifest.timeZone });
    }
    if (mode === 'top') {''')
    s=s.replace('      const statement = period', "      const type = url.searchParams.get('type') || 'notes';\n      if (!['notes', 'pages', 'all'].includes(type)) return json({ error: 'Invalid type' }, 400);\n      const pattern = type === 'notes' ? 'note:%' : type === 'pages' ? 'page:%' : '%';\n      const statement = period")
    s=s.replace("WHERE key LIKE 'note:%' ORDER BY views DESC, key LIMIT 100\")", "WHERE key LIKE ? AND key != 'site:total' ORDER BY views DESC, key LIMIT 200\").bind(pattern)")
    s=s.replace("WHERE key LIKE 'note:%' AND day", "WHERE key LIKE ? AND key != 'site:total' AND day").replace('key LIMIT 100").bind(shiftDay(day', 'key LIMIT 200").bind(pattern, shiftDay(day')
    s=s.replace('({ ref: row.key.slice(5), views:', "({ ref: row.key.startsWith('note:') ? row.key.slice(5) : row.key, views:").replace('return json({ period, timeZone:', 'return json({ period, type, timeZone:')
    s=s.replace("    try { refs = validateRefs(url.searchParams.getAll('ref'), known); }", "    try {\n      const paths = url.searchParams.getAll('path').map((p) => refForPath(normalizePath(p), manifest));\n      refs = validateRefs([...url.searchParams.getAll('ref'), ...paths], known);\n    }")
    return s
edit('src/lib/view-counter/server.mjs',server)

def client(s):
    s="import { isExcluded, clearIdentity, visitorId, entrySource } from './browser-context.mjs';\n"+s
    s=s.replace('      const date = data.since ?', "      const since = key === 'site:total' ? data.since : (data.sinceByRef ? data.sinceByRef[key] : data.since);\n      const date = since ?").replace('new Date(data.since)','new Date(since)')
    s=s.replace('  const send = async (chunk, write) => {','  let event = null;\n  const send = async (chunk, write) => {').replace('body: JSON.stringify({ path: win.location.pathname, refs: chunk })','body: JSON.stringify({ ...event, path: win.location.pathname, refs: chunk })')
    s=s.replace('  const run = () => {','  const run = async () => {')
    a=s.index('    let excluded =');b=s.index('    // The first request',a)
    return s[:a]+'''    let excluded = isExcluded(win);
    if (excluded) clearIdentity(win);
    if (!excluded) {
      try {
        event = { version: 2, eventId: win.crypto.randomUUID(), occurredAt: Date.now(),
          visitorId: await visitorId(win), attribution: entrySource(win, doc) };
      } catch { excluded = true; }
    }
    if (isExcluded(win)) { excluded = true; clearIdentity(win); }
'''+s[b:]
edit('src/lib/view-counter/client.mjs',client)

def layout(s):
    s=s.replace('import ViewCounterClient','import ViewCount from "../components/views/ViewCount.astro";\nimport ViewCounterClient',1)
    s=s.replace('  modifiedTime?: string;', '  modifiedTime?: string;\n  pageCounterInline?: boolean;').replace('ogType = "website", publishedTime, modifiedTime\n','ogType = "website", publishedTime, modifiedTime, pageCounterInline = false\n')
    s=s.replace('const cssVars =', '''const path = Astro.url.pathname.replace(/\\/index\\.html$/, "/").replace(/\\/+$/, "") || "/";
const publicPage = /^\\/(zh|en)(\\/|$)/.test(path || "");
const pageRef = noteRef || `page:${path}`;
const cssVars =''')
    s=s.replace('    {note && <meta name="dossierkit:note-ref"','    {publicPage && <meta name="dossierkit:page-ref" content={pageRef} />}\n    {note && <meta name="dossierkit:note-ref"')
    s=s.replace('    <main data-pagefind-body>','    <main data-pagefind-body>\n      {publicPage && !note && !pageCounterInline && <div class="page-shell page-view-meta no-print" data-pagefind-ignore><ViewCount noteRef={pageRef} locale={locale} /></div>}')
    s=s.replace('    <ViewCounterClient />','    {publicPage && <ViewCounterClient />}')
    return s+'\n<style>\n  .page-view-meta { display: flex; justify-content: flex-end; padding-top: .6rem; min-height: 1.5rem; }\n</style>\n'
edit('src/layouts/BaseLayout.astro',layout)
edit('src/layouts/CVLayout.astro',lambda s:s.replace('import BaseLayout','import ViewCount from "../components/views/ViewCount.astro";\nimport BaseLayout',1).replace('<BaseLayout locale={locale}','<BaseLayout pageCounterInline locale={locale}',1).replace('<h2>{localize(pack.profile.headline, locale)}</h2>','<h2>{localize(pack.profile.headline, locale)}</h2>\n        <ViewCount noteRef={`page:/${locale}/cv`} locale={locale} />'))
edit('src/components/layout/Footer.astro',lambda s:s.replace('<ViewCount locale={locale} />','<ViewCount locale={locale} />\n        {viewsEnabled && <a class="counter-privacy" href={`/${locale}/privacy/`}>{locale === "zh" ? "统计与隐私" : "Statistics & privacy"}</a>}').replace('  p {','  .counter-privacy { font-size: .75rem; color: var(--color-muted); text-underline-offset: .2em; }\n\n  p {'))
edit('src/styles/global.css',lambda s:s.replace('@import "tailwindcss";','@import "tailwindcss";\n@source not "../../scripts";'))
edit('scripts/views/counter.test.mjs',lambda s:s.replace("const migration = readFileSync(new URL('../../migrations/views/0001_views.sql', import.meta.url), 'utf8');", "const migration = ['0001_views.sql','0002_uv_sources.sql'].map((name) => readFileSync(new URL('../../migrations/views/' + name, import.meta.url), 'utf8')).join('\\n');").replace('const win = { location:', 'const win = { crypto, location:'))

def provision(s):
    s=s.replace('import os','import os\nimport secrets\nimport subprocess\nimport sys',1)
    a=s.index('    # CREATE IF NOT EXISTS');b=s.index('    check = api',a)
    s=s[:a]+'''    # Every migration is additive and idempotent; v1 counters never get reset.
    REPORT['migrations'] = []
    for migration in sorted((ROOT / 'migrations/views').glob('*.sql')):
        result = api(f'/d1/database/{database_id}/query', 'POST', {'sql': migration.read_text(), 'params': []})
        if any(item.get('success') is False for item in result):
            raise ApiError('Counter schema initialization failed')
        REPORT['migrations'].append(migration.name)
    # Runtime-only application HMAC secret. Never export or log the value.
    if 'VIEWS_HASH_SECRET' not in (production.get('env_vars') or {}):
        result = subprocess.run(['pnpm', 'exec', 'wrangler', 'pages', 'secret', 'put',
            'VIEWS_HASH_SECRET', '--project-name=sunionpeaks'],
            input=secrets.token_urlsafe(48), text=True, capture_output=True, timeout=60, cwd=ROOT)
        if result.returncode:
            raise ApiError('Could not provision the runtime HMAC binding')
        REPORT['hashSecretCreated'] = True
'''+s[b:]
    s=s.replace("!= set((production.get('env_vars') or {}).keys()):", "!= set((production.get('env_vars') or {}).keys()) | {'VIEWS_HASH_SECRET'}:")
    s=s.replace('REPORT.update(ready=True, databaseId=database_id,','REPORT.update(ready=True, schemaVersion=2, hashSecretBound=True, databaseId=database_id,')
    s=s.replace("REPORT['requiredAction'] = 'Grant Account / D1 / Edit on the existing deployment token, or set a dedicated CLOUDFLARE_D1_API_TOKEN secret for this account, then rerun CI.'", "REPORT['requiredAction'] = 'Check D1 Write and Pages Edit permissions, preserve VIEWS_HASH_SECRET, then rerun CI. Existing production is not replaced by a failed upgrade.'")
    s=s.replace("print('::warning::View counter inactive: D1 preparation did not succeed. Existing website remains available; no fake counts will be shown.')", "print('::error::Counter upgrade could not be prepared; stopping before production deployment.')")
    return s+'\nif not REPORT["ready"]:\n    sys.exit(1)\n'
edit('scripts/views/provision.py',provision)

def browser(s):
    s=s.replace('Object.values(manifest.pages).filter(Boolean).map((ref) => [ref, 128])','Object.entries(manifest.pages).map(([path, ref]) => [ref || `page:${path}`, ref ? 128 : 36])')
    return s.replace('    checks.push({ viewport,', '''    await page.goto('http://127.0.0.1:4178/zh/cv/');
    await page.locator('.cv-header [data-view-count="page:/zh/cv"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.cv-header [data-view-number]').textContent(), '36');
    assert.equal(await page.locator('[data-view-count="page:/zh/cv"]').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `artifacts/views/ui/cv-${viewport.width}.png`, fullPage: false });
    checks.push({ cvIndependentCounter: true, viewport,''')
edit('scripts/views/browser-test.mjs',browser)

def verify(s):
    s=s.replace('      assert.ok(Number.isSafeInteger(summary.last7Days));', '''      assert.ok(Number.isSafeInteger(summary.last7Days));
      assert.equal(counts.schemaVersion, 2);
      assert.equal(summary.uv.identity, 'first-party-browser');
      assert.ok(Number.isSafeInteger(summary.uv.last30Days));
      for (const path of ['/zh/cv/', '/en/cv/', '/zh/contact/']) {
        const page = await get(path); assert.equal(page.status, 200);
        const markup = inspectViewMarkup(await page.text());
        assert.ok(markup.refs.includes('page:' + path.replace(/\\/+$/, '')));
        const statsResponse = await get('/api/views?mode=summary&path=' + encodeURIComponent(path));
        assert.equal(statsResponse.status, 200);
        const stats = await statsResponse.json(); assert.ok(Number.isSafeInteger(stats.total));
        assert.ok(Number.isSafeInteger(stats.uv.today));
      }
      const sourceResponse = await get('/api/views?mode=sources&period=7d&path=%2Fzh%2Fcv%2F');
      assert.equal(sourceResponse.status, 200);
      const sourceData = await sourceResponse.json(); assert.ok(Array.isArray(sourceData.sources));
      assert.ok(!JSON.stringify(sourceData).includes('visitor_hash'));
      const privacy = await get('/zh/privacy/'); assert.equal(privacy.status, 200);''')
    return s.replace('productionOrigin: manifest.origin, apiStatus:', "schemaVersion: 2, standalonePagesVerified: ['/zh/cv/', '/en/cv/', '/zh/contact/'], uvAndSourcesVerified: active,\n      productionOrigin: manifest.origin, apiStatus:")
edit('scripts/views/verify-live.mjs',verify)

def docs(s):
    s=s.replace('后台只有累计表 `view_totals` 和每日汇总表 `view_daily`；不保存访客记录、IP、身份、来源、设备或行为日志。','累计表 `view_totals` 和每日汇总表 `view_daily` 保留原 PV；v2 增加短期幂等回执、假名化访客每日去重和来源每日汇总，不保存原始 IP、账号、原始访客标识、完整来源 URL、设备指纹或点击日志。')
    s=s.replace('未准备好时不会显示小眼睛或伪造 0，也不会阻止原站正常部署。','v2 准备失败时停止新部署，保留已上线版本，避免静默关掉正在使用的计数。')
    s=s.replace('POST `/api/views` 仅接收 `{path, refs}`，','POST `/api/views` v2 接收 `{version:2, eventId, occurredAt, visitorId, attribution, path, refs}`；兼容旧页面的 `{path,refs}`，旧协议只计 PV，不伪造 UV 或来源。')
    return s+'''\n\n## v2：幂等 PV、浏览器 UV、来源与独立页面

原笔记保持 `zh/slug` / `en/slug`；简历等页面使用 `page:/zh/cv`。全部正式语言页面独立计数。查询参数、片段、末尾斜杠及 index.html 不拆分页面身份。中英文分开。

小眼睛继续显示 PV。正常刷新生成新事件，PV +1；同一事件在 24 小时接收窗口内重复上报只认一次。首次登记及全部递增受同一 D1 事务和请求所有权条件控制。不是忽略重复 INSERT 后继续无条件加一。不做 30 分钟刷新合并。幂等回执 48 小时过期，清理后的原请求已超过接收窗口。

UV 使用本地随机 UUID，最长 90 天，Web Locks 可用时跨标签页创建互斥；存储不可用时只计无法识别身份的 PV，不伪造新的 UV。D1 仅存站点 HMAC-SHA256 摘要。运行密钥 `VIEWS_HASH_SECRET` 自动生成一次，仅保留在 Pages secret，部署不轮换。GPC、DNT、webdriver、本人排除仍只读。

UV 在全站或指定页面分别 COUNT DISTINCT，跨日、跨页面、跨来源都不相加。summary.uv 提供 today/yesterday/last7Days/last30Days、启用日、90 天保留范围及 identifiableViews30Days。身份是独立浏览器，不是跨设备的真实自然人，不提供永久累计 UV。

来源只接受规范化 utm_source/utm_medium 或外部来源域名，并保留 basis。新入口标签优先，其次 referrer；同标签页 30 分钟活跃入口链内的站内跳转继承来源；新的外部入口覆盖，无来源直接进入重置 Unknown。来源是分发证据，不保证真实平台。API 请求头 Referer 继续做页面校验，不当成来源。

```text
GET /api/views?path=/zh/cv/
GET /api/views?mode=summary&path=/zh/cv/
GET /api/views?mode=sources&period=7d
GET /api/views?mode=sources&period=30d&path=/zh/cv/
GET /api/views?mode=top&type=pages&period=30d
GET /api/views?mode=top&type=all&period=7d
```

Sources 是入口链归因 PV/UV，不冒充访问会话或入口次数；最多 50 个来源，并标示 truncated。只公开聚合，不公开事件、访客摘要或任意 SQL。UV、来源及非笔记页面独立 PV 从升级开始，旧 PV 保留，无法补算旧 UV。

`View counter retention` 每日 workflow 使用现有 D1 凭据，只删除过期 view_events 及 90 个自然日以前的 view_visitors，不删累计、每日 PV 或来源聚合。GitHub 调度可能延迟或暂停，必要时可手动运行；不承诺精确到秒删除，底层备份策略独立适用。不新增独立 Worker 或统计平台。

页脚“统计与隐私”包含双语说明及当前浏览器退出开关。开关只影响第一方计数，不改变 Cloudflare Web Analytics。测试覆盖重复并发、失败回滚、旧数保留、CV 独立计数、跨日去重、存储失败、来源清洗及入口继承。runtime-test.mjs 使用本地 Miniflare D1 binding；浏览器展示验证使用隔离数据，不写生产计数。
'''
edit('docs/view-counter.md',docs)
