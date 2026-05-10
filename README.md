# BPMN Studio

BPMN Studio is a BA-oriented BPMN 2.0 workspace for turning business text into reviewable process logic, then into Camunda-ready BPMN XML.

## Problem Statement

Business analysts usually start with text, meeting notes, SOPs, or draft process descriptions. The expensive part is not drawing boxes. It is:

- identifying the right actors and swimlanes
- separating actions from conditions
- preserving exception paths
- reviewing logic before a BPMN diagram becomes an artifact for stakeholders or engineers

BPMN Studio shortens that workflow while keeping a human review layer before final BPMN generation.

## Target Users

- Business Analyst
- Process Analyst
- Operations / Transformation team
- Teams preparing BPMN for Camunda

## Main Workflow

1. Enter business description in Vietnamese or English.
2. Parse into structured steps with actors, actions, task types, and gateways.
3. Review the extracted logic in a BA workbench.
4. Check BA-friendly warnings and BPMN quality checklist.
5. Generate BPMN XML and preview the diagram.
6. Export `.bpmn`, PNG, or a BA brief with traceability and business context.

## What Makes This Project BA-Oriented

- Parse review warns about ambiguous actors, multi-action lines, unpaired XOR branches, and weak AND usage.
- Step table stores traceability fields such as source sentence, BPMN node id, BA note, business rule reference, and requirement/story reference.
- Analyze view includes a BA-friendly BPMN checklist:
  - actor / lane alignment
  - gateway appropriateness
  - business step retention
  - condition vs action clarity
  - reject / exception path presence
  - end state clarity
- Exported BA brief includes:
  - process summary
  - actor list / RACI-lite
  - business rules
  - assumptions
  - exception flows
  - input / output
  - open questions
- Catalog supports AS-IS / TO-BE style comparison against the current workspace.

## Architecture

Frontend:

- `index.html`: landing page
- `designer.html`: main workspace
- `designer.js`: orchestration and UI logic
- `ba-tools.js`: BA-oriented helpers for traceability, checklist, review warnings, export, compare
- `bpmn-engine.js`: offline BPMN generation fallback

Backend:

- `server/server.js`: REST API
- `server/parser.js`: text-to-structure parser
- `server/bpmn-service.js`: BPMN generation, layout, validation

## Offline / Online Mode

- Online mode uses the Node backend for parsing, generation, analyze, validate, and assistant features.
- Offline mode still supports:
  - fallback parsing
  - BPMN generation via `bpmn-engine.js`
  - local analyze / validate heuristics
  - BA review workflow in the browser

## Real Business Scenario Coverage

Automated tests cover business-oriented scenarios, not just technical smoke tests:

- purchase flow
- leave request
- invoice approval
- procurement with XOR + AND
- rework loop
- happy path only
- multi-lane handoff

Run:

```bash
cd server
npm test
```

## Known Limitations

- Exact traceability mapping between generated BPMN ids and repeated task names is best-effort if names are duplicated.
- Natural language parsing is heuristic-first when Gemini is unavailable.
- Complex loops and advanced BPMN constructs are not yet fully modeled as first-class editing concepts.

## Portfolio Notes

This project is intentionally positioned as a BA support tool, not a generic AI diagram demo. The review layer, checklist, traceability fields, and exported BA brief are core parts of that positioning.

## Suggested Screenshots / GIFs

Add these to strengthen the portfolio presentation:

- Step 1 prompt workspace
- Step 2 logic review with warnings + checklist
- Step 3 BPMN diagram preview
- BA brief export
- AS-IS / TO-BE compare modal

## Future Roadmap

- stronger loop / rework modeling
- richer BPMN validation rules
- side-by-side compare between two catalog items
- direct requirements import
- stakeholder-ready report templates
