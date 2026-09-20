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

Start with one evidence-grounded philosophical proposition that governs the note. Follow with the technical conclusion and its scope. Build the rest in this order:

```text
source fact → mechanism → engineering implication → practical action
```

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

## Public voice

Write as finished external publication copy. State ownership, scope, mechanisms, evidence, and outcomes with direct active language. Present limitations as part of the technical boundary. Omit internal planning language, unfinished markers, evaluator-directed remarks, and unavailable metrics.

## Review checklist

- Exactly one H1 and one central problem.
- The opening proposition is supported by the article and guides the argument.
- The opening technical summary appears before diagrams and remains useful as an excerpt.
- Every important number includes its metric meaning, baseline, and scope.
- Facts, requirements, reported claims, and interpretation remain distinguishable.
- Source versions, dates, protocol fields, and SDK methods are current and attributable.
- Engineering recommendations identify responsibility, stored state, check timing, or failure handling where relevant.
- Evidence limits and unresolved questions appear beside their affected conclusions.
- Repeated conclusions and generic industry framing have been consolidated.
