import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOSSIERKIT_NOTE_SKILL } from "../generated/dossierkit-note-skill";

export const skillsListRequestSchema = z.object({
  method: z.literal("skills/list"),
  params: z.object({ cursor: z.string().optional() }).optional()
});

export const skillsGetRequestSchema = z.object({
  method: z.literal("skills/get"),
  params: z.object({ uri: z.string() })
});

export const skillCatalogEntry = {
  uri: DOSSIERKIT_NOTE_SKILL.uri,
  frontmatter: DOSSIERKIT_NOTE_SKILL.frontmatter,
  resources: DOSSIERKIT_NOTE_SKILL.resources.map(({ uri, digest }) => ({ uri, digest }))
};

export function registerNoteSkill(server: McpServer) {
  server.server.registerCapabilities({
    extensions: { "io.modelcontextprotocol/skills": {} }
  });

  server.server.setRequestHandler(skillsListRequestSchema, async () => ({
    skills: [skillCatalogEntry]
  }));

  server.server.setRequestHandler(skillsGetRequestSchema, async ({ params }) => {
    if (params.uri !== skillCatalogEntry.uri) {
      throw new McpError(ErrorCode.InvalidParams, `Skill ${params.uri} not found`);
    }
    return { skill: skillCatalogEntry };
  });

  for (const resource of DOSSIERKIT_NOTE_SKILL.resources) {
    server.registerResource(
      resource.uri.split("/").at(-1) || resource.uri,
      resource.uri,
      { mimeType: resource.mimeType },
      async () => ({
        contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text }]
      })
    );
  }
}
