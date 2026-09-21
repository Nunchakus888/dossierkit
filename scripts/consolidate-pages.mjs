import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const origin = 'https://sunionpeaks.pages.dev';
const legacyOrigin = 'https://dossierkit.pages.dev';
const ua = 'DossierKit-Deployment-Audit/1.0';
const get = (url, options = {}) => fetch(url, {
  redirect: 'manual', signal: AbortSignal.timeout(25000), headers: {'User-Agent': ua}, ...options
});
const receipt = { generatedAt: new Date().toISOString(), primary: 'sunionpeaks', legacy: 'dossierkit', mode: 'redirect-only', checks: [] };

// Never retire the legacy host unless the content site is already healthy.
const home = await get(`${origin}/zh/`);
assert.equal(home.status, 200, 'Primary home must be healthy before legacy retirement');
const html = await home.text();
assert.ok(!/Open DossierKit|http-equiv=["']refresh/i.test(html), 'No interstitial on home');
assert.equal((html.match(/<script[^>]+src=["'][^"']*cloudflareinsights\.com\/beacon/g) || []).length, 1, 'Exactly one production RUM beacon');

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
assert.ok(token && account, 'Cloudflare credentials must remain in the CI environment');
const api = async (path) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json();
  assert.ok(response.ok && payload.success, `Cloudflare read failed (${response.status})`);
  return payload.result;
};
const project = await api('/pages/projects/dossierkit');
assert.equal(project.name, 'dossierkit');
assert.equal(project.subdomain, 'dossierkit.pages.dev');
assert.equal(project.production_branch, 'main');
assert.ok(!project.source, 'Stop rather than fight an unreviewed Git build configuration');
assert.ok((project.domains || []).every(domain => domain === 'dossierkit.pages.dev'), 'Stop if legacy project has unreviewed custom domains');
receipt.previousDeployment = project.canonical_deployment?.id;

const query = '?utm_source=legacy_test&utm_medium=verification';
const probes = [['/', '/zh/'], ['/zh/', '/zh/'], ['/en/', '/en/'], ['/robots.txt', '/robots.txt'], ['/zh/notes/cloudflare-computer-agent-runtime-durable-objects-virtual-filesystem-exe/', '/zh/notes/cloudflare-computer-agent-runtime-durable-objects-virtual-filesystem-exe/']];
let alreadyRedirectOnly = true;
for (const [from, to] of probes) {
  const response = await get(`${legacyOrigin}${from}${query}`);
  if (response.status !== 301 || response.headers.get('location') !== `${origin}${to}${query}`) alreadyRedirectOnly = false;
}
const wrangler = resolve('node_modules/.bin/wrangler');
if (!alreadyRedirectOnly) {
  // Deploy from an isolated directory so current Pages Functions cannot be bundled into the retired host.
  const temp = await mkdtemp(join(tmpdir(), 'dossierkit-redirect-'));
  try {
    const directory = join(temp, 'public');
    await mkdir(directory);
    await writeFile(join(directory, '_redirects'), `/ ${origin}/zh/ 301\n/index.html ${origin}/zh/ 301\n/* ${origin}/:splat 301\n`);
    await writeFile(join(directory, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Moved</title><p>This site has moved.</p></html>\n');
    execFileSync(wrangler, ['pages', 'deploy', directory, '--project-name=dossierkit', '--branch=main', `--commit-hash=${process.env.GITHUB_SHA}`], { cwd: temp, stdio: 'inherit', timeout: 120000 });
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}
receipt.deploymentSkipped = alreadyRedirectOnly;

// Old browser OAuth is not needed by a static redirect alias. Do not touch the isolated Notes MCP.
const keys = Object.keys(project.deployment_configs?.production?.env_vars || {});
receipt.removedLegacyBindings = [];
for (const name of ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET']) {
  if (keys.includes(name)) {
    execFileSync(wrangler, ['pages', 'secret', 'delete', name, '--project-name=dossierkit'], { input: 'y\n', stdio: ['pipe', 'inherit', 'inherit'], timeout: 30000 });
    receipt.removedLegacyBindings.push(name);
  }
}

// Propagation checks retry HTTP reads only; no blind duplicate deployments.
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const root = await get(`${origin}/${query}`);
    assert.equal(root.status, 301);
    assert.equal(root.headers.get('location'), `/zh/${query}`);
    for (const [from, to] of probes) {
      const response = await get(`${legacyOrigin}${from}${query}`);
      assert.equal(response.status, 301, `Legacy status: ${from}`);
      assert.equal(response.headers.get('location'), `${origin}${to}${query}`, `Legacy destination: ${from}`);
    }
    break;
  } catch (error) {
    if (attempt === 5) throw error;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
for (const [path, status, type] of [['/robots.txt', 200, 'text/plain'], ['/sitemap-index.xml', 200, 'application/xml'], ['/sitemap-0.xml', 200, 'application/xml'], ['/__deployment_missing_page_check', 404, 'text/html']]) {
  const response = await get(origin + path);
  assert.equal(response.status, status, path);
  assert.ok(response.headers.get('content-type')?.startsWith(type), `${path}: expected ${type}`);
  const body = await response.text();
  assert.ok(!/Open DossierKit|http-equiv=["']refresh/i.test(body), `${path}: no HTML fallback`);
  if (path === '/robots.txt') assert.ok(body.includes(`Sitemap: ${origin}/sitemap-index.xml`));
  receipt.checks.push({path, status: response.status, contentType: response.headers.get('content-type')});
}
const after = await api('/pages/projects/dossierkit');
receipt.currentDeployment = after.canonical_deployment?.id;
receipt.legacyUsesFunctions = after.canonical_deployment?.uses_functions ?? after.uses_functions;
receipt.remainingLegacyBindingNames = Object.keys(after.deployment_configs?.production?.env_vars || {});
assert.ok(!receipt.legacyUsesFunctions, 'Legacy production must not serve Functions');
assert.ok(!receipt.remainingLegacyBindingNames.includes('GITHUB_OAUTH_CLIENT_SECRET'));
receipt.primaryRoot = {status: 301, destination: '/zh/', queryPreserved: true};
receipt.legacyRedirects = probes.map(([from,to]) => ({from, to: origin+to, status: 301, queryPreserved: true}));
await mkdir('artifacts/site-routing', {recursive: true});
await writeFile('artifacts/site-routing/receipt.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
