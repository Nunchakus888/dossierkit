import {
  collisionSlug,
  noteGetInputSchema,
  noteSaveInputSchema,
  parseCanonicalNote,
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
  name?: string;
  path?: string;
  sha?: string;
  type?: string;
};

type StoredNote = {
  key: string;
  noteRef: string;
  path: string;
  sha?: string;
  parsed: ReturnType<typeof parseCanonicalNote>;
};

export type SaveNoteResult = {
  action: "created" | "updated" | "unchanged";
  noteRef: string;
  path: string;
  commitUrl?: string;
  publicUrl: string;
  contentHash: string;
};

export type NoteCandidate = {
  noteRef: string;
  title: string;
  summary: string;
  publicUrl: string;
};

export type GetNoteResult = {
  status: "found" | "ambiguous" | "not_found";
  note?: NoteCandidate & {
    locale: "zh" | "en";
    kind?: "research" | "learning" | "engineering";
    topics: string[];
    markdown: string;
    contentHash: string;
  };
  candidates?: NoteCandidate[];
};

export async function saveNoteToGitHub(
  rawInput: NoteSaveInput,
  env: NotesEnvironment,
  requestOrigin: string,
  requestFetch: typeof fetch = fetch
): Promise<SaveNoteResult> {
  const input = noteSaveInputSchema.parse(rawInput);
  const context = repositoryContext(env, requestOrigin);
  let note = await prepareNote(input);
  let existing: StoredNote | undefined;
  let key: string;

  if (input.noteRef) {
    const identity = splitNoteRef(input.noteRef);
    existing = await getStoredNote(context, identity.locale, identity.key, requestFetch);
    if (!existing) throw new Error(`No canonical note exists for noteRef ${input.noteRef}. Call get_note before updating.`);
    note = await prepareNote(input, new Date(), existing.parsed.metadata);
    if (note.locale !== identity.locale) {
      throw new Error("An update cannot change the note locale. Create a separate translated note instead.");
    }
    key = identity.key;
  } else {
    const notes = await listStoredNotes(context, note.locale, requestFetch);
    existing = notes.find((item) => normalizeTitle(item.parsed.metadata.title) === normalizeTitle(note.title));
    if (existing) {
      note = await prepareNote(input, new Date(), existing.parsed.metadata);
      key = existing.key;
    } else {
      key = input.suggestedSlug as string;
      existing = notes.find((item) => item.key === key);
      if (existing) {
        key = collisionSlug(key, note.title);
        existing = notes.find((item) => item.key === key);
        if (existing && normalizeTitle(existing.parsed.metadata.title) !== normalizeTitle(note.title)) {
          throw new Error("The proposed path and its deterministic fallback are both occupied. Propose a more specific suggestedSlug.");
        }
      }
    }
  }

  const path = notePath(context.profileId, note.locale, key);
  if (existing && existing.parsed.contentHash === note.contentHash) {
    return saveResult("unchanged", note, key, path, undefined, context.siteUrl);
  }

  const document = renderCanonicalNote(note);
  const response = await requestFetch(
    githubContentUrl(context.owner, context.repo, path),
    {
      method: "PUT",
      headers: githubHeaders(context.token),
      body: JSON.stringify({
        message: `${existing ? "Update" : "Publish"} note: ${note.title}`,
        content: encodeBase64(document),
        branch: context.branch,
        ...(existing?.sha ? { sha: existing.sha } : {})
      })
    }
  );

  const payload = await response.json() as { commit?: { html_url?: string }; message?: string };
  if (!response.ok) {
    throw new Error(`GitHub write failed (${response.status}): ${payload.message || response.statusText}`);
  }

  return saveResult(
    existing ? "updated" : "created",
    note,
    key,
    path,
    payload.commit?.html_url,
    context.siteUrl
  );
}

export async function getNoteFromGitHub(
  rawInput: unknown,
  env: NotesEnvironment,
  requestOrigin: string,
  requestFetch: typeof fetch = fetch
): Promise<GetNoteResult> {
  const input = noteGetInputSchema.parse(rawInput);
  const context = repositoryContext(env, requestOrigin);
  const directRef = /^(zh|en)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(input.query);
  if (directRef) {
    const stored = await getStoredNote(context, directRef[1] as "zh" | "en", directRef[2], requestFetch);
    return stored ? foundResult(stored, context.siteUrl) : { status: "not_found" };
  }

  const locales = input.locale ? [input.locale] : ["zh", "en"] as const;
  const collections = await Promise.all(locales.map((locale) => listStoredNotes(context, locale, requestFetch)));
  const notes = collections.flat();
  const query = normalizeTitle(input.query);
  const exact = notes.filter((item) =>
    item.key === input.query || normalizeTitle(item.parsed.metadata.title) === query
  );
  if (exact.length === 1) return foundResult(exact[0], context.siteUrl);
  if (exact.length > 1) return ambiguousResult(exact, context.siteUrl);

  const partial = notes.filter((item) =>
    item.key.includes(input.query.toLowerCase()) || normalizeTitle(item.parsed.metadata.title).includes(query)
  );
  if (partial.length === 1) return foundResult(partial[0], context.siteUrl);
  if (partial.length > 1) return ambiguousResult(partial, context.siteUrl);
  return { status: "not_found" };
}

