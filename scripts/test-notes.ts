import assert from "node:assert/strict";
import { onRequest as handleMcpRequest } from "../functions/api/mcp";
import {
  collisionSlug,
  noteSaveInputSchema,
  parseCanonicalNote,
  prepareNote,
  renderCanonicalNote
} from "../src/lib/note-ingest";
import { decorateNoteHtml } from "../src/lib/note-render";
import {
  AccessAuthenticationError,
  AccessConfigurationError,
  verifyCloudflareAccess
} from "../src/server/access-auth";
import { getNoteFromGitHub, saveNoteToGitHub } from "../src/server/github-notes";

const markdown = `# 构建可持续演进的 Agent Harness：持续评测、动作治理与选择性 Memory

围绕持续优化、行为知识、Canonical Action 与持久记忆形成统一工程方法。

## Harness 持续优化

每次优化同时验证新能力、历史能力和未见任务迁移。
`;

const input = {
  markdown,
  suggestedSlug: "agent-harness-evaluation-action-governance-memory",
  topics: ["Agent Harness", "Evaluation", "Action Governance", "Selective Memory"],
  kind: "research" as const
};
const environment = {
  NOTES_GITHUB_TOKEN: "test-token",
  NOTES_GITHUB_REPOSITORY: "owner/repository",
  NOTES_GITHUB_BRANCH: "main",
  NOTES_PROFILE_ID: "default",
  PUBLIC_SITE_URL: "https://notes.example.com"
};

const note = await prepareNote(input, new Date("2026-07-21T00:00:00Z"));
assert.equal(note.locale, "zh");
assert.match(note.contentHash, /^sha256:[a-f0-9]{64}$/);
assert.throws(() => noteSaveInputSchema.parse({ markdown, topics: input.topics }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, slug: "manual-slug" }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, sourceUrl: "https://invalid.example/download" }));
assert.doesNotThrow(() => noteSaveInputSchema.parse({ markdown, noteRef: "zh/existing-note" }));
await assert.rejects(() => prepareNote({ ...input, markdown: `${markdown}\n<script>alert(1)</script>` }));
assert.ok(collisionSlug("a".repeat(72), note.title).length <= 72);

