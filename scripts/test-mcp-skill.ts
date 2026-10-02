import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createServer } from "../functions/api/mcp";
import { skillCatalogEntry, skillsGetRequestSchema, skillsListRequestSchema } from "../src/server/mcp-note-skill";

const skillResourceSchema = z.object({ uri: z.string(), digest: z.string() });
const skillEntrySchema = z.object({
  uri: z.string(),
  frontmatter: z.record(z.string(), z.unknown()),
  resources: z.array(skillResourceSchema)
});
const listResultSchema = z.object({ skills: z.array(skillEntrySchema), nextCursor: z.string().optional() });
const getResultSchema = z.object({ skill: skillEntrySchema });

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createServer({} as never, "https://sunionpeaks.pages.dev");
const client = new Client({ name: "dossierkit-skill-test", version: "1.0.0" });
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

try {
  assert.deepEqual(client.getServerCapabilities()?.extensions?.["io.modelcontextprotocol/skills"], {});
  const listed = await client.request({ method: "skills/list", params: {} }, listResultSchema);
  assert.equal(listed.skills.length, 1);
  assert.deepEqual(listed.skills[0], skillCatalogEntry);

  const fetched = await client.request({ method: "skills/get", params: { uri: skillCatalogEntry.uri } }, getResultSchema);
  assert.deepEqual(fetched.skill, skillCatalogEntry);

  for (const resource of fetched.skill.resources) {
    const result = await client.readResource({ uri: resource.uri });
    assert.equal(result.contents.length, 1);
    const content = result.contents[0];
    assert.equal(content.uri, resource.uri);
    assert.ok("text" in content);
    const digest = `sha256:${createHash("sha256").update(content.text, "utf8").digest("hex")}`;
    assert.equal(digest, resource.digest);
    const relative = resource.uri.replace('skill://dossierkit-notes/publish-note/', '');
    assert.ok(relative !== resource.uri && !relative.includes('..'));
    assert.equal(content.text, await readFile(new URL('../plugins/dossierkit-notes/skills/publish-note/' + relative, import.meta.url), 'utf8'));
    if (relative === 'SKILL.md') {
      assert.match(content.text, /Optimize for understanding/);
      assert.match(content.text, /STE-inspired/);
      assert.match(content.text, /Chinese/);
    }
    if (relative.endsWith('research-quality.md')) assert.match(content.text, /Understanding-first editorial workflow/);
    if (relative.endsWith('visual-authoring.md')) {
      assert.match(content.text, /flowchart TB/);
      assert.match(content.text, /transcript/);
      assert.match(content.text, /security boundary/);
    }
  }
  console.log("Verified MCP Skill catalog, retrieval, resources, and SHA-256 digests.");
} finally {
  await Promise.all([client.close(), server.close()]);
}
