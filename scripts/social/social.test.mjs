import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalArticleUrl, composePost, plainText, weightedUpperBound, shorten } from '../../src/lib/social-text.mjs';
import { validateManifest, deliveryId, buildDraft, issueMetadata, renderIssue, validateArticleHtml, verifyArticle, confirmPostUrl } from './core.mjs';
import { reconcile } from './reconcile.mjs';
const sha = 'a'.repeat(40);
const run = { id: 123, head_sha: sha };
const note = { noteRef: 'zh/first-note', title: '测试文章', summary: '架构与设计边界。', url: 'https://notes.example.org/zh/notes/first-note', fingerprint: `sha256:${'a'.repeat(64)}`, socialText: '', assisted: true, sourcePath: 'profiles/default/content/zh/notes/first-note.mdx' };
const manifest = { version: 1, repository: 'owner/notes', siteId: 'notes', profileId: 'default', productionOrigin: 'https://notes.example.org', sha, social: { assisted: true, baselineSha: sha, maxPerRun: 5, locales: ['zh'] }, notes: [note] };
const clone = (value) => structuredClone(value);
const article = (n = note) => `<link rel="canonical" href="${n.url}"><meta name="dossierkit:note-ref" content="${n.noteRef}"><meta name="dossierkit:content-hash" content="${n.fingerprint}">`;

function adapters(overrides = {}) {
  let next = 1;
  const issues = [];
  return { manifest, run, issues, baselineRefs: new Set(), verify: async () => true, createdCommit: async () => sha,
    create: async (data) => { const issue = { ...data, number: next++, state: 'open', user: { login: 'github-actions[bot]' } }; issues.push(issue); return issue; },
    update: async (number, data) => Object.assign(issues.find((item) => item.number === number), data), ...overrides };
}

