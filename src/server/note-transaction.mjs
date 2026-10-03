// Adapt existing canonical-document operations to a snapshot + staged Git tree.
// No write reaches the branch until all document and asset validation succeeds.
export async function openNoteTransaction(env, requestFetch = fetch) {
  const repository = env.NOTES_GITHUB_REPOSITORY || '';
  const profile = env.NOTES_PROFILE_ID || 'default';
  const branch = env.NOTES_GITHUB_BRANCH || 'main';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w-]+$/.test(profile) || !/^[\w./-]+$/.test(branch) || branch.includes('..')) throw new Error('Invalid Notes repository configuration.');
  if (!env.NOTES_GITHUB_TOKEN) throw new Error('NOTES_GITHUB_TOKEN is not configured.');
  const base = `https://api.github.com/repos/${repository}`;
  const headers = { Accept:'application/vnd.github+json', Authorization:`Bearer ${env.NOTES_GITHUB_TOKEN}`, 'Content-Type':'application/json', 'User-Agent':'dossierkit-notes-mcp', 'X-GitHub-Api-Version':'2022-11-28' };
  const api = async (path, method = 'GET', body) => {
    const response = await requestFetch(base + path, { method, headers, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    const payload = await response.json();
    if (!response.ok) throw new Error(`GitHub ${method} failed (${response.status}): ${payload.message || 'request rejected'}`);
    return payload;
  };
  const head = await api('/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/'));
  const sha = head.object?.sha;
  if (!/^[a-f0-9]{40,64}$/.test(sha || '')) throw new Error('GitHub did not return a valid branch revision.');
  const cache = new Map(), changes = new Map();
  function assertPath(path) {
    const prefix = `profiles/${profile}/`;
    if (!path.startsWith(prefix) || !/^(?:content\/(zh|en)\/notes\/[a-z0-9-]+\.(?:md|mdx|html)|assets\/notes\/(zh|en)\/[a-z0-9-]+\/[a-z][a-z0-9-]{0,47}\.svg)$/.test(path.slice(prefix.length))) throw new Error('Transaction cannot write outside this note namespace.');
  }
  const readResponse = async (path) => {
    if (!cache.has(path)) {
      const url = new URL(base + '/contents/' + path.split('/').map(encodeURIComponent).join('/'));
      url.searchParams.set('ref', sha);
      cache.set(path, await requestFetch(url, {headers}));
    }
    return cache.get(path).clone();
  };
  const read = async (path) => {
    const response = await readResponse(path);
    if (response.status === 404) return undefined;
    const value = await response.json();
    if (!response.ok) throw new Error(`GitHub snapshot read failed (${response.status}).`);
    return value;
  };
  const stage = (path, value) => { assertPath(path); changes.set(path, value); };
  return {
    repository, profile, branch, sha, changes, read, stage,
    fetch: async (request, init) => {
      const url = new URL(request instanceof Request ? request.url : String(request));
      const method = init?.method || 'GET';

      if (url.origin === 'https://api.github.com' && url.pathname === '/graphql') {
        if (method !== 'POST') throw new Error('Unexpected GitHub GraphQL request.');
        const payload = JSON.parse(String(init?.body || '{}'));
        const query = String(payload.query || '');
        if (!/^\s*query\b/i.test(query) || /\bmutation\b/i.test(query)) {
          throw new Error('Only read-only GitHub GraphQL queries are allowed in a note transaction.');
        }
        const expression = payload.variables?.expression;
        if (typeof expression !== 'string') throw new Error('GitHub GraphQL note query is missing its expression.');
        const separator = expression.indexOf(':');
        const directory = separator >= 0 ? expression.slice(separator + 1) : expression;
        const allowedPrefix = `profiles/${profile}/content/`;
        if (!directory.startsWith(allowedPrefix) || !/\/(?:zh|en)\/notes$/.test(directory)) {
          throw new Error('GitHub GraphQL note query is outside the canonical note namespace.');
        }
        const body = JSON.stringify({
          ...payload,
          variables: {
            ...payload.variables,
            expression: `${sha}:${directory}`
          }
        });
        return requestFetch(url, { ...init, method: 'POST', headers, body });
      }

      const prefix = base + '/contents/';
      if (!url.href.startsWith(prefix)) throw new Error('Unexpected canonical repository request.');
      const path = decodeURIComponent(url.pathname.split('/contents/')[1]);
      if (method === 'GET') return readResponse(path);
      if (!['PUT','DELETE'].includes(method)) throw new Error('Unexpected canonical mutation.');
      const payload = JSON.parse(String(init?.body));
      stage(path, method === 'DELETE' ? null : decodeContent(payload.content));
      // This is an internal staged response, never a claim that a commit exists.
      return new Response(JSON.stringify({commit:{}}), {status:200,headers:{'Content-Type':'application/json'}});
    },
    commit: async (message) => {
      if (!changes.size) return undefined;
      const parent = await api('/git/commits/' + sha);
      const tree = await api('/git/trees', 'POST', {
        base_tree:parent.tree.sha,
        tree:[...changes].map(([path, value]) => ({path,mode:'100644',type:'blob',...(value === null ? {sha:null} : {content:value})}))
      });
      const commit = await api('/git/commits', 'POST', {message,tree:tree.sha,parents:[sha]});
      try { await api('/git/refs/heads/' + branch.split('/').map(encodeURIComponent).join('/'), 'PATCH', {sha:commit.sha,force:false}); }
      catch (error) { throw new Error(`Branch update not confirmed for commit ${commit.sha}. Read the note again before retrying; no force push was attempted. ${error.message}`); }
      return `https://github.com/${repository}/commit/${commit.sha}`;
    }
  };
}
export function decodeContent(encoded = '') {
  return new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(atob(encoded.replace(/\s/g,'')), (c) => c.charCodeAt(0)));
}
