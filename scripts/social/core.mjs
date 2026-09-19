import { createHash } from 'node:crypto';
import { canonicalArticleUrl, composePost } from '../../src/lib/social-text.mjs';
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const endMarker = '<!-- /dossierkit-social -->';

export function validateManifest(value, run, repository) {
  if (!value || value.version !== 1 || value.sha !== run.head_sha
    || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.siteId)
    || !/^[a-zA-Z0-9_-]+$/.test(value.profileId)
    || !Array.isArray(value.notes) || value.notes.length > 10000) throw new Error('Invalid publication manifest or provenance.');
  const config = value.social;
  if (typeof config?.assisted !== 'boolean') throw new Error('Invalid sharing policy.');
  if (!config.assisted) return value;
  if (value.repository !== repository) throw new Error('Instance repository mismatch.');
  canonicalArticleUrl(value.productionOrigin, 'zh/validation');
  if (!config || typeof config.assisted !== 'boolean' || !/^[a-f0-9]{40}$/.test(config.baselineSha)
    || !Number.isInteger(config.maxPerRun) || config.maxPerRun < 1 || config.maxPerRun > 10
    || !Array.isArray(config.locales) || !config.locales.length || config.locales.some((l) => !['zh', 'en'].includes(l))) throw new Error('Invalid sharing policy.');
  const seen = new Set();
  for (const note of value.notes) {
    const expected = canonicalArticleUrl(value.productionOrigin, note.noteRef);
    const [locale, slug] = note.noteRef.split('/');
    const prefix = `profiles/${value.profileId}/content/${locale}/notes/${slug}.`;
    if (seen.has(note.noteRef) || note.url !== expected || typeof note.title !== 'string' || !note.title.trim()
      || note.title.length > 2000 || typeof note.summary !== 'string' || note.summary.length > 10000
      || typeof note.assisted !== 'boolean' || typeof note.socialText !== 'string' || note.socialText.length > 1000
      || !/^sha256:[a-f0-9]{64}$/.test(note.fingerprint)
      || !['md', 'mdx', 'html'].some((ext) => note.sourcePath === prefix + ext)) throw new Error('Invalid manifest note.');
    seen.add(note.noteRef);
  }
  return value;
}

export function deliveryId(manifest, noteRef) {
  return sha256([manifest.repository, manifest.siteId, manifest.profileId, noteRef, 'x', 'initial'].join(':'));
}

export function issueMetadata(issue) {
  const match = /<!-- dossierkit-social:([A-Za-z0-9_-]+) -->/.exec(issue.body || '');
  if (!match || match[1].length > 16000) return undefined;
  try {
    const data = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    if (data.version !== 1 || !/^[a-f0-9]{64}$/.test(data.id)
      || !['ready', 'published_manual', 'skipped'].includes(data.status)) return undefined;
    return data;
  } catch { return undefined; }
}

export function buildDraft(manifest, note, run, createdCommitSha, previous) {
  const draft = composePost({ ...note, text: note.socialText });
  const metadata = {
    version: 1, id: deliveryId(manifest, note.noteRef), repository: manifest.repository,
    noteRef: note.noteRef, status: 'ready', fingerprint: note.fingerprint,
    draftHash: sha256(draft.fullText), ciRunId: run.id, deployedSha: run.head_sha,
    createdCommitSha, createdAt: previous?.createdAt || new Date().toISOString()
  };
  return { draft, metadata };
}

export function renderIssue(metadata, draft, previousBody = '') {
  const marker = Buffer.from(JSON.stringify(metadata)).toString('base64url');
  const workflow = `https://github.com/${metadata.repository}/actions/workflows/social-assist.yml`;
  const block = [`<!-- dossierkit-social:${marker} -->`,
    `笔记：\`${metadata.noteRef}\` · 状态：\`${metadata.status}\``, '',
    '```text', draft.fullText, '```', '',
    `[打开 X 编辑框](${draft.intentUrl}) · [正式文章](${draft.url})`, '',
    `创建提交：[${metadata.createdCommitSha.slice(0, 8)}](https://github.com/${metadata.repository}/commit/${metadata.createdCommitSha})`,
    `部署提交：\`${metadata.deployedSha}\` · [CI #${metadata.ciRunId}](https://github.com/${metadata.repository}/actions/runs/${metadata.ciRunId})`,
    `文章指纹：\`${metadata.fingerprint}\``, `文案指纹：\`${metadata.draftHash}\``, '',
    '仅辅助发送：打开编辑框不代表已发布；发送前请核对正式文章。',
    `[登记结果](${workflow})：选择 confirm 并填写本 Issue 编号、上方文案指纹及帖子链接；不发送可选择 skip。`, endMarker].join('\n');
  const previousEnd = previousBody.indexOf(endMarker);
  const tail = previousEnd >= 0 ? previousBody.slice(previousEnd + endMarker.length)
    : '\n\n## 人工备注\n\n';
  return block + tail;
}

export function confirmPostUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)
    || url.username || url.password || url.port || !/^\/[a-zA-Z0-9_]{1,15}\/status\/[1-9][0-9]+\/?$/.test(url.pathname)) throw new Error('Use a real X post URL.');
  return `https://x.com${url.pathname.replace(/\/$/, '')}`;
}

export function pageAttributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(([, key, double, single]) => [key.toLowerCase(), double ?? single]));
}

export function validateArticleHtml(html, finalUrl, note) {
  const normalize = (value) => { const url = new URL(value); return `${url.origin}${url.pathname.replace(/\/$/, '')}`; };
  if (normalize(finalUrl) !== normalize(note.url)) throw new Error('Article redirected away from its canonical path.');
  const meta = new Map([...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => {
    const attrs = pageAttributes(tag); return [attrs.name, attrs.content];
  }));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => pageAttributes(tag));
  const canonical = links.find((attrs) => attrs.rel === 'canonical')?.href;
  if (!canonical || normalize(canonical) !== normalize(note.url)
    || meta.get('dossierkit:note-ref') !== note.noteRef
    || meta.get('dossierkit:content-hash') !== note.fingerprint) throw new Error('Article identity/version is not deployed yet.');
  return true;
}

export async function verifyArticle(note, requestFetch = fetch) {
  let url = new URL(note.url);
  url.searchParams.set('__dk_verify', note.fingerprint.slice(-16));
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await requestFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = new URL(response.headers.get('location') || '', url);
      if (next.origin !== new URL(note.url).origin) throw new Error('Cross-origin article redirect.');
      url = next; continue;
    }
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) throw new Error(`Article HTTP ${response.status}.`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2000000) throw new Error('Article response is too large.');
    return validateArticleHtml(new TextDecoder().decode(bytes), url.toString(), note);
  }
  throw new Error('Too many article redirects.');
}