const canonical = renderCanonicalNote(note);
assert.doesNotMatch(canonical, /^slug:/m, "the filename is the only canonical path identity");
assert.doesNotMatch(canonical, /^# /m);
assert.match(canonical, /lastReviewedAt: "2026-07-21"/);
assert.doesNotMatch(canonical, /&a\d+|\*a\d+/, "frontmatter must not use YAML anchors");
assert.equal(parseCanonicalNote(canonical).markdown, markdown);

const decorated = decorateNoteHtml("<h2>Agent Harness 持续优化</h2><h3>Evaluation Gate</h3>");
assert.match(decorated.html, /id="agent-harness-chi-xu-you-hua"/);
assert.equal(decorated.headings.length, 1, "the table of contents should remain compact");

const createdRepo = createGitHubMock();
const created = await saveNoteToGitHub(input, environment, "https://notes.example.com", createdRepo.fetch);
assert.equal(created.action, "created");
assert.equal(created.noteRef, "zh/agent-harness-evaluation-action-governance-memory");
assert.equal(created.publicUrl, "https://notes.example.com/zh/notes/agent-harness-evaluation-action-governance-memory");
assert.ok(createdRepo.documents.has(notePath("agent-harness-evaluation-action-governance-memory")));

const sameTitleRepo = createGitHubMock(createdRepo.documents);
const sameTitle = await saveNoteToGitHub(
  { ...input, suggestedSlug: "a-different-model-proposal" },
  environment,
  "https://notes.example.com",
  sameTitleRepo.fetch
);
assert.equal(sameTitle.action, "unchanged");
assert.equal(sameTitle.noteRef, created.noteRef, "an exact title match must reuse the canonical file");
assert.equal(sameTitleRepo.writes, 0);

const existingSource = createdRepo.documents.get(notePath("agent-harness-evaluation-action-governance-memory"))!;
const parsedExisting = parseCanonicalNote(existingSource);
const featuredSource = existingSource.replace("featured: false", "featured: true");
const updateRepo = createGitHubMock(new Map([[notePath("agent-harness-evaluation-action-governance-memory"), featuredSource]]));
const editedMarkdown = parsedExisting.markdown
  .replace("# 构建可持续演进的 Agent Harness：持续评测、动作治理与选择性 Memory", "# Agent Harness 工程治理与长期演进")
  .replace("每次优化同时验证新能力、历史能力和未见任务迁移。", "每次优化同时验证新能力、历史能力、未见任务迁移与长期回归边界。");
const updated = await saveNoteToGitHub(
  { markdown: editedMarkdown, noteRef: created.noteRef },
  environment,
  "https://notes.example.com",
  updateRepo.fetch
);
assert.equal(updated.action, "updated");
assert.equal(updated.noteRef, created.noteRef, "title edits must not move the canonical path");
const updatedNote = parseCanonicalNote(updateRepo.documents.get(notePath("agent-harness-evaluation-action-governance-memory"))!);
assert.equal(updatedNote.metadata.title, "Agent Harness 工程治理与长期演进");
assert.equal(updatedNote.metadata.featured, true);
assert.equal(updatedNote.metadata.date, parsedExisting.metadata.date);
assert.equal(updatedNote.metadata.kind, parsedExisting.metadata.kind);
assert.deepEqual(updatedNote.metadata.topics, parsedExisting.metadata.topics);

const read = await getNoteFromGitHub(
  { query: created.noteRef },
  environment,
  "https://notes.example.com",
  updateRepo.fetch
);
assert.equal(read.status, "found");
assert.equal(read.note?.noteRef, created.noteRef);
assert.match(read.note?.markdown || "", /^# Agent Harness 工程治理与长期演进/m);

assert.equal(await verifyCloudflareAccess(new Request("https://notes.example.com/api/mcp"), {}), undefined);
await assert.rejects(
  () => verifyCloudflareAccess(new Request("https://notes.example.com/api/mcp"), { NOTES_ACCESS_AUD: "audience" }),
  AccessConfigurationError
);
await assert.rejects(
  () => verifyCloudflareAccess(new Request("https://notes.example.com/api/mcp"), {
    NOTES_ACCESS_AUD: "audience",
    NOTES_ACCESS_ISSUER: "https://notes.cloudflareaccess.com"
  }),
  AccessAuthenticationError
);

const toolListResponse = await handleMcpRequest({
  request: new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
  }),
  env: {}
});
assert.equal(toolListResponse.status, 200, "tool discovery must work when the runtime omits the Host header");
const toolList = await toolListResponse.json() as { result?: { tools?: Array<{ name?: string; outputSchema?: unknown }> } };
assert.deepEqual(toolList.result?.tools?.map((tool) => tool.name), ["get_note", "save_note"]);
assert.ok(toolList.result?.tools?.every((tool) => tool.outputSchema), "every tool should publish an output schema");

console.log("Notes canonical create, read, edit, and update tests passed.");

function notePath(key: string, locale = "zh") {
  return `profiles/default/content/${locale}/notes/${key}.mdx`;
}

function createGitHubMock(initial = new Map<string, string>()) {
  const documents = new Map(initial);
  let writes = 0;
  const requestFetch: typeof fetch = async (request, init) => {
    const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);
    const path = decodeURIComponent(url.pathname.split("/contents/")[1] || "");
    const method = init?.method || "GET";
    if (method === "GET" && /\/notes$/.test(path)) {
      const prefix = `${path}/`;
      const entries = [...documents.keys()]
        .filter((candidate) => candidate.startsWith(prefix))
        .map((candidate) => ({
          name: candidate.slice(prefix.length),
          path: candidate,
          sha: `sha-${candidate}`,
          type: "file"
        }));
      return json(entries, 200);
    }
    if (method === "GET") {
      const document = documents.get(path);
      return document
        ? json({ encoding: "base64", content: Buffer.from(document).toString("base64"), sha: `sha-${path}` }, 200)
        : json({ message: "Not Found" }, 404);
    }
    const payload = JSON.parse(String(init?.body)) as { content: string };
    documents.set(path, Buffer.from(payload.content, "base64").toString("utf8"));
    writes += 1;
    return json({ commit: { html_url: `https://github.com/example/commit/${writes}` } }, 201);
  };
  return {
    documents,
    fetch: requestFetch,
    get writes() {
      return writes;
    }
  };
}

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