function repositoryContext(env: NotesEnvironment, requestOrigin = env.PUBLIC_SITE_URL || "") {
  const token = required(env.NOTES_GITHUB_TOKEN, "NOTES_GITHUB_TOKEN");
  const repository = required(env.NOTES_GITHUB_REPOSITORY, "NOTES_GITHUB_REPOSITORY");
  const [owner, repo, extra] = repository.split("/");
  if (!owner || !repo || extra) throw new Error("NOTES_GITHUB_REPOSITORY must use owner/repository format.");
  return {
    token,
    owner,
    repo,
    branch: env.NOTES_GITHUB_BRANCH || "main",
    profileId: env.NOTES_PROFILE_ID || "default",
    siteUrl: (env.PUBLIC_SITE_URL || requestOrigin).replace(/\/+$/, "")
  };
}

async function listStoredNotes(
  context: ReturnType<typeof repositoryContext>,
  locale: "zh" | "en",
  requestFetch: typeof fetch
) {
  const directory = `profiles/${context.profileId}/content/${locale}/notes`;
  const url = new URL(githubContentUrl(context.owner, context.repo, directory));
  url.searchParams.set("ref", context.branch);
  const response = await requestFetch(url, { headers: githubHeaders(context.token) });
  if (response.status === 404) return [];
  if (!response.ok) throw await githubReadError(response);
  const entries = await response.json() as GitHubContent[];
  const files = entries.filter((entry) => entry.type === "file" && entry.name?.match(/\.mdx?$/));
  return await Promise.all(files.map(async (entry) => {
    const key = entry.name!.replace(/\.mdx?$/, "");
    const stored = await getStoredNote(context, locale, key, requestFetch);
    if (!stored) throw new Error(`GitHub listed ${entry.path}, but the note could not be read.`);
    return stored;
  }));
}

async function getStoredNote(
  context: ReturnType<typeof repositoryContext>,
  locale: "zh" | "en",
  key: string,
  requestFetch: typeof fetch
): Promise<StoredNote | undefined> {
  const path = notePath(context.profileId, locale, key);
  const url = new URL(githubContentUrl(context.owner, context.repo, path));
  url.searchParams.set("ref", context.branch);
  const response = await requestFetch(url, { headers: githubHeaders(context.token) });
  if (response.status === 404) return undefined;
  if (!response.ok) throw await githubReadError(response);
  const content = await response.json() as GitHubContent;
  return {
    key,
    noteRef: `${locale}/${key}`,
    path,
    sha: content.sha,
    parsed: parseCanonicalNote(decodeGitHubContent(content))
  };
}

function foundResult(stored: StoredNote, siteUrl: string): GetNoteResult {
  const metadata = stored.parsed.metadata;
  return {
    status: "found",
    note: {
      noteRef: stored.noteRef,
      title: metadata.title,
      summary: metadata.summary,
      publicUrl: publicUrl(siteUrl, metadata.locale, stored.key),
      locale: metadata.locale,
      kind: metadata.kind,
      topics: metadata.topics,
      markdown: stored.parsed.markdown,
      contentHash: stored.parsed.contentHash
    }
  };
}

function ambiguousResult(notes: StoredNote[], siteUrl: string): GetNoteResult {
  return {
    status: "ambiguous",
    candidates: notes.map((stored) => ({
      noteRef: stored.noteRef,
      title: stored.parsed.metadata.title,
      summary: stored.parsed.metadata.summary,
      publicUrl: publicUrl(siteUrl, stored.parsed.metadata.locale, stored.key)
    }))
  };
}

function saveResult(
  action: SaveNoteResult["action"],
  note: PreparedNote,
  key: string,
  path: string,
  commitUrl: string | undefined,
  siteUrl: string
): SaveNoteResult {
  return {
    action,
    noteRef: `${note.locale}/${key}`,
    path,
    commitUrl,
    publicUrl: publicUrl(siteUrl, note.locale, key),
    contentHash: note.contentHash
  };
}

function splitNoteRef(noteRef: string) {
  const [locale, key] = noteRef.split("/") as ["zh" | "en", string];
  return { locale, key };
}

function notePath(profileId: string, locale: "zh" | "en", key: string) {
  return `profiles/${profileId}/content/${locale}/notes/${key}.mdx`;
}

function publicUrl(siteUrl: string, locale: "zh" | "en", key: string) {
  return `${siteUrl.replace(/\/+$/, "")}/${locale}/notes/${key}`;
}

function githubContentUrl(owner: string, repo: string, path: string) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`;
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

async function githubReadError(response: Response) {
  const payload = await response.json() as { message?: string };
  return new Error(`GitHub read failed (${response.status}): ${payload.message || response.statusText}`);
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
