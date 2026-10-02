import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const payload=process.argv[2];
assert.ok(payload,'Input directory required');
async function replace(file,old,next){const s=await readFile(file,'utf8');assert.equal(s.split(old).length-1,1,`${file}: expected one exact edit target`);await writeFile(file,s.replace(old,next));}
async function appendBefore(file,heading,text){await replace(file,heading,text+'\n\n'+heading);}
const skill='plugins/dossierkit-notes/skills/publish-note/SKILL.md';
await appendBefore(skill,'## Global authoring constraints',`## Optimize for understanding

The acceptance criterion is what the reader can explain, verify, and decide, not output length or visual polish. Read the source before proposing a format. Establish one central question, the reader's prerequisites, and the decision or mental model the note should enable. Use STE-inspired prose: explicit actors and actions, stable terminology, complete short sentences, and one topic per paragraph. Preserve causal connectors, uncertainty, versions, denominators, and failure conditions. Define essential terms on first use. Chinese notes adapt these principles, not English word counts; neither Chinese prose nor an approximate style prompt establishes ASD-STE100 compliance. Present source-author experience as experience, not a measured universal ranking.

Use the least elaborate form that resolves the actual comprehension obstacle. The structured-representation order below is conditional on fitness, not a mandate to replace clear prose. Add an original, clearly labeled worked example or boundary case where an abstract mechanism needs grounding. Keep the primary explanation coherent before adding optional detail. Interactive HTML and explainer video are opt-in explanation layers: require a demonstrable learning purpose, supported delivery path, and authorization for new costs or deployment. Safe note content remains static; arbitrary scripts and inline styles stay outside the note pipeline. See the explanatory workflow in research-quality.md and the media escalation rules in visual-authoring.md.

Before release, check whether a reader can restate the mechanism, predict one changed condition, identify an applicability boundary, and trace the central evidence. This is editorial review, not proof of comprehension or a fabricated reader test. Stop when another paragraph, diagram, or medium adds no explanatory value. Keep research, learning, and engineering notes neutral; personal career advice belongs only in explicitly requested career material.`);
await replace(skill,'Open every finished note with one concise philosophical proposition grounded in the article\'s evidence; it should express the governing idea about agency, evidence, trust, state, responsibility, or another concept genuinely established by the material.','Open every finished note with one concise philosophical proposition grounded in the article\'s evidence, expressed in plain language as the governing idea rather than an ornamental motto. It should concern a concept genuinely established by the material and should not obscure the concrete question.');
const research='plugins/dossierkit-notes/skills/publish-note/references/research-quality.md';
await appendBefore(research,'## Public voice',`## Understanding-first editorial workflow

Apply SKILL.md's global constraints. Produce the smallest complete explanation, not a mandatory collection of sections.

1. Frame the task: identify one reader question, necessary prerequisites, and the judgment the note should support. Bring a short definition immediately before the first mechanism that needs it.
2. Build the evidence record: read primary text and relevant figures; separate observations, normative requirements, author opinions, and editorial inferences. Preserve unavailable-source status. A title, search excerpt, or mirror alone does not prove the full original was read.
3. Draft the argument: governing proposition, conclusion and scope, then problem, mechanism, evidence, and boundary. Include concrete implementation actions only when the subject calls for them. Keep conditions and causal words when shortening sentences.
4. Ground the difficult step: use a small worked example and a relevant boundary or failure case where they clarify an abstraction. Mark invented inputs, simplified logic, and illustrative results. Do not attribute a constructed example to the source or a live product.
5. Choose representations: apply visual-authoring.md to the specific difficulty. Progressive disclosure can hold supplementary detail, but key assumptions and limits remain adjacent to the main claim.
6. Review understanding: attempt a plain-language restatement, a changed-condition prediction, a boundary diagnosis, and evidence tracing. Repair missing causal links. Do not force four quiz blocks into every published note or report a self-review as a user study.
7. Verify publication: check the canonical identity, source links, example semantics, rendering, and supported interactions. Distinguish saved, CI-passed, and verified-live states.

### STE-inspired language pass

The official ASD-STE100 Issue 9 includes terminology consistency (1.11), active voice with a limited unknown-agent exception (3.6), clear complete sentences (4.1-4.4), procedural writing (5.1-5.4), and gradual single-topic description (6.1-6.6). Use these as background, not as a claim that this house style reproduces or certifies the standard. Do not copy the controlled dictionary into the Skill.

| Editorial question | Revision action |
|---|---|
| Who acts, on what, and under which condition? | State the actor and action when known; label an undisclosed actor as unknown. |
| Did one concept acquire several names? | Retain one term and its short first-use definition; preserve distinctions between different concepts. |
| Does a sentence combine several independent operations? | Separate the operations while keeping order and causal connectors. |
| Is a paragraph switching topics? | Give each paragraph one question; keep complete sentences rather than disconnected fragments. |
| Does brevity hide a safety, version, or evidence limit? | Restore the qualifier next to the claim. |
| Is the text claiming formal standard compliance? | Use STE-inspired unless the full applicable standard, dictionary, and terminology have actually been checked. |

For Chinese, use natural short clauses and explicit causal links. Do not convert English word limits into arbitrary Chinese character quotas. In English, a request for formal ASD-STE100 compliance requires the actual standard and complete lexical review; a request for roughly 80 percent of its style is only a preference. General research explanation need not imitate a maintenance checklist.

Source provenance: Karpathy's [post](https://x.com/karpathy/status/2105819303471976479) supplies personal observations about output formats, not comparative comprehension data. The [official STE overview](https://www.asd-ste100.org/about_STE.html) and [Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) support the standard description. The comprehension review and workflow here are project-specific editorial choices.`);
const visual='plugins/dossierkit-notes/skills/publish-note/references/visual-authoring.md';
await replace(visual,'Keep diagram labels short and edges meaningful.','Prefer `flowchart TB` for long flows and vertical reading. Use a sequence diagram for call/return semantics; split an oversized diagram at a meaningful boundary rather than shrinking its text. Keep diagram labels short and edges meaningful.');
await appendBefore(visual,'## SVG asset contract',`## Escalate media only when it improves explanation

Plain prose is the default for a simple definition or conclusion. A table handles exact values or aligned differences; Mermaid handles branches, state, responsibility, and calls. Their ordering is a fit test, not a universal superiority claim. A body SVG is for a mechanism the other static forms cannot show well. Each relation has one main representation, with prose for implications and caveats rather than label-by-label repetition.

Distinguish reading interaction from computational interaction. Supported native details/summary can disclose supplementary evidence without custom JavaScript. Keep the central argument, critical assumptions, and failure limits visible. A simulation needs a meaningful input, an explicit rule or model, an observable output, reset behavior, and at least one boundary test. Clearly distinguish sample or simulated data from measured results. Animation without a testable relationship is not a simulation.

The current Markdown and semantic HTML pipelines reject active scripts; semantic HTML also rejects inline styles and form controls. Keep that security boundary intact. A richer explainer is a separate, reviewed, authorized deployment or attachment linked from a canonical static note, with a useful static fallback. Do not insert script, iframe, remote executable dependencies, or secret keys into note content, and do not change the sanitizer merely to satisfy an output-format suggestion.

Video is optional, not a new default deliverable. Use it when timing, continuous transformation, or spatial change is essential and the user authorizes the production cost. Review the storyboard before rendering; then verify the agreement of narration, labels, equations, and animation. Include captions, a transcript, playback controls, and an appropriate description of meaningful visual information. Use reduced-motion alternatives where applicable. Confirm an available production tool before promising a generated video, and keep service credentials out of artifacts. The [W3C media planning guide](https://www.w3.org/WAI/media/av/planning/) is the accessibility reference.

Check actual supported rendering on mobile and desktop before reporting it verified. A requested HTML format does not automatically imply a working application, and a screenshot does not verify an interaction. Model self-review is not evidence of improved human understanding. Keep the independent Open Graph cover requirement unchanged.`);
await appendBefore('AGENTS.md','## Public UI actions',`## Understanding-first notes

Research, learning, and engineering notes follow the canonical publish-note Skill rather than the career-presentation guidance above. Apply STE-inspired clear prose, define essential terms on first use, preserve causal and evidence boundaries, and ground difficult mechanisms in a labeled example or relevant failure case. Choose media by what the reader must understand; keep simple prose simple, long Mermaid flows vertical, and computational HTML or video opt-in and separately reviewed. Review whether the reader can explain, transfer, identify limits, and verify the argument. Do not add personal career advice to technical notes. The Skill and its references remain the source of truth; the build regenerates the MCP catalog and plugin package from them.`);
const mcp='functions/api/mcp.ts';
const prefix='Save only a finished note. Provide exactly one Markdown or safe semantic HTML document with one H1, then concise topics.';
const policy=' Optimize for reader understanding, not length: define the central question and essential terms; use STE-inspired clear prose with explicit actors, stable terms, complete short sentences and preserved causal links. Chinese adapts the principles, not English word counts; do not claim ASD-STE100 compliance from a style prompt. Preserve evidence limits and distinguish author opinions from results. Ground difficult mechanisms in a labeled worked example or boundary case. Prefer flowchart TB for long flows. Computational HTML and explainer videos are optional, require a supported and authorized delivery path, and must not weaken static-note security. Before saving, review restatement, changed-condition prediction, applicability boundaries and evidence traceability; self-review is not a human comprehension study. Read the canonical publish-note Skill and its research and visual references. Keep technical notes neutral, without unsolicited personal career advice.';
await replace(mcp,prefix,prefix+policy);
await replace('scripts/test-mcp-skill.ts','import { createHash } from "node:crypto";','import { createHash } from "node:crypto";\nimport { readFile } from "node:fs/promises";');
await replace('scripts/test-mcp-skill.ts','    assert.equal(digest, resource.digest);',`    assert.equal(digest, resource.digest);
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
    }`);
