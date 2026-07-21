import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { noteSaveInputSchema } from "../../src/lib/note-ingest";
import { saveNoteToGitHub, type NotesEnvironment } from "../../src/server/github-notes";

type Environment = NotesEnvironment & {
  NOTES_MCP_TOKEN?: string;
};

export const onRequest = async ({ request, env }: { request: Request; env: Environment }) => {
  if (request.method === "OPTIONS") return corsResponse(new Response(null, { status: 204 }));

  const authError = authorize(request, env);
  if (authError) return corsResponse(authError);

  const requestUrl = new URL(request.url);
  const server = createServer(env, requestUrl.origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [requestUrl.host]
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return corsResponse(response);
};

function createServer(env: Environment, requestOrigin: string) {
  const server = new McpServer(
    { name: "dossierkit-notes", version: "1.0.0" },
    {
      instructions:
        "Use save_note only after the note is complete. Send one finished Markdown document with exactly one H1 title. Never invent or request a slug: the server derives a stable, readable slug from the title and extracted topics. Reusing the same title updates the same canonical note."
    }
  );

  server.registerTool(
    "save_note",
    {
      title: "Save canonical note",
      description:
        "Publish or update one canonical research, learning, or engineering note. Provide the finished Markdown and concise topics extracted from it. The server owns title parsing, language detection, summary generation, slug generation, deduplication, file location, and GitHub publication; callers cannot provide a slug or destination path.",
      inputSchema: noteSaveInputSchema,
      annotations: {
        title: "Save canonical note",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
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
              text: `Note ${verb}. Canonical slug: ${result.slug}. Public URL: ${result.publicUrl}${result.commitUrl ? `. Commit: ${result.commitUrl}` : ""}`
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

function authorize(request: Request, env: Environment) {
  const configured = env.NOTES_MCP_TOKEN;
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (!configured) {
    return isLocal
      ? undefined
      : jsonError(503, "NOTES_MCP_TOKEN must be configured before the public MCP endpoint is enabled.");
  }

  const provided = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided || !timingSafeEqual(provided, configured)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "WWW-Authenticate": "Bearer"
      }
    });
  }
  return undefined;
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
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
