import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { onRequest as handleMcpRequest } from "../functions/api/mcp";
import { findPublicContentViolation } from "../src/lib/content-policy";
import {
  collisionSlug,
  deriveCanonicalNoteKey,
  noteSaveInputSchema,
  parseCanonicalNote,
  prepareNote,
  renderCanonicalNote
} from "../src/lib/note-ingest";
import { decorateNoteHtml, removeDuplicateNoteLead } from "../src/lib/note-render";
import { readContentCollection } from "../src/lib/profile-loader";
import {
  AccessAuthenticationError,
  AccessConfigurationError,
  verifyCloudflareAccess
} from "../src/server/access-auth";
import { deleteNoteFromGitHub, getNoteFromGitHub, saveNoteToGitHub } from "../src/server/github-notes";

const markdown = `# 构建可持续演进的 Agent Harness：持续评测、动作治理与选择性 Memory

围绕持续优化、行为知识、Canonical Action 与持久记忆形成统一工程方法。

## Harness 持续优化

每次优化同时验证新能力、历史能力和未见任务迁移。
`;

const input = {
  markdown,
  topics: ["Agent Harness", "Evaluation", "Action Governance", "Selective Memory"],
  kind: "research" as const
};
const html = `<!doctype html>
<html lang="en">
<head><title>HTML Notes Runtime</title></head>
<body>
  <article>
    <h1>HTML Notes Runtime</h1>
    <p>HTML notes preserve semantic tables, code blocks, figures, and links while sharing the canonical Notes layout.</p>
    <h2>Safe rendering contract</h2>
    <p>The server removes unsupported markup and rejects scripts, forms, inline styles, event handlers, and unsafe URL schemes.</p>
    <pre><code class="language-ts">const format = "html";</code></pre>
  </article>
</body>
</html>`;
const htmlInput = {
  html,
  topics: ["HTML Notes", "Safe Rendering", "MCP"],
  kind: "engineering" as const
};
const environment = {
  NOTES_GITHUB_TOKEN: "test-token",
  NOTES_GITHUB_REPOSITORY: "owner/repository",
  NOTES_GITHUB_BRANCH: "main",
  NOTES_PROFILE_ID: "default",
  PUBLIC_SITE_URL: "https://notes.example.com"
};

const note = await prepareNote(input, new Date("2026-07-21T00:00:00Z"));
const generatedKey = "agent-harness-evaluation-action-governance-selective-memory";
assert.equal(note.locale, "zh");
assert.match(note.contentHash, /^sha256:[a-f0-9]{64}$/);
assert.equal(deriveCanonicalNoteKey(note), generatedKey);
assert.doesNotThrow(() => noteSaveInputSchema.parse({ markdown, topics: input.topics }));
assert.doesNotThrow(() => noteSaveInputSchema.parse(htmlInput));
assert.throws(() => noteSaveInputSchema.parse({ ...input, html }));
assert.throws(() => noteSaveInputSchema.parse({ topics: input.topics }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, suggestedSlug: "caller-owned-slug" }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, slug: "manual-slug" }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, sourceUrl: "https://invalid.example/download" }));
assert.doesNotThrow(() => noteSaveInputSchema.parse({ markdown, noteRef: "zh/existing-note" }));
await assert.rejects(() => prepareNote({ ...input, markdown: `${markdown}\n<script>alert(1)</script>` }));
await assert.doesNotReject(() => prepareNote({
  ...input,
  markdown: `${markdown}\n\n## Technical examples and demos\n\nThese examples document reusable implementation boundaries.`
}));
await assert.rejects(
  () => prepareNote({ ...input, markdown: `${markdown}\n\n## 待补\n\n这部分内容尚未完成。` }),
  /unfinished public wording/
);
assert.equal(findPublicContentViolation("notes", "Technical examples and demos"), undefined);
assert.match(String(findPublicContentViolation("writing", "Technical examples")), /examples/);
assert.ok(collisionSlug("a".repeat(72), note.title).length <= 72);

