import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { noteDeleteInputSchema, noteGetInputSchema, noteSaveInputSchema, deleteNoteFromGitHub, getNoteFromGitHub, saveNoteToGitHub } from '../../src/server/github-note-bundles';
import { AccessAuthenticationError, AccessConfigurationError, verifyCloudflareAccess, type AccessAuthEnvironment } from '../../src/server/access-auth';
import type { NotesEnvironment } from '../../src/server/github-notes';
import { registerNoteSkill } from '../../src/server/mcp-note-skill';
type Environment = NotesEnvironment & AccessAuthEnvironment;

// Delivered to the authoring client at MCP initialization, never appended to a note.
export const PUBLICATION_BOUNDARY_PROMPT = 'Public notes are for external readers, not records of the authoring process. Keep internal authoring instructions, editorial SOP, prompt updates, review checklists, tool/repository/deployment details and promises about future generation out of the article, including public appendices and collapsed sections. Apply the rules silently; publish only subject-relevant ideas, mechanisms, examples, evidence and limits. A request to publish a note and improve its generation SOP has two separate deliverables: the public article and an internal prompt/Skill update. Mention DossierKit only when the user explicitly requests an article about DossierKit itself. Reader-facing prompt examples are allowed when prompting is the subject, but never insert instructions addressed to the publishing agent. The 30-second layer and skim test are internal design aids, not mandatory public headings or duplicated takeaways. Use topic-specific headings; a compact table or example can carry the core argument without a repeated list and diagram. Check that a stranger can understand why every section belongs without knowing this conversation or workflow. Put change reports and deployment receipts in the completion message, not the article.';

