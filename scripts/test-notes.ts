import assert from "node:assert/strict";
import { collisionSlug, noteSaveInputSchema, prepareNote, renderCanonicalNote } from "../src/lib/note-ingest";
import { decorateNoteHtml } from "../src/lib/note-render";
import {
  AccessAuthenticationError,
  AccessConfigurationError,
  verifyCloudflareAccess
} from "../src/server/access-auth";
import { saveNoteToGitHub } from "../src/server/github-notes";

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

const note = await prepareNote(input, new Date("2026-07-21T00:00:00Z"));
assert.equal(note.baseSlug, "agent-harness-evaluation-action-governance-memory");
assert.equal(note.locale, "zh");
assert.match(note.contentHash, /^sha256:[a-f0-9]{64}$/);
assert.equal(collisionSlug(note.baseSlug, note.title), collisionSlug(note.baseSlug, note.title));
assert.equal(
  (await prepareNote({ ...input, topics: ["Changed metadata"] })).baseSlug,
  note.baseSlug,
  "metadata changes must not move the canonical URL"
);
assert.throws(() => noteSaveInputSchema.parse({ ...input, slug: "manual-slug" }));
assert.throws(() => noteSaveInputSchema.parse({ ...input, sourceUrl: "https://example.com/download" }));
await assert.rejects(() => prepareNote({ markdown: `${markdown}\n<script>alert(1)</script>` }));
assert.ok(collisionSlug("a".repeat(72), note.title).length <= 72);
const decorated = decorateNoteHtml("<h2>Agent Harness 持续优化</h2><h3>Evaluation Gate</h3>");
assert.match(decorated.html, /id="agent-harness-chi-xu-you-hua"/);
assert.equal(decorated.headings.length, 1, "the table of contents should remain compact");

const canonical = renderCanonicalNote(note);
assert.match(canonical, /slug: agent-harness-evaluation-action-governance-memory/);
assert.doesNotMatch(canonical, /^# /m);

let writtenPath = "";
let writtenDocument = "";
const mockFetch: typeof fetch = async (request, init) => {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);
  if ((init?.method || "GET") === "GET") {
    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  writtenPath = decodeURIComponent(url.pathname);
  const payload = JSON.parse(String(init?.body)) as { content: string };
  writtenDocument = Buffer.from(payload.content, "base64").toString("utf8");
  return new Response(JSON.stringify({ commit: { html_url: "https://github.com/example/commit/123" } }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
};

const result = await saveNoteToGitHub(
  input,
  {
    NOTES_GITHUB_TOKEN: "test-token",
    NOTES_GITHUB_REPOSITORY: "owner/repository",
    NOTES_GITHUB_BRANCH: "main",
    NOTES_PROFILE_ID: "default",
    PUBLIC_SITE_URL: "https://notes.example.com"
  },
  "https://notes.example.com",
  mockFetch
);

assert.equal(result.action, "created");
assert.equal(result.slug, note.baseSlug);
assert.equal(result.publicUrl, `https://notes.example.com/zh/notes/${note.baseSlug}`);
assert.match(writtenPath, new RegExp(`/profiles/default/content/zh/notes/${note.baseSlug}\\.mdx$`));
assert.equal(writtenDocument, renderCanonicalNote(await prepareNote(input), note.baseSlug));

let idempotentWrites = 0;
const existingDocument = renderCanonicalNote(await prepareNote(input), note.baseSlug);
const existingFetch: typeof fetch = async (_request, init) => {
  if ((init?.method || "GET") === "GET") {
    return new Response(JSON.stringify({
      encoding: "base64",
      content: Buffer.from(existingDocument, "utf8").toString("base64"),
      sha: "existing-sha"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  idempotentWrites += 1;
  return new Response(null, { status: 500 });
};

const unchanged = await saveNoteToGitHub(
  input,
  {
    NOTES_GITHUB_TOKEN: "test-token",
    NOTES_GITHUB_REPOSITORY: "owner/repository",
    NOTES_GITHUB_BRANCH: "main",
    NOTES_PROFILE_ID: "default",
    PUBLIC_SITE_URL: "https://notes.example.com"
  },
  "https://notes.example.com",
  existingFetch
);

assert.equal(unchanged.action, "unchanged");
assert.equal(idempotentWrites, 0, "identical content must not create a commit");

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

console.log("Notes slug generation and canonical GitHub write tests passed.");