test('canonical identity rejects traversal, query injection and credentials', () => {
  assert.equal(canonicalArticleUrl(manifest.productionOrigin, note.noteRef), note.url);
  for (const ref of ['zh/../private', 'zh/a?x=1', 'fr/note', 'zh/<img>']) assert.throws(() => canonicalArticleUrl(manifest.productionOrigin, ref));
  for (const origin of ['http://example.org', 'https://u:p@example.org', 'https://example.org/path']) assert.throws(() => canonicalArticleUrl(origin, note.noteRef));
});
test('CJK budgeting, normalization and grapheme-safe truncation', () => {
  assert.equal(weightedUpperBound('中文'), 4);
  assert.equal(weightedUpperBound('abc'), 3);
  assert.equal(weightedUpperBound('e\u0301'), weightedUpperBound('é'));
  const joined = '👩‍👩‍👧‍👦'; assert.equal(shorten(joined.repeat(20), 20), joined + '…');
  const draft = composePost({ title: '标题'.repeat(100), summary: '摘要'.repeat(500), url: note.url });
  assert.ok(weightedUpperBound(draft.text) + 24 <= 260);
  assert.equal(new URL(draft.intentUrl).searchParams.get('url'), note.url);
  assert.equal(new URL(draft.intentUrl).hostname, 'x.com');
});
test('draft strips markup, unintended mentions and extra URLs', () => {
  assert.equal(plainText('[事实] **架构** [原文](https://example.org) @someone <b>安全</b>'), '架构 原文 ＠someone 安全');
});
test('manifest binds instance and deployed SHA; disabled templates remain inert', () => {
  assert.equal(validateManifest(manifest, run, 'owner/notes'), manifest);
  assert.throws(() => validateManifest(manifest, { ...run, head_sha: 'b'.repeat(40) }, 'owner/notes'));
  assert.throws(() => validateManifest(manifest, run, 'other/repo'));
  const disabled = { ...manifest, repository: '', productionOrigin: '', social: { assisted: false, baselineSha: '' } };
  assert.equal(validateManifest(disabled, run, 'other/repo'), disabled);
});
test('manifest rejects duplicate identities and fake source paths', () => {
  assert.throws(() => validateManifest({ ...manifest, notes: [note, note] }, run, manifest.repository));
  assert.throws(() => validateManifest({ ...manifest, notes: [{ ...note, sourcePath: '../../secret' }] }, run, manifest.repository));
});
test('HTTP 200 homepage and old article fingerprints do not qualify', () => {
  assert.throws(() => validateArticleHtml('<h1>Home</h1>', note.url, note));
  assert.throws(() => validateArticleHtml(article(), 'https://notes.example.org/zh/', note));
  assert.throws(() => validateArticleHtml(article({ ...note, fingerprint: 'stale' }), note.url, note));
  assert.equal(validateArticleHtml(article(), `${note.url}/?utm_source=x`, note), true);
});
test('URL verifier refuses off-site redirects', async () => {
  await assert.rejects(() => verifyArticle(note, async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } })), /Cross-origin/);
});
test('valid article verifies without authentication', async () => {
  await verifyArticle(note, async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return new Response(article(), { headers: { 'content-type': 'text/html' } });
  });
});
test('first enable excludes all baseline Notes', async () => {
  const result = await reconcile(adapters({ baselineRefs: new Set([note.noteRef]) }));
  assert.deepEqual(result.created, []);
});
test('canceled earlier CI is recovered by a full manifest scan', async () => {
  const second = { ...note, noteRef: 'zh/second-note', url: note.url.replace('first', 'second'), sourcePath: note.sourcePath.replace('first', 'second') };
  const ctx = adapters({ manifest: { ...manifest, notes: [note, second] } });
  assert.equal((await reconcile(ctx)).created.length, 2);
});
test('reruns and edits of a closed task do not create duplicate Issues', async () => {
  const ctx = adapters(); await reconcile(ctx);
  assert.equal((await reconcile(ctx)).created.length, 0);
  ctx.issues[0].state = 'closed';
  ctx.manifest = { ...manifest, notes: [{ ...note, fingerprint: `sha256:${'b'.repeat(64)}` }] };
  assert.equal((await reconcile(ctx)).created.length, 0);
  assert.equal(ctx.issues.length, 1);
});
test('draft refresh preserves human notes; text overrides invalidate draft hash', async () => {
  const ctx = adapters(); await reconcile(ctx);
  ctx.issues[0].body += '\nHuman annotation';
  const old = issueMetadata(ctx.issues[0]);
  ctx.manifest = { ...manifest, notes: [{ ...note, socialText: '新的分享文案' }] };
  assert.equal((await reconcile(ctx)).updated.length, 1);
  assert.ok(ctx.issues[0].body.endsWith('Human annotation'));
  assert.notEqual(issueMetadata(ctx.issues[0]).draftHash, old.draftHash);
});
test('ambiguous Issue POST result is reconciled before another attempt', async () => {
  const ctx = adapters(); const create = ctx.create;
  ctx.create = async (data) => { await create(data); throw new Error('connection lost after write'); };
  assert.equal((await reconcile(ctx)).blocked.length, 1);
  ctx.create = create;
  assert.equal((await reconcile(ctx)).created.length, 0);
  assert.equal(ctx.issues.length, 1);
});
test('per-run bound leaves a recoverable backlog', async () => {
  const notes = Array.from({ length: 3 }, (_, i) => ({ ...note, noteRef: `zh/note-${i}` }));
  const ctx = adapters({ manifest: { ...manifest, social: { ...manifest.social, maxPerRun: 1 }, notes } });
  assert.equal((await reconcile(ctx)).pending, 2);
  await reconcile(ctx); await reconcile(ctx);
  assert.equal(ctx.issues.length, 3);
});
test('duplicate managed records stop reconciliation', async () => {
  const ctx = adapters(); await reconcile(ctx); ctx.issues.push(clone(ctx.issues[0]));
  await assert.rejects(() => reconcile(ctx), /Duplicate sharing records/);
});
test('manual confirmation only accepts post URLs, not intents or profiles', () => {
  assert.equal(confirmPostUrl('https://x.com/author/status/12345?s=20'), 'https://x.com/author/status/12345');
  for (const url of ['https://evil.example/author/status/123', 'https://x.com/intent/tweet', 'javascript:alert(1)', 'https://user:pass@x.com/a/status/123']) assert.throws(() => confirmPostUrl(url));
});
test('metadata round-trips and identifies the creation commit independently', () => {
  const { metadata, draft } = buildDraft(manifest, note, run, 'b'.repeat(40));
  const parsed = issueMetadata({ body: renderIssue(metadata, draft) });
  assert.equal(parsed.id, deliveryId(manifest, note.noteRef));
  assert.notEqual(parsed.createdCommitSha, parsed.deployedSha);
});
