import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configure } from '../plugins/dossierkit-notes/configure.mjs';
import { copyPluginFiles, PLUGIN_FILES } from './package-notes-plugin.mjs';
const source = path.resolve('plugins/dossierkit-notes');
test('canonical plugin bundles one production MCP and one valid Skill', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(source,'plugin.json'),'utf8'));
  const codex = JSON.parse(fs.readFileSync(path.join(source,'.codex-plugin/plugin.json'),'utf8'));
  assert.equal(plugin.name,'dossierkit-notes');
  assert.match(plugin.version,/^1\.7\.0\+codex\.[a-z0-9-]+$/);
  assert.equal(codex.version,plugin.version);
  assert.equal(plugin.$schema,'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  const portableMcp=JSON.parse(fs.readFileSync(path.join(source,'mcp.json'),'utf8')).mcpServers['dossierkit-notes'];
  const codexMcp=JSON.parse(fs.readFileSync(path.join(source,'.mcp.json'),'utf8')).mcpServers['dossierkit-notes'];
  assert.equal(portableMcp.type,'streamable-http');
  assert.equal(portableMcp.url,'https://dossierkit-notes-mcp.pages.dev/api/mcp');
  assert.equal(codexMcp.url,portableMcp.url);
  assert.deepEqual(codex.interface,plugin.extensions['com.openai'].interface);
  assert.equal(codex.skills,'./skills/');
  const defaultPrompts=plugin.extensions['com.openai'].interface.defaultPrompt;
  assert.equal(defaultPrompts.length,3);
  for (const prompt of defaultPrompts) assert.match(prompt,/^Use \$publish-note /);
  assert.equal(codex.interface.websiteURL,'https://sunionpeaks.pages.dev/plugins/dossierkit-notes');
  assert.equal(codex.interface.privacyPolicyURL,'https://sunionpeaks.pages.dev/plugins/dossierkit-notes/privacy');
  assert.equal(codex.interface.termsOfServiceURL,'https://sunionpeaks.pages.dev/plugins/dossierkit-notes/terms');
  assert.equal(codex.interface.composerIcon,'./assets/icon.svg');
  assert.equal(codex.interface.logo,'./assets/logo.svg');
  const skill = fs.readFileSync(path.join(source,'skills/publish-note/SKILL.md'),'utf8');
  const agent = fs.readFileSync(path.join(source,'skills/publish-note/agents/openai.yaml'),'utf8');
  assert.match(skill,/^---\nname: publish-note\ndescription:/);
  assert.match(skill,/philosophical proposition/);
  assert.match(agent,/^dependencies:/m);
  assert.match(agent,/url: "https:\/\/dossierkit-notes-mcp\.pages\.dev\/api\/mcp"/);
  assert.ok(fs.existsSync(path.join(source,'skills/publish-note/references/research-quality.md')));
  assert.ok(fs.existsSync(path.join(source,'skills/publish-note/references/visual-authoring.md')));
  for (const file of PLUGIN_FILES) {
    assert.doesNotMatch(fs.readFileSync(path.join(source,file),'utf8'),/[\u3400-\u9fff]/,`${file} must use English-only plugin copy`);
  }
});
test('one instance configuration updates every desktop MCP declaration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dossierkit-plugin-'));
  try {
    fs.cpSync(source,dir,{recursive:true});
    configure(dir,'https://notes.example.com/api/mcp');
    const mcp=JSON.parse(fs.readFileSync(path.join(dir,'mcp.json'),'utf8'));
    assert.equal(mcp.mcpServers['dossierkit-notes'].type,'streamable-http');
    assert.equal(mcp.mcpServers['dossierkit-notes'].url,'https://notes.example.com/api/mcp');
    const codexMcp=JSON.parse(fs.readFileSync(path.join(dir,'.mcp.json'),'utf8'));
    assert.equal(codexMcp.mcpServers['dossierkit-notes'].url,'https://notes.example.com/api/mcp');
    const agent=fs.readFileSync(path.join(dir,'skills/publish-note/agents/openai.yaml'),'utf8');
    assert.match(agent,/value: "dossierkit-notes"/);
    assert.match(agent,/url: "https:\/\/notes\.example\.com\/api\/mcp"/);
    const configured=JSON.parse(fs.readFileSync(path.join(dir,'plugin.json'),'utf8'));
    assert.equal(configured.extensions['com.openai'].interface.displayName,'DossierKit Notes');
    configure(dir,'https://different.example.com/api/mcp');
    const reconfigured=JSON.parse(fs.readFileSync(path.join(dir,'plugin.json'),'utf8'));
    assert.equal(reconfigured.extensions['com.openai'].interface.displayName,'DossierKit Notes');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.mcp.json'),'utf8')).mcpServers['dossierkit-notes'].url,'https://different.example.com/api/mcp');
    assert.match(fs.readFileSync(path.join(dir,'skills/publish-note/agents/openai.yaml'),'utf8'),/url: "https:\/\/different\.example\.com\/api\/mcp"/);
    assert.throws(() => configure(dir,'https://token@example.com/api/mcp'));
    assert.throws(() => configure(dir,'https://example.com/api/mcp?token=secret'));
    assert.throws(() => configure(dir,'http://example.com/api/mcp'));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('repository marketplace exposes only the canonical plugin', () => {
  const marketplace = JSON.parse(fs.readFileSync(path.resolve('.agents/plugins/marketplace.json'),'utf8'));
  assert.equal(marketplace.name,'dossierkit');
  assert.equal(marketplace.plugins.length,1);
  assert.equal(marketplace.plugins[0].name,'dossierkit-notes');
  assert.equal(marketplace.plugins[0].source.path,'./plugins/dossierkit-notes');
});

test('plugin exports only approved files and excludes local account state', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'notes-package-'));
  try {
    const input=path.join(root,'source'), output=path.join(root,'output');
    fs.cpSync(source,input,{recursive:true});
    fs.writeFileSync(path.join(input,'.env'),'LOCAL_SENTINEL_ONLY=not-a-real-secret');
    fs.writeFileSync(path.join(input,'.app.json'),'{}');
    fs.writeFileSync(path.join(input,'unrelated.txt'),'not part of this plugin');
    copyPluginFiles(input,output);
    assert.ok(!fs.existsSync(path.join(output,'.env')));
    assert.ok(!fs.existsSync(path.join(output,'.app.json')));
    assert.ok(!fs.existsSync(path.join(output,'unrelated.txt')));
    for (const file of PLUGIN_FILES) assert.ok(fs.existsSync(path.join(output,file)));
    assert.ok(fs.existsSync(path.join(output,'skills/publish-note/references/research-quality.md')));
    assert.ok(fs.existsSync(path.join(output,'skills/publish-note/references/visual-authoring.md')));
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