// The Notes MCP hit its Worker subrequest limit before creating anything.
// Reuse the canonical parser, identity and artwork validation; never relax them.
const ingest=await import(pathToFileURL(resolve('src/lib/note-ingest.ts')).href);
const {readContentCollection}=await import(pathToFileURL(resolve('src/lib/profile-loader.ts')).href);
const asset=await import(pathToFileURL(resolve('src/lib/note-assets.mjs')).href);
const markdown=await readFile(join(payload,'note.md'),'utf8');
const cover=asset.validateSvg(await readFile(join(payload,'cover.svg'),'utf8'),'cover.svg');
const prepared=await ingest.prepareNote({markdown,topics:['LLM 输出','技术写作','ASD-STE100','解释设计','知识管理'],kind:'learning'});
const notes=readContentCollection(prepared.locale,'notes');
const normalize=s=>s.normalize('NFKC').trim().toLowerCase();
assert.ok(!notes.some(n=>normalize(n.data.title)===normalize(prepared.title)),'A canonical title now exists; stop and reconcile');
let key=ingest.deriveCanonicalNoteKey(prepared);
if(notes.some(n=>n.slug===key))key=ingest.collisionSlug(key,prepared.title);
assert.ok(!notes.some(n=>n.slug===key),'Canonical path collision');
const noteRef=prepared.locale+'/'+key;
const notePath=`profiles/default/content/${prepared.locale}/notes/${key}.mdx`;
const coverPath=asset.assetDirectory('default',noteRef)+'/cover.svg';
await mkdir(dirname(notePath),{recursive:true});await mkdir(dirname(coverPath),{recursive:true});
await writeFile(notePath,ingest.renderCanonicalNote(prepared));await writeFile(coverPath,cover.source);
await mkdir('artifacts/understanding-first',{recursive:true});
await writeFile('artifacts/understanding-first/note.json',JSON.stringify({noteRef,notePath,coverPath,title:prepared.title,publicUrl:`https://sunionpeaks.pages.dev/${prepared.locale}/notes/${key}/`,contentHash:await asset.effectiveNoteHash(prepared.contentHash,{'cover.svg':cover.source}),sourcePost:'https://x.com/karpathy/status/2105819303471976479',publicationFallback:'Notes MCP subrequest limit; unchanged canonical parsers and asset validator used in isolated Git checkout'},null,2));
console.log('Prepared canonical note and scoped understanding-first SOP changes.');
