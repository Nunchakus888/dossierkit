import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateMap, renderEngineeringMap } from '../src/lib/engineering-map/render.mjs';
const data=JSON.parse(readFileSync(new URL('../profiles/default/engineering-map.json',import.meta.url),'utf8'));
test('six domains, eighteen capabilities, three separately scoped projects',()=>{
  validateMap(data);
  assert.equal(data.domains.length,6);assert.equal(data.nodes.length,18);assert.equal(data.projects.length,3);
  assert.equal(data.domains.every(d=>d.nodes.length===3),true);
});
test('every claim has a contribution mode, project, source, and validation boundary',()=>{
  for(const n of data.nodes){assert.ok(n.boundary);for(const c of n.contributions){assert.ok(c.evidence.length);assert.ok(['own','integration','research','plan'].includes(c.mode));}}
  assert.ok(data.nodes.find(n=>n.id==='agent-02').contributions.some(c=>c.mode==='integration'&&c.text.includes('Pi')));
  assert.ok(data.nodes.find(n=>n.id==='arch-03').contributions.some(c=>c.mode==='plan'&&c.text.includes('多 Agent')));
});
test('invalid evidence, relation, and duplicate placement fail closed',()=>{
  for(const mutate of [d=>d.nodes[0].contributions[0].evidence.push('missing'),d=>d.relations[0].to='missing',d=>d.domains[1].nodes[0]=d.domains[0].nodes[0]]){
    const copy=structuredClone(data);mutate(copy);assert.throws(()=>validateMap(copy));
  }
});
test('HTML is escaped and source URLs are restricted',()=>{
  const copy=structuredClone(data);copy.nodes[0].title='<img src=x onerror=alert(1)>';
  const html=renderEngineeringMap(copy);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  copy.sources[0].href='javascript:alert(1)';assert.throws(()=>validateMap(copy));
});
test('server rendering provides all details and stable, unique deep links',()=>{
  const html=renderEngineeringMap(data);const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  for(const n of data.nodes){assert.ok(html.includes(`id="node-${n.id}"`));assert.ok(html.includes(`id="cap-${n.id}"`));}
  for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),`Broken anchor ${m[1]}`);
  assert.equal((html.match(/data-capability=/g)||[]).length,18);
});
test('unlisted route has crawler and Pagefind exclusion and no CV import',()=>{
  const route=readFileSync(new URL('../src/pages/[locale]/engineering-map.astro',import.meta.url),'utf8');
  assert.ok(route.includes('noindex, nofollow, noarchive'));assert.ok(route.includes('data-pagefind-ignore="all"'));
  assert.ok(!route.includes('cv-agent.yaml'));assert.ok(route.includes("if (!existsSync(file)) return []"));
});

test('embedded evidence never links into the separately unlisted CV',()=>{
  const html=renderEngineeringMap(data);
  assert.ok(!html.includes('/cv-agent'));
  assert.ok(html.includes('履历摘录 · 原文已内嵌'));
  assert.ok(html.includes('作者提供 · 摘要已内嵌'));
  for(const source of data.sources) assert.ok(html.includes(source.label));
});