const canonical = renderCanonicalNote(note);
assert.doesNotMatch(canonical, /^slug:/m, "the filename is the only canonical path identity");
assert.doesNotMatch(canonical, /^# /m);
assert.match(canonical, /lastReviewedAt: "2026-07-21"/);
assert.doesNotMatch(canonical, /&a\d+|\*a\d+/, "frontmatter must not use YAML anchors");
const parsedCanonical = parseCanonicalNote(canonical);
assert.equal(parsedCanonical.format, "markdown");
if (parsedCanonical.format !== "markdown") throw new Error("Expected canonical Markdown.");
assert.equal(parsedCanonical.markdown, markdown);

const htmlNote = await prepareNote(htmlInput, new Date("2026-07-24T00:00:00Z"));
assert.equal(htmlNote.format, "html");
assert.equal(htmlNote.title, "HTML Notes Runtime");
const canonicalHtml = renderCanonicalNote(htmlNote);
assert.match(canonicalHtml, /^<!doctype html>/);
assert.match(canonicalHtml, /id="dossierkit-note-metadata"/);
assert.match(canonicalHtml, /data-dossierkit-note-body/);
const parsedHtml = parseCanonicalNote(canonicalHtml);
assert.equal(parsedHtml.format, "html");
assert.equal(parsedHtml.metadata.title, htmlNote.title);
assert.match(parsedHtml.html || "", /<h1>HTML Notes Runtime<\/h1>/);
const temporaryProfileRoot = fs.mkdtempSync(path.join(process.cwd(), "profiles", ".html-notes-test-"));
try {
  const temporaryNotesDir = path.join(temporaryProfileRoot, "content", "en", "notes");
  fs.mkdirSync(temporaryNotesDir, { recursive: true });
  fs.writeFileSync(path.join(temporaryNotesDir, "html-notes-runtime.html"), canonicalHtml);
  const loadedHtmlNotes = readContentCollection("en", "notes", path.basename(temporaryProfileRoot));
  assert.equal(loadedHtmlNotes.length, 1);
  assert.equal(loadedHtmlNotes[0].slug, "html-notes-runtime");
  assert.match(loadedHtmlNotes[0].html, /Safe rendering contract/);
  assert.doesNotMatch(loadedHtmlNotes[0].html, /dossierkit-note-metadata/);
} finally {
  fs.rmSync(temporaryProfileRoot, { recursive: true, force: true });
}
await assert.rejects(() => prepareNote({
  ...htmlInput,
  html: html.replace("</body>", '<script>alert("unsafe")</script></body>')
}), /active content/);
await assert.rejects(() => prepareNote({
  ...htmlInput,
  html: html.replace("<p>HTML notes", '<p onclick="steal()">HTML notes')
}), /active content/);

const decorated = decorateNoteHtml("<h2>Agent Harness 持续优化</h2><h3>Evaluation Gate</h3>");
assert.match(decorated.html, /id="agent-harness-chi-xu-you-hua"/);
assert.equal(decorated.headings.length, 1, "the table of contents should remain compact");
const mermaid = decorateNoteHtml('<pre><code class="language-mermaid">flowchart LR\nA --&gt; B\n</code></pre>');
assert.match(mermaid.html, /data-mermaid-diagram/);
assert.doesNotMatch(mermaid.html, /language-mermaid/);
assert.equal(
  removeDuplicateNoteLead(
    "<p>Agent runtime governance keeps execution observable and reviewable.</p><h2>Architecture</h2>",
    "Agent runtime governance keeps execution observable and reviewable."
  ),
  "<h2>Architecture</h2>"
);
assert.equal(
  removeDuplicateNoteLead(
    "<p>Agent runtime governance keeps execution observable and reviewable across production systems.</p><h2>Architecture</h2>",
    "Agent runtime governance keeps execution observable and reviewable…"
  ),
  "<h2>Architecture</h2>"
);
assert.equal(
  removeDuplicateNoteLead(
    "<h2>核心问题</h2><p>自主 Agent 不仅可能执行错误任务，还可能生成隐藏风险行为。</p><h2>核心思想</h2>",
    "核心问题 自主 Agent 不仅可能执行错误任务，还可能生成隐藏风险行为。"
  ),
  "<h2>核心思想</h2>"
);
assert.match(
  removeDuplicateNoteLead("<p>A distinct introduction remains visible.</p>", "Different summary content."),
  /distinct introduction/
);

const createdRepo = createGitHubMock();
const created = await saveNoteToGitHub(input, environment, "https://notes.example.com", createdRepo.fetch);
assert.equal(created.action, "created");
assert.equal(created.noteRef, `zh/${generatedKey}`);
assert.equal(created.publicUrl, `https://notes.example.com/zh/notes/${generatedKey}`);
assert.ok(createdRepo.documents.has(notePath(generatedKey)));

const rejectedRepo = createGitHubMock();
await assert.rejects(
  () => saveNoteToGitHub(
    { ...input, markdown: `${markdown}\n\n## 待补\n\n这部分内容尚未完成。` },
    environment,
    "https://notes.example.com",
    rejectedRepo.fetch
  ),
  /unfinished public wording/
);
assert.equal(rejectedRepo.writes, 0, "invalid public wording must be rejected before the GitHub write");

const sameTitleRepo = createGitHubMock(createdRepo.documents);
const sameTitle = await saveNoteToGitHub(
  input,
  environment,
  "https://notes.example.com",
  sameTitleRepo.fetch
);
assert.equal(sameTitle.action, "unchanged");
assert.equal(sameTitle.noteRef, created.noteRef, "an exact title match must reuse the canonical file");
assert.equal(sameTitleRepo.writes, 0);

const htmlRepo = createGitHubMock();
const createdHtml = await saveNoteToGitHub(
  htmlInput,
  environment,
  "https://notes.example.com",
  htmlRepo.fetch
);
assert.equal(createdHtml.action, "created");
assert.equal(createdHtml.noteRef, "en/html-notes-runtime");
assert.ok(htmlRepo.documents.has(notePath("html-notes-runtime", "en", "html")));
const readHtml = await getNoteFromGitHub(
  { query: createdHtml.noteRef },
  environment,
  "https://notes.example.com",
  htmlRepo.fetch
);
assert.equal(readHtml.note?.format, "html");
assert.match(readHtml.note?.html || "", /^<!doctype html>/);
await assert.rejects(
  () => saveNoteToGitHub(
    { markdown: "# HTML Notes Runtime\n\n" + "This attempts to change the canonical format and must be rejected. ".repeat(2), noteRef: createdHtml.noteRef },
    environment,
    "https://notes.example.com",
    htmlRepo.fetch
  ),
  /cannot change the note format/
);

const existingSource = createdRepo.documents.get(notePath(generatedKey))!;
const parsedExisting = parseCanonicalNote(existingSource);
if (parsedExisting.format !== "markdown") throw new Error("Expected stored Markdown.");
const featuredSource = existingSource.replace("featured: false", "featured: true");
const updateRepo = createGitHubMock(new Map([[notePath(generatedKey), featuredSource]]));
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
const updatedNote = parseCanonicalNote(updateRepo.documents.get(notePath(generatedKey))!);
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

const staleDeleteRepo = createGitHubMock(createdRepo.documents);
await assert.rejects(
  () => deleteNoteFromGitHub(
    { noteRef: created.noteRef, contentHash: `sha256:${"0".repeat(64)}` },
    environment,
    "https://notes.example.com",
    staleDeleteRepo.fetch
  ),
  /changed after it was read/
);
assert.equal(staleDeleteRepo.writes, 0);
const staleMetadataSource = existingSource.replace(
  "每次优化同时验证新能力、历史能力和未见任务迁移。",
  "每次优化同时验证新能力、历史能力和未见任务迁移。该内容在未更新哈希的情况下被修改。"
);
const staleMetadataRepo = createGitHubMock(new Map([[notePath(generatedKey), staleMetadataSource]]));
await assert.rejects(
  () => deleteNoteFromGitHub(
    { noteRef: created.noteRef, contentHash: parsedExisting.contentHash },
    environment,
    "https://notes.example.com",
    staleMetadataRepo.fetch
  ),
  /contentHash is stale/
);
assert.equal(staleMetadataRepo.writes, 0);
const deleted = await deleteNoteFromGitHub(
  { noteRef: created.noteRef, contentHash: parsedExisting.contentHash },
  environment,
  "https://notes.example.com",
  staleDeleteRepo.fetch
);
assert.equal(deleted.action, "deleted");
assert.equal(deleted.noteRef, created.noteRef);
assert.equal(staleDeleteRepo.documents.has(notePath(generatedKey)), false);
const deletedRead = await getNoteFromGitHub(
  { query: created.noteRef },
  environment,
  "https://notes.example.com",
  staleDeleteRepo.fetch
);
assert.equal(deletedRead.status, "not_found");

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
const toolList = await toolListResponse.json() as {
  result?: {
    tools?: Array<{
      name?: string;
      inputSchema?: { properties?: Record<string, unknown> };
      outputSchema?: unknown;
      annotations?: { destructiveHint?: boolean };
    }>;
  };
};
assert.deepEqual(toolList.result?.tools?.map((tool) => tool.name), ["get_note", "save_note", "delete_note"]);
assert.ok(toolList.result?.tools?.every((tool) => tool.outputSchema), "every tool should publish an output schema");

const saveTool = toolList.result?.tools?.find((tool) => tool.name === "save_note");
assert.ok(saveTool?.inputSchema?.properties?.markdown, "save_note must accept finished Markdown");
assert.ok(saveTool?.inputSchema?.properties?.html, "save_note must accept finished HTML");
assert.equal(saveTool?.inputSchema?.properties?.suggestedSlug, undefined, "callers must not own canonical paths");
const deleteTool = toolList.result?.tools?.find((tool) => tool.name === "delete_note");
assert.equal(deleteTool?.annotations?.destructiveHint, true, "delete_note must be declared destructive");
assert.ok(deleteTool?.inputSchema?.properties?.contentHash, "delete_note must bind deletion to a read version");

const chatGptRegressionCases = [
  {
    title: "Scalable LLM Agent Tool Access in the Cloud",
    topics: ["MCP Gateway", "Tool Registry", "Dynamic Tool Discovery"],
    expectedKey: "scalable-llm-agent-tool-access-in-the-cloud"
  },
  {
    title: "ResearchArena: Independent Validation for Autonomous Research Agents",
    topics: ["Agent Safety", "Independent Validation", "ResearchArena"],
    expectedKey: "researcharena-independent-validation-for-autonomous-research-agents"
  },
  {
    title: "AREX: Constraint-Driven Recursive Research Agents",
    topics: ["AREX", "Constraint Verification", "Recursive Research"],
    expectedKey: "arex-constraint-driven-recursive-research-agents"
  }
];
const chatGptRegressionRepo = createGitHubMock();
for (const testCase of chatGptRegressionCases) {
  const result = await saveNoteToGitHub(
    {
      markdown: `# ${testCase.title}

This structured learning note extracts the core architecture, evidence boundaries, reusable engineering method, and practical implementation guidance.

## Engineering application

The method is translated into an implementation contract, validation strategy, operational safeguards, and repeatable evaluation criteria.
`,
      topics: testCase.topics,
      kind: "learning"
    },
    environment,
    "https://notes.example.com",
    chatGptRegressionRepo.fetch
  );
  assert.equal(result.action, "created");
  assert.equal(result.noteRef, `en/${testCase.expectedKey}`);
}
assert.equal(chatGptRegressionRepo.writes, 3, "all three ChatGPT-shaped create calls must publish");

const publicEndpointResponse = await handleMcpRequest({
  request: new Request("https://notes.example.com/api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: "Bearer legacy-token",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
  }),
  env: {}
});
assert.equal(publicEndpointResponse.status, 404, "a remote deployment without Access must not expose MCP");

const incompleteAccessResponse = await handleMcpRequest({
  request: new Request("https://mcp.example.com/api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} })
  }),
  env: { NOTES_ACCESS_AUD: "audience" }
});
assert.equal(incompleteAccessResponse.status, 503, "an incomplete Access configuration must fail closed");

console.log("Markdown and HTML note create, read, edit, delete, and rendering tests passed.");

function notePath(key: string, locale = "zh", format: "markdown" | "html" = "markdown") {
  return `profiles/default/content/${locale}/notes/${key}.${format === "html" ? "html" : "mdx"}`;
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
    if (method === "DELETE") {
      if (!documents.has(path)) return json({ message: "Not Found" }, 404);
      documents.delete(path);
      writes += 1;
      return json({ commit: { html_url: `https://github.com/example/commit/${writes}` } }, 200);
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
