import {
  collisionSlug,
  extractExistingNoteIdentity,
  noteSaveInputSchema,
  prepareNote,
  renderCanonicalNote,
  type NoteSaveInput,
  type PreparedNote
} from "../lib/note-ingest";

export type NotesEnvironment = {
  NOTES_GITHUB_TOKEN?: string;
  NOTES_GITHUB_REPOSITORY?: string;
  NOTES_GITHUB_BRANCH?: string;
  NOTES_PROFILE_ID?: string;
  PUBLIC_SITE_URL?: string;
};

type GitHubContent = {
  content?: string;
  encoding?: string;
  sha?: string;
  html_url?: string;
};

export type SaveNoteResult = {
  action: "created" | "updated" | "unchanged";
  slug: string;
  path: string;
  commitUrl?: string;
  publicUrl: string;
  contentHash: string;
};

export async function saveNoteToGitHub(
  rawInput: NoteSaveInput,
  env: NotesEnvironment,
  requestOrigin: string,
  requestFetch: typeof fetch = fetch
): Promise<SaveNoteResult> {
  const input = noteSaveInputSchema.parse(rawInput);
  const token = required(env.NOTES_GITHUB_TOKEN, "NOTES_GITHUB_TOKEN");
  const repository = required(env.NOTES_GITHUB_REPOSITORY, "NOTES_GITHUB_REPOSITORY");
  const [owner, repo, extra] = repository.split("/");
  if (!owner || !repo || extra) throw new Error("NOTES_GITHUB_REPOSITORY must use owner/repository format.");

  const branch = env.NOTES_GITHUB_BRANCH || "main";
  const profileId = env.NOTES_PROFILE_ID || "default";
  const note = await prepareNote(input);
  let slug = note.baseSlug;
  let path = notePath(profileId, note, slug);
  let existing = await getContent(owner, repo, path, branch, token, requestFetch);

  if (existing) {
    const source = decodeGitHubContent(existing);
    const identity = extractExistingNoteIdentity(source);
    if (identity.title && normalizeTitle(identity.title) !== normalizeTitle(note.title)) {
      slug = collisionSlug(note.baseSlug, note.title);
      path = notePath(profileId, note, slug);
      existing = await getContent(owner, repo, path, branch, token, requestFetch);
    }
  }

  if (existing) {
    const identity = extractExistingNoteIdentity(decodeGitHubContent(existing));
    if (identity.contentHash === note.contentHash) {
      return result("unchanged", note, slug, path, undefined, env.PUBLIC_SITE_URL || requestOrigin);
    }
  }

  const document = renderCanonicalNote(note, slug);
  const response = await requestFetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({
        message: `${existing ? "Update" : "Publish"} note: ${note.title}`,
        content: encodeBase64(document),
        branch,
        ...(existing?.sha ? { sha: existing.sha } : {})
      })
    }
  );

  const payload = await response.json() as {
    commit?: { html_url?: string };
    message?: string;
  };
  if (!response.ok) {
    throw new Error(`GitHub write failed (${response.status}): ${payload.message || response.statusText}`);
  }

  return result(existing ? "updated" : "created", note, slug, path, payload.commit?.html_url, env.PUBLIC_SITE_URL || requestOrigin);
}

async function getContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token: string,
  requestFetch: typeof fetch
) {
  const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`);
  url.searchParams.set("ref", branch);
  const response = await requestFetch(url, { headers: githubHeaders(token) });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    const payload = await response.json() as { message?: string };
    throw new Error(`GitHub read failed (${response.status}): ${payload.message || response.statusText}`);
  }
  return await response.json() as GitHubContent;
}

function result(
  action: SaveNoteResult["action"],
  note: PreparedNote,
  slug: string,
  path: string,
  commitUrl: string | undefined,
  siteUrl: string
): SaveNoteResult {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    action,
    slug,
    path,
    commitUrl,
    publicUrl: `${base}/${note.locale}/notes/${slug}`,
    contentHash: note.contentHash
  };
}

function notePath(profileId: string, note: PreparedNote, slug: string) {
  return `profiles/${profileId}/content/${note.locale}/notes/${slug}.mdx`;
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "dossierkit-notes-mcp",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function encodePath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeGitHubContent(value: GitHubContent) {
  if (!value.content || value.encoding !== "base64") return "";
  const binary = atob(value.content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeTitle(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
