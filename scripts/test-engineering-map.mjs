import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateMap, renderEngineeringMap } from '../src/lib/engineering-map/render.mjs';
const data=JSON.parse(readFileSync(new URL('../profiles/default/engineering-map.json',import.meta.url),'utf8'));
test('six groups, eighteen capabilities, three independent project records',()=>{
  validateMap(data);
  assert.equal(data.domains.length,6);assert.equal(data.nodes.length,18);assert.equal(data.projects.length,3);
  assert.ok(data.domains.every(d=>d.nodes.length===3));
});
test('every node has concrete technologies, contribution, project, problem and boundary',()=>{
  for(const n of data.nodes) {assert.ok(n.tech.length);assert.ok(n.work);assert.ok(n.problem);assert.ok(n.boundary);assert.ok(data.projects.some(p=>p.id===n.project));}
  assert.equal(data.nodes.find(n=>n.id==='agent-02').mode,'integration');
  assert.ok(data.extensions.some(x=>x.kind==='plan'&&x.title.includes('多 Agent')));
  assert.ok(data.extensions.some(x=>x.kind==='research'));
});
test('all skills and contributions are initially visible, with no skill links or scripts',()=>{
  const html=renderEngineeringMap(data);
  const graph=html.slice(html.indexOf('<section class="graph"'),html.indexOf('<section class="dependencies"'));
  assert.equal((graph.match(/data-capability=/g)||[]).length,18);
  for(const n of data.nodes) assert.ok(graph.includes(n.work));
  for(const forbidden of ['<details','<script','<button','<a ',' hidden','onclick=']) assert.ok(!graph.includes(forbidden),forbidden);
  assert.ok(!html.includes('/cv-agent'));assert.ok(!html.includes('<script'));
  assert.equal((html.match(/<details/g)||[]).length,3); // Optional in-place source records only.
});
test('invalid IDs, projects, dependencies and duplicate placements fail',()=>{
  const mutations=[d=>d.nodes[0].project='missing',d=>d.relations[0].to=['missing'],d=>d.domains[1].nodes[0]=d.domains[0].nodes[0],d=>d.nodes[0].mode='expert',d=>d.nodes[0].id='"><img>'];
  for(const mutate of mutations){const copy=structuredClone(data);mutate(copy);assert.throws(()=>validateMap(copy));}
});
test('source text is escaped and historical node fragments remain addressable',()=>{
  const copy=structuredClone(data);copy.nodes[0].tech=['<img src=x onerror=alert(1)>'];
  const html=renderEngineeringMap(copy);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  for(const n of data.nodes){assert.ok(ids.includes(`node-${n.id}`));assert.ok(ids.includes(`cap-${n.id}`));}
});
test('route remains unlisted and imports no interaction client or CV data',()=>{
  const route=readFileSync(new URL('../src/pages/[locale]/engineering-map.astro',import.meta.url),'utf8');
  assert.ok(route.includes('noindex, nofollow, noarchive'));assert.ok(route.includes('data-pagefind-ignore="all"'));
  assert.ok(!route.includes('cv-agent.yaml'));assert.ok(!route.includes('<script'));assert.ok(!route.includes('interactions'));
  assert.ok(route.includes('if (!existsSync(file)) return []'));
});
