import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateManifest, verifyArticle, issueMetadata, confirmPostUrl, sha256 } from './core.mjs';
import { reconcile } from './reconcile.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiRoot = 'https://api.github.com';
const prefix = () => `/repos/${repository}`;

async function api(route, method = 'GET', body) {
  const response = await fetch(`${apiRoot}${route}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${route.split('?')[0]}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

async function allIssues() {
  const result = [];
  for (let page = 1; page <= 100; page++) {
    const items = await api(`${prefix()}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error('Invalid Issue response.');
    result.push(...items);
    if (items.length < 100) return result;
  }
  throw new Error('Issue scan exceeded its bound; no partial reconciliation is allowed.');
}

async function successfulRun() {
  let id = process.env.UPSTREAM_RUN_ID;
  if (!id) {
    const response = await api(`${prefix()}/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=1`);
    id = response.workflow_runs?.[0]?.id;
  }
  if (!/^\d+$/.test(String(id || ''))) throw new Error('No successful production CI run.');
  const run = await api(`${prefix()}/actions/runs/${id}`);
  if (run.status !== 'completed' || run.conclusion !== 'success' || run.event !== 'push'
    || run.head_branch !== 'main' || run.path !== '.github/workflows/ci.yml'
    || run.head_repository?.full_name !== repository || !/^[a-f0-9]{40}$/.test(run.head_sha)) throw new Error('Untrusted or unsuccessful upstream CI run.');
  return run;
}

async function manifestFromRun(run) {
  const listing = await api(`${prefix()}/actions/runs/${run.id}/artifacts?per_page=100`);
  if (listing.total_count > 100) throw new Error('Unexpected artifact count.');
  const artifacts = listing.artifacts.filter((item) => item.name === 'notes-publication');
  if (artifacts.length !== 1 || artifacts[0].expired || artifacts[0].size_in_bytes > 2000000) throw new Error('A single unexpired publication artifact is required.');
  const artifact = artifacts[0];
  if (artifact.workflow_run?.head_sha && artifact.workflow_run.head_sha !== run.head_sha) throw new Error('Artifact SHA mismatch.');
  let response = await fetch(`${apiRoot}${prefix()}/actions/artifacts/${artifact.id}/zip`, {
    redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });
  if (response.status === 302) {
    const location = new URL(response.headers.get('location'));
    if (location.protocol !== 'https:') throw new Error('Invalid artifact location.');
    // Do not forward the GitHub token to the artifact storage host.
    response = await fetch(location, { signal: AbortSignal.timeout(30000) });
  }
  if (!response.ok) throw new Error(`Artifact download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 2000000) throw new Error('Artifact archive too large.');
  if (artifact.digest && artifact.digest !== `sha256:${sha256(bytes)}`) throw new Error('Artifact digest mismatch.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-social-'));
  try {
    const zip = path.join(temp, 'publication.zip'); fs.writeFileSync(zip, bytes);
    const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 8192 }).trim();
    if (entries !== 'notes.json') throw new Error('Unexpected publication artifact entries.');
    const json = execFileSync('unzip', ['-p', zip, 'notes.json'], { encoding: 'utf8', maxBuffer: 2000000 });
    return validateManifest(JSON.parse(json), run, repository);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function baselineRefs(manifest, run) {
  execFileSync('git', ['merge-base', '--is-ancestor', manifest.social.baselineSha, run.head_sha]);
  const prefix = `profiles/${manifest.profileId}/content/`;
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', manifest.social.baselineSha, '--', prefix], { encoding: 'utf8', maxBuffer: 2000000 });
  return new Set(files.split('\n').map((file) => /^((zh|en))\/notes\/([a-z0-9-]+)\.(?:mdx?|html)$/.exec(file.slice(prefix.length)))
    .filter(Boolean).map((match) => `${match[2]}/${match[3]}`));
}

async function confirmOrSkip(action) {
  const number = process.env.ISSUE_NUMBER;
  if (!/^[1-9][0-9]*$/.test(number || '')) throw new Error('A sharing Issue number is required.');
  const issue = await api(`${prefix()}/issues/${number}`);
  const metadata = issueMetadata(issue);
  if (issue.pull_request || issue.user?.login !== 'github-actions[bot]' || !metadata || metadata.repository !== repository) throw new Error('Not a managed sharing Issue.');
  const actor = process.env.GITHUB_ACTOR;
  const permission = await api(`${prefix()}/collaborators/${encodeURIComponent(actor)}/permission`);
  if (!['admin', 'maintain', 'write'].includes(permission.permission)) throw new Error('Write permission is required to record a result.');
  if (metadata.status !== 'ready') { summary(`Issue #${number} is already ${metadata.status}.`); return; }
  if (action === 'confirm' && process.env.DRAFT_HASH !== metadata.draftHash) throw new Error('Draft hash changed. Review the current Issue before confirming.');
  const updated = { ...metadata, status: action === 'confirm' ? 'published_manual' : 'skipped',
    ...(action === 'confirm' ? { postUrl: confirmPostUrl(process.env.POST_URL) } : {}),
    confirmedBy: actor, confirmedAt: new Date().toISOString() };
  const marker = Buffer.from(JSON.stringify(updated)).toString('base64url');
  const body = issue.body.replace(/<!-- dossierkit-social:[A-Za-z0-9_-]+ -->/, `<!-- dossierkit-social:${marker} -->`)
    .replace('状态：`ready`', `状态：\`${updated.status}\``)
    + `\n\n人工结果：${updated.status}${updated.postUrl ? ` · ${updated.postUrl}` : ''}（${actor}）。\n`;
  await api(`${prefix()}/issues/${number}`, 'PATCH', { body, state: 'closed', state_reason: action === 'confirm' ? 'completed' : 'not_planned' });
  summary(`Recorded ${updated.status} for Issue #${number}. No X API request was made.`);
}

function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${message}\n`);
}

export async function main() {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('GitHub runtime context is required.');
  const action = process.env.ACTION_MODE || 'prepare';
  if (!['prepare', 'confirm', 'skip'].includes(action)) throw new Error('Unknown sharing action.');
  if (action !== 'prepare') return confirmOrSkip(action);
  const run = await successfulRun();
  const manifest = await manifestFromRun(run);
  if (!manifest.social.assisted) { summary('Assisted sharing is disabled for this instance.'); return; }
  const result = await reconcile({ manifest, run, issues: await allIssues(), baselineRefs: baselineRefs(manifest, run),
    verify: verifyArticle,
    createdCommit: (note) => {
      const history = execFileSync('git', ['log', run.head_sha, '--follow', '--diff-filter=A', '--format=%H', '--', note.sourcePath], { encoding: 'utf8', maxBuffer: 100000 }).trim().split('\n');
      const sha = history.at(-1);
      if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Unable to resolve the creation commit.');
      return sha;
    },
    create: (body) => api(`${prefix()}/issues`, 'POST', body),
    update: (number, body) => api(`${prefix()}/issues/${number}`, 'PATCH', body)
  });
  summary(`## X assisted sharing\n\nCI #${run.id}; created ${result.created.length}, refreshed ${result.updated.length}, blocked ${result.blocked.length}, pending ${result.pending}, skipped ${result.skipped}.\n\n${[...result.created, ...result.updated].map((n) => `- [Issue #${n}](https://github.com/${repository}/issues/${n})`).join('\n')}\n\nNo posts were sent to X.`);
  for (const error of result.blocked) console.warn(`${error.noteRef}: ${error.error}`);
  if (result.blocked.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(error.message); process.exitCode = 1;
});
