import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { noteGetInputSchema, noteSaveInputSchema } from "../../src/lib/note-ingest";
import {
  AccessAuthenticationError,
  AccessConfigurationError,
  verifyCloudflareAccess,
  type AccessAuthEnvironment
} from "../../src/server/access-auth";
import { getNoteFromGitHub, saveNoteToGitHub, type NotesEnvironment } from "../../src/server/github-notes";

type Environment = NotesEnvironment & AccessAuthEnvironment;

export const onRequest = async ({ request, env }: { request: Request; env: Environment }) => {
  if (request.method === "OPTIONS") return corsResponse(new Response(null, { status: 204 }));

  const authError = await authorize(request, env);
  if (authError) return corsResponse(authError);

  const requestUrl = new URL(request.url);
  const server = createServer(env, requestUrl.origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return corsResponse(response);
};

function createServer(env: Environment, requestOrigin: string) {
  const candidateSchema = z.object({
    noteRef: z.string(),
    title: z.string(),
    summary: z.string(),
    publicUrl: z.string()
  });
  const saveOutputSchema = z.object({
    action: z.enum(["created", "updated", "unchanged"]),
    noteRef: z.string(),
    path: z.string(),
    commitUrl: z.string().optional(),
    publicUrl: z.string(),
    contentHash: z.string()
  });
  const getOutputSchema = z.object({
    status: z.enum(["found", "ambiguous", "not_found"]),
    note: candidateSchema.extend({
      locale: z.enum(["zh", "en"]),
      kind: z.enum(["research", "learning", "engineering"]).optional(),
      topics: z.array(z.string()),
      markdown: z.string(),
      contentHash: z.string()
    }).optional(),
    candidates: z.array(candidateSchema).optional()
  });
  const server = new McpServer(
    { name: "dossierkit-notes", version: "1.2.0" },
    {
      instructions:
        "Use save_note only after a note is complete. For a new note, provide the finished Markdown and concise topics extracted from it; the server derives and freezes the canonical path from the title and topics. To edit an existing note, call get_note first, revise its returned Markdown, then call save_note with the unchanged noteRef."
    }
  );

  server.registerTool(
    "get_note",
    {
      title: "Read canonical note",
      description:
        "Find and return the current canonical Markdown before editing a note. Search by noteRef, filename, title, or a distinctive title phrase. If more than one note matches, choose one returned noteRef and call get_note again.",
      inputSchema: noteGetInputSchema,
      outputSchema: getOutputSchema,
      annotations: {
        title: "Read canonical note",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (input) => {
      try {
        const result = await getNoteFromGitHub(input, env, requestOrigin);
        const text = result.status === "found"
          ? `Found ${result.note!.noteRef}. Use this exact noteRef when saving an edit.`
          : result.status === "ambiguous"
            ? `Multiple notes matched: ${result.candidates!.map((item) => item.noteRef).join(", ")}.`
            : "No canonical note matched the query.";
        return { content: [{ type: "text", text }], structuredContent: result };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "save_note",
    {
      title: "Save canonical note",
      description:
        "Create or update one canonical research, learning, or engineering note. For creation, provide finished Markdown and concise topics; the server derives the stable canonical path from the title and topics. For updates, first call get_note and provide its unchanged noteRef; the existing path is preserved. The server validates identity, deduplicates, and writes GitHub.",
      inputSchema: noteSaveInputSchema,
      outputSchema: saveOutputSchema,
      annotations: {
        title: "Save canonical note",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (input) => {
      try {
        const result = await saveNoteToGitHub(input, env, requestOrigin);
        const verb = result.action === "unchanged" ? "already current" : result.action;
        return {
          content: [
            {
              type: "text",
              text: `Note ${verb}. Canonical noteRef: ${result.noteRef}. Public URL: ${result.publicUrl}${result.commitUrl ? `. Commit: ${result.commitUrl}` : ""}`
            }
          ],
          structuredContent: result
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true
        };
      }
    }
  );

  return server;
}

async function authorize(request: Request, env: Environment) {
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const hasAccessConfiguration = Boolean(env.NOTES_ACCESS_AUD?.trim() || env.NOTES_ACCESS_ISSUER?.trim());

  if (!hasAccessConfiguration) {
    return isLocal ? undefined : jsonError(404, "Not found");
  }

  try {
    const accessIdentity = await verifyCloudflareAccess(request, env);
    if (accessIdentity) return undefined;
  } catch (error) {
    if (error instanceof AccessConfigurationError) return jsonError(503, error.message);
    if (error instanceof AccessAuthenticationError) return unauthorized(error.message);
    return jsonError(503, "Cloudflare Access authentication is unavailable.");
  }
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function corsResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Last-Event-ID, MCP-Protocol-Version, MCP-Session-Id"
  );
  headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, MCP-Session-Id");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
