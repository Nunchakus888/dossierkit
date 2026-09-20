import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { saveNoteToGitHub as save, getNoteFromGitHub as get, deleteNoteFromGitHub as remove, noteSaveInputSchema } from '../src/server/github-note-bundles';
import { prepareNote } from '../src/lib/note-ingest';
import { onRequest } from '../functions/api/mcp';
const env = {NOTES_GITHUB_TOKEN:'test-only',NOTES_GITHUB_REPOSITORY:'owner/repository',NOTES_GITHUB_BRANCH:'main',NOTES_PROFILE_ID:'default',PUBLIC_SITE_URL:'https://notes.example.com'};
const origin = env.PUBLIC_SITE_URL;
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><title>Execution layers</title><rect width="1200" height="630" fill="#fff"/><text x="80" y="100" font-size="48">Harness</text></svg>';
const markdown = '# Runtime Layers\n\nThis engineering note explains the separation between durable reasoning state and the environment that executes tools.\n\n## Architecture\n\n![Execution layers](asset:cover.svg)\n\nThe controller keeps state while the sandbox executes commands with explicit permissions.\n';
const repo = mockRepository();
const input = {markdown,topics:['Agent Runtime','Harness'],assets:{'cover.svg':svg}};
assert.throws(() => noteSaveInputSchema.parse({...input,share:{}}));
const created = await save(input,env,origin,repo.fetch);
assert.equal(created.action,'created');
assert.equal(repo.moves,1,'one branch change commits the document and artwork atomically');
assert.ok(repo.current().get(created.path)?.includes(`/notes/${created.noteRef}/cover.svg`));
assert.ok(repo.current().has(`profiles/default/assets/notes/${created.noteRef}/cover.svg`));
const minimalRead = await get({query:created.noteRef},env,origin,repo.fetch);
assert.deepEqual(minimalRead.note?.assetNames,['cover.svg']);
assert.equal(minimalRead.note?.assets,undefined,'text edits should not read SVG tokens');
assert.ok(minimalRead.note?.markdown?.includes('asset:cover.svg'));
const fullRead = await get({query:created.noteRef,includeAssets:true},env,origin,repo.fetch);
assert.ok(fullRead.note?.assets?.['cover.svg'].includes('Harness'));
assert.equal(fullRead.note?.contentHash,created.contentHash);
const again = await save(input,env,origin,repo.fetch);
assert.equal(again.action,'unchanged');
assert.equal(repo.moves,1);
const edit = {...input,markdown:markdown.replace('explicit permissions','explicit, bounded permissions'),noteRef:created.noteRef};
const changedText = await save({markdown:edit.markdown,noteRef:created.noteRef},env,origin,repo.fetch);
assert.equal(changedText.action,'updated');
assert.deepEqual(changedText.assetNames,['cover.svg']);
const changedArt = await save({...edit,assets:{'cover.svg':svg.replace('Harness','Orchestration')}},env,origin,repo.fetch);
assert.notEqual(changedArt.contentHash,changedText.contentHash,'only replacing a picture changes the effective version');
await assert.rejects(() => remove({noteRef:created.noteRef,contentHash:changedText.contentHash},env,origin,repo.fetch), /changed after/);
const beforeBad = repo.moves;
await assert.rejects(() => save({...edit,assets:{'cover.svg':null}},env,origin,repo.fetch), /missing referenced/);
assert.equal(repo.moves,beforeBad,'invalid deletions never reach the branch');
const independent = await save({noteRef:created.noteRef,markdown:edit.markdown.replace('![Execution layers](asset:cover.svg)','')},env,origin,repo.fetch);
assert.deepEqual(independent.assetNames,['cover.svg'],'removing the visible image does not remove the sharing cover');
const latest = await get({query:created.noteRef},env,origin,repo.fetch);
const deleted = await remove({noteRef:created.noteRef,contentHash:latest.note!.contentHash},env,origin,repo.fetch);
assert.equal(deleted.action,'deleted');
assert.ok(!repo.current().has(created.path));
assert.ok(!repo.current().has(`profiles/default/assets/notes/${created.noteRef}/cover.svg`));
const plain = {markdown:'# Plain Note\n\nThis is a sufficiently detailed plain text note describing backward compatibility with existing canonical documents.\n',topics:['Compatibility']};
const plainSave = await save(plain,env,origin,repo.fetch);
assert.equal(plainSave.contentHash,(await prepareNote(plain)).contentHash);
assert.deepEqual(plainSave.assetNames,[]);
const html = '<h1>HTML Asset Note</h1><p>This semantic document describes a controller and a runtime with clear responsibility and durable execution state.</p><img src="asset:cover.svg" alt="Execution layers">';
const htmlSave = await save({html,topics:['HTML Assets'],assets:{'cover.svg':svg}},env,origin,repo.fetch);
const htmlRead = await get({query:htmlSave.noteRef,includeAssets:true},env,origin,repo.fetch);
assert.ok(htmlRead.note?.html?.includes('src="asset:cover.svg"'),'HTML aliases survive safe ingestion and roundtrip');
const callsBefore = repo.calls;
await assert.rejects(() => save({...input,assets:{'cover.svg':svg.replace('</svg>','<script>x()</script></svg>')}},env,origin,repo.fetch), /Invalid note asset/);
assert.equal(repo.calls,callsBefore,'unsafe SVG is rejected before GitHub access');
await assert.rejects(() => save({...input,markdown:markdown+'\n<svg></svg>'},env,origin,repo.fetch), /inline SVG/);
const concurrent = mockRepository();
concurrent.conflictNext = true;
await assert.rejects(() => save(input,env,origin,concurrent.fetch), /no force push/);
assert.equal(concurrent.moves,0);
assert.ok(concurrent.current().has('unrelated.txt'),'concurrent commits remain intact');
const uncertain = mockRepository();
uncertain.timeoutNext = true;
await assert.rejects(() => save(input,env,origin,uncertain.fetch), /not confirmed/);
assert.equal((await save(input,env,origin,uncertain.fetch)).action,'unchanged');
assert.equal(uncertain.moves,1,'retry after ambiguous response does not publish twice');
// Actual MCP wire discovery + tools/call against fake GitHub, not just direct function tests.
const realFetch = globalThis.fetch;
try {
  const wire = mockRepository(); globalThis.fetch = wire.fetch;
  const response = await onRequest({env,request:new Request('http://localhost/api/mcp',{method:'POST',headers:{Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_note',arguments:input}})})});
  const payload = await response.json();
  assert.equal(payload.result?.isError,undefined,JSON.stringify(payload));
  assert.equal(payload.result?.structuredContent?.action,'created');
  assert.deepEqual(payload.result?.structuredContent?.assetNames,['cover.svg']);
  assert.equal(wire.moves,1);
} finally { globalThis.fetch = realFetch; }
console.log('Note bundle tests passed: Markdown/HTML, atomic save, preservation, image-only edits, safety, deletion, concurrency, retry and MCP wire call.');

function mockRepository() {
  const sha = (value: unknown) => createHash('sha1').update(JSON.stringify(value)).digest('hex');
  let head = sha('initial'), moves = 0, calls = 0;
  const snapshots = new Map([[head,new Map<string,string>()]]), trees = new Map<string,Map<string,string>>(), parents = new Map<string,string>();
  const api = {
    conflictNext:false,timeoutNext:false,current:() => snapshots.get(head)!,get moves(){return moves;},get calls(){return calls;},
    fetch: (async (request, init) => {
      calls++;
      const u = new URL(request instanceof Request ? request.url : String(request));
      const method = init?.method || 'GET', body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const p = decodeURIComponent(u.pathname.replace('/repos/owner/repository',''));
      if (method === 'GET' && p.startsWith('/git/ref/heads/')) return json({object:{sha:head}});
      if (method === 'GET' && p.startsWith('/git/commits/')) {
        const id = p.split('/').at(-1)!; return json({tree:{sha:id}});
      }
      if (method === 'GET' && p.startsWith('/contents/')) {
        const file = p.slice('/contents/'.length), snapshot = snapshots.get(u.searchParams.get('ref') || head) || snapshots.get(head)!;
        if (snapshot.has(file)) return json({encoding:'base64',content:Buffer.from(snapshot.get(file)!).toString('base64'),sha:sha(snapshot.get(file))});
        const prefix = file + '/', names = [...snapshot.keys()].filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'));
        if (!names.length) return json({message:'Not Found'},404);
        return json(names.map((key) => ({name:key.slice(prefix.length),path:key,type:'file'})));
      }
      if (method === 'POST' && p === '/git/trees') {
        const files = new Map(snapshots.get(body.base_tree));
        for (const item of body.tree) item.sha === null ? files.delete(item.path) : files.set(item.path,item.content);
        const id = sha([...files]); trees.set(id,files); return json({sha:id});
      }
      if (method === 'POST' && p === '/git/commits') {
        const id = sha(body); snapshots.set(id,new Map(trees.get(body.tree))); parents.set(id,body.parents[0]); return json({sha:id});
      }
      if (method === 'PATCH' && p.startsWith('/git/refs/heads/')) {
        assert.equal(body.force,false);
        if (api.conflictNext) { api.conflictNext=false; const newer = new Map(snapshots.get(head)); newer.set('unrelated.txt','other editor'); head=sha('concurrent'); snapshots.set(head,newer); }
        if (parents.get(body.sha) !== head) return json({message:'Update is not a fast forward'},422);
        head=body.sha; moves++;
        if (api.timeoutNext) { api.timeoutNext=false; throw new Error('network timeout after GitHub accepted the change'); }
        return json({object:{sha:head}});
      }
      throw new Error(`Unexpected real backend mutation: ${method} ${p}`);
    }) as typeof fetch
  };
  return api;
}
function json(value: unknown,status=200) { return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}); }
