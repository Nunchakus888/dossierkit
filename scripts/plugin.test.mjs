import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configure } from '../plugins/dossierkit-notes/configure.mjs';
const source = path.resolve('plugins/dossierkit-notes');
test('portable plugin is inert by default and has one valid Skill', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(source,'plugin.json'),'utf8'));
  assert.equal(plugin.name,'dossierkit-notes');
  assert.equal(plugin.$schema,'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(source,'mcp.json'),'utf8')).mcpServers,{});
  assert.match(fs.readFileSync(path.join(source,'skills/publish-note/SKILL.md'),'utf8'),/^---\nname: publish-note\ndescription:/);
});
test('one instance configuration produces portable, Codex and optional Web binding', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dossierkit-plugin-'));
  try {
    fs.cpSync(source,dir,{recursive:true});
    configure(dir,'https://notes.example.com/api/mcp','plugin_asdk_app_testonly');
    const mcp=JSON.parse(fs.readFileSync(path.join(dir,'mcp.json'),'utf8'));
    assert.equal(mcp.mcpServers['dossierkit-notes'].type,'streamable-http');
    assert.equal(mcp.mcpServers['dossierkit-notes'].url,'https://notes.example.com/api/mcp');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.app.json'),'utf8')).apps['dossierkit-notes'].id,'plugin_asdk_app_testonly');
    configure(dir,'https://different.example.com/api/mcp');
    assert.ok(!fs.existsSync(path.join(dir,'.app.json')),'do not retain another instance auth binding');
    assert.throws(() => configure(dir,'https://token@example.com/api/mcp'));
    assert.throws(() => configure(dir,'https://example.com/api/mcp?token=secret'));
    assert.throws(() => configure(dir,'http://example.com/api/mcp'));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
