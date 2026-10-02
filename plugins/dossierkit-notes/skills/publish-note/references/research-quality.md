# Research and editorial quality

Use this reference for source-driven notes, historical-note consolidation, and publication review.

## Evidence record

For each conclusion that changes the reader's understanding or action, record:

| Element | Question |
|---|---|
| Claim | What exactly is asserted? |
| Evidence | Which primary passage, result, schema, or observed behavior supports it? |
| Limit | Which population, version, environment, metric, or assumption bounds it? |
| Interpretation | What follows for the note's central problem? |

Keep inference visible through phrasing such as “this suggests,” “the engineering implication is,” or an equivalent expression in the note's language.

## Source-specific reading

### Empirical research

Capture the research question, dataset and sampling, task construction, baselines, ablations, metrics, variance, cost, and stated limitations. Explain what each result measures. A component metric or offline success rate supports only the scope tested.

### Systems research

Identify the conditions that break the previous design; the inputs, outputs, state, and responsibility of each new component; control-plane and data-plane boundaries; recovery, concurrency, consistency, security, and observability; and whether the evaluation exercises the claimed bottleneck.

### Protocols, specifications, and releases

Record the version, date, normative language, compatibility boundary, smallest wire-level change, state machine, error semantics, and division between protocol guarantees and implementation responsibility. Separate the wire contract, current SDK surface, and application-level reference design.

### Position papers and technical commentary

Identify the central proposition, the kind of support offered, and the conditions that could validate or refute it. A source built mainly from analogy or advocacy supports a focused critical note whose value lies in the problem framing and validation path.

### Product and company engineering posts

Separate product claims from disclosed implementation, evaluation settings, failure cases, current availability, and operational consequences. Verify changing capability claims against the latest first-party material.

## Canonical-note decision

Compare the closest accessible note on these dimensions:

| Dimension | Existing note | New material | Decision signal |
|---|---|---|---|
| Core problem | Question answered | Same or different | Same problem favors an update |
| Architecture layer | Runtime, gateway, protocol, skill, product | Same or different | Different layer may justify a separate note |
| Evidence | Data, specification, implementation, incident | Material addition | New evidence should change the argument |
| Engineering conclusion | Existing action or boundary | Changed action or boundary | A changed decision justifies revision or separation |
| Currency | Version and date | Superseded or current | Superseded conclusions belong in the canonical update |

Update the existing note when the problem, evidence, and conclusion substantially overlap. Create a new note when the new material answers a different core question or changes a distinct architectural boundary. Use a focused critical note when the source contributes a meaningful proposition but limited mechanism or evidence.

## Argument shape

Start with the direct thesis and a 30-second layer. A philosophical proposition is optional; use it only when it sharpens the concrete problem. The scan path should communicate the argument before the reader commits to the full body:

```text
title → direct thesis → 3–5 key takeaways → one primary visual/table if useful
      → mechanism → evidence → boundary → practical action
```

A skim reader should be able to reconstruct the central claim from headings, bold lead-ins, and structured elements. If the argument disappears when ordinary paragraphs are hidden, the structure is still too prose-dependent.

Select only the modules supported by the material:

- previous model and failure condition;
- problem actually solved;
- mechanism, state flow, or responsibility boundary;
- results and evidence limits;
- implementation, migration, evaluation, and failure semantics;
- consequences for users or operators that follow from the mechanism;
- unresolved questions;
- conclusion that returns to the opening proposition.

Each section should contribute new information. Article length follows evidence density.

## Understanding-first editorial workflow

Apply SKILL.md's global constraints. Produce the smallest complete explanation, not a mandatory collection of sections.

1. Frame the task: identify one reader question, necessary prerequisites, and the judgment the note should support.
2. Build the evidence record: read primary text and relevant figures; separate observations, normative requirements, author opinions, and editorial inferences. Preserve unavailable-source status.
3. Draft the 30-second layer first: one thesis, 3–5 takeaways, and at most one primary structured representation if it removes real decoding work.
4. Expand only the hard parts: add mechanism, evidence, a worked example, and the boundary that changes interpretation. Do not repeat the 30-second layer in prose.
5. Move non-critical detail out of the main scan path: use progressive disclosure or later sections for specifications, source inventories, secondary examples, and implementation notes.
6. Run two reviews: a comprehension review (restate, predict, diagnose a boundary, trace evidence) and a skim review (hide ordinary paragraphs mentally; the remaining structure should still tell the story).
7. Verify publication: check canonical identity, source links, example semantics, rendering, supported interactions, and mobile scanability. Distinguish saved, CI-passed, and verified-live states.

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

Source provenance: Karpathy's [post](https://x.com/karpathy/status/2105819303471976479) supplies personal observations about output formats, not comparative comprehension data. The [official STE overview](https://www.asd-ste100.org/about_STE.html) and [Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) support the standard description. The comprehension review and workflow here are project-specific editorial choices.

## Public voice

Write as finished external publication copy. State ownership, scope, mechanisms, evidence, and outcomes with direct active language. Present limitations as part of the technical boundary. Omit internal planning language, unfinished markers, evaluator-directed remarks, and unavailable metrics.

## Review checklist

- Exactly one H1 and one central problem.
- The direct thesis appears immediately; any philosophical proposition is optional and must improve understanding.
- A 30-second layer exposes 3–5 key takeaways before the full body.
- The skim path (headings, bold lead-ins, primary structured elements) reconstructs the argument without requiring every paragraph.
- Every important number includes its metric meaning, baseline, and scope.
- Facts, requirements, reported claims, and interpretation remain distinguishable.
- Source versions, dates, protocol fields, and SDK methods are current and attributable.
- Engineering recommendations identify responsibility, stored state, check timing, or failure handling where relevant.
- Evidence limits and unresolved questions appear beside their affected conclusions.
- Repeated conclusions and generic industry framing have been consolidated.