export const onRequest = async ({request,env}:{request:Request;env:Environment}) => {
  if (request.method === 'OPTIONS') return corsResponse(new Response(null,{status:204}));
  const authError = await authorize(request,env);
  if (authError) return corsResponse(authError);
  const server = createServer(env,new URL(request.url).origin);
  const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  return corsResponse(await transport.handleRequest(request));
};
export function createServer(env:Environment, origin:string) {
  const candidate = z.object({noteRef:z.string(),title:z.string(),summary:z.string(),publicUrl:z.string(),format:z.enum(['markdown','html'])});
  const saveOutput = z.object({action:z.enum(['created','updated','unchanged']),noteRef:z.string(),path:z.string(),commitUrl:z.string().optional(),publicUrl:z.string(),contentHash:z.string(),assetNames:z.array(z.string())});
  const getOutput = z.object({status:z.enum(['found','ambiguous','not_found']),note:candidate.extend({locale:z.enum(['zh','en']),kind:z.enum(['research','learning','engineering']).optional(),topics:z.array(z.string()),markdown:z.string().optional(),html:z.string().optional(),contentHash:z.string(),assetNames:z.array(z.string()),assets:z.record(z.string(),z.string()).optional()}).optional(),candidates:z.array(candidate).optional()});
  const deleteOutput = z.object({action:z.literal('deleted'),noteRef:z.string(),title:z.string(),format:z.enum(['markdown','html']),path:z.string(),publicUrl:z.string(),contentHash:z.string(),commitUrl:z.string().optional()});
  const server = new McpServer({name:'dossierkit-notes',version:'1.6.0'},{instructions:
    PUBLICATION_BOUNDARY_PROMPT + '\n\n' + 'Save only a finished note. Provide exactly one Markdown or safe semantic HTML document with one H1, then concise topics. Optimize for reader understanding, not length: define the central question and essential terms; use STE-inspired clear prose with explicit actors, stable terms, complete short sentences and preserved causal links. Chinese adapts the principles, not English word counts; do not claim ASD-STE100 compliance from a style prompt. Preserve evidence limits and distinguish author opinions from results. Ground difficult mechanisms in a labeled worked example or boundary case. Prefer flowchart TB for long flows. Computational HTML and explainer videos are optional, require a supported and authorized delivery path, and must not weaken static-note security. Before saving, review restatement, changed-condition prediction, applicability boundaries and evidence traceability; self-review is not a human comprehension study. Read the canonical publish-note Skill and its research and visual references. Keep technical notes neutral, without unsolicited personal career advice. Optional assets is a filename-to-SVG map: cover.svg is the 1200x630 share cover; other SVGs are inline diagrams. For structured explanation, prefer Mermaid > Table > SVG > Text after checking that it adds understanding. Keep clear prose as prose; do not repaint it as image cards. Keep Mermaid in document code fences; body SVGs are only for mechanisms Mermaid or a table cannot clarify. Author a topic-specific cover.svg with each new note unless the user explicitly omits the sharing cover or supplies a suitable one. Body-only edits preserve a suitable cover; fewer body images does not remove the sharing cover. SVG must have xmlns, viewBox and a root title, using static shapes/text and presentation attributes; scripts, styles, external resources, foreignObject, use, animation, entities and nested SVG are rejected. Use ![alt](asset:name.svg) in Markdown or <img src="asset:name.svg" alt="..."> in HTML; a cover need not appear in the body. No share fields, paths, base64 or remote downloads. Omitted assets are preserved; same-name source replaces; null explicitly removes an unreferenced asset. get_note first before editing/deleting; preserve its noteRef and format. Request includeAssets only to edit SVG sources. contentHash covers the document and assets and must be copied from the latest read for delete_note. A successful save commits once; report deployment separately after CI, live article, and Open Graph cover checks. Neither MCP nor CI calls another model.'});
  registerNoteSkill(server);
  server.registerTool('get_note',{title:'Read canonical note',description:'Find the current note before editing or deleting. Returns portable image references and assetNames; includeAssets=true also returns SVG sources when artwork needs editing.',inputSchema:noteGetInputSchema,outputSchema:getOutput,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}, async(input) => {
    try { const result = await getNoteFromGitHub(input,env,origin); return {content:[{type:'text',text:result.status === 'found' ? `Found ${result.note!.noteRef}. Preserve this identity and omit unchanged assets.` : result.status === 'ambiguous' ? 'Multiple notes matched; select one returned noteRef and read again.' : 'No canonical note matched.'}],structuredContent:result}; }
    catch(error) { return toolError(error); }
  });
  server.registerTool('save_note',{title:'Save canonical note and assets',description:'Create or update one finished reader-facing Markdown/HTML article and optional SVG assets in one commit. Keep internal authoring SOP, prompt updates and deployment reports outside the article. cover.svg is the share cover; filenames are local identifiers, not paths. Create a topic cover with a new note by default unless the user explicitly omits the sharing cover or supplies a suitable one; preserve it during body-only edits. Body visuals must add understanding; prefer Mermaid > Table > SVG > Text for structured explanation. Omit assets to preserve them. Same-name source updates; null deletes only when no longer referenced. Read existing notes first and preserve noteRef/format. Saves do not imply deployment.',inputSchema:noteSaveInputSchema,outputSchema:saveOutput,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async(input) => {
    try { const result = await saveNoteToGitHub(input,env,origin); return {content:[{type:'text',text:`Note ${result.action}. Canonical noteRef: ${result.noteRef}. ${result.action === 'unchanged' ? 'No commit was created.' : 'Document and assets committed together; CI deployment has not yet been verified.'} Public URL: ${result.publicUrl}${result.commitUrl ? `. Commit: ${result.commitUrl}` : ''}`}],structuredContent:result}; }
    catch(error) { return toolError(error); }
  });
  server.registerTool('delete_note',{title:'Delete canonical note and owned assets',description:'Remove the exact note and its exclusive asset directory in one commit. Read first and pass the exact noteRef and current contentHash; it fails when the document or artwork changed. The website changes after deployment; Git history remains.',inputSchema:noteDeleteInputSchema,outputSchema:deleteOutput,annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:true}},async(input) => {
    try { const result = await deleteNoteFromGitHub(input,env,origin); return {content:[{type:'text',text:`Deletion committed for ${result.noteRef} and its owned assets. Public removal awaits deployment.`}],structuredContent:result}; }
    catch(error) { return toolError(error); }
  });
  return server;
}
function toolError(error:unknown) { return {content:[{type:'text' as const,text:error instanceof Error ? error.message : String(error)}],isError:true}; }
async function authorize(request:Request, env:Environment) {
  const host = new URL(request.url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (!Boolean(env.NOTES_ACCESS_AUD?.trim() || env.NOTES_ACCESS_ISSUER?.trim())) return local ? undefined : jsonError(404,'Not found');
  try { if (await verifyCloudflareAccess(request,env)) return undefined; }
  catch(error) {
    if (error instanceof AccessConfigurationError) return jsonError(503,error.message);
    if (error instanceof AccessAuthenticationError) return jsonError(401,error.message);
    return jsonError(503,'Cloudflare Access authentication is unavailable.');
  }
  return jsonError(401,'Cloudflare Access authentication is required.');
}
function jsonError(status:number,error:string) { return new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json; charset=utf-8'}}); }
function corsResponse(response:Response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, Last-Event-ID, MCP-Protocol-Version, MCP-Session-Id');
  headers.set('Access-Control-Expose-Headers','MCP-Protocol-Version, MCP-Session-Id');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
