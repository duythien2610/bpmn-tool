# CASE STUDY: BPMN Studio

## Context

The project started as a prompt-to-BPMN tool, but that framing was too weak for a serious BA portfolio. The real problem was not "can AI generate XML?" The real problem was "can a BA move from raw business text to a reviewable BPMN artifact with less manual rework?"

That shift changed the product direction.

## Product Thesis

BPMN generation is only one step in the workflow.

A useful BA tool must also support:

- business-text intake
- actor / lane review
- gateway review
- exception-path visibility
- traceability between source text and BPMN output
- comparison between process versions

## Key Design Decisions

### 1. Keep a review layer before BPMN generation

Instead of going directly from prompt to diagram, the product uses:

1. description input
2. structured step review
3. BPMN generation

This reduces the cost of AI mistakes and better matches how BA teams work in practice.

### 2. Treat traceability as a first-class concern

Each step now carries BA-oriented metadata:

- source sentence
- BPMN node id
- BA note
- business rule reference
- requirement / story reference

This supports portfolio storytelling because it shows the product understands analysis work, not only rendering.

### 3. Add BA-friendly quality signals, not only XML validation

Pure BPMN validation answers: "is the XML structurally acceptable?"

That is not enough for BA work.

The project adds a clearer checklist around:

- actor / lane correctness
- gateway suitability
- step retention
- ambiguity in input text
- reject / exception paths
- clear end states

### 4. Support both online and offline operation

The workspace still provides value when the backend is unavailable:

- fallback parser
- offline BPMN generation
- local analyze / validate heuristics
- BA review panels in-browser

This improves resilience and makes the demo easier to present.

## Technical Tradeoffs

### Tradeoff: heuristic parsing vs full NLP certainty

The parser intentionally prefers a heuristic + review workflow rather than claiming perfect interpretation. This is the correct tradeoff for the current product stage because:

- it keeps the app responsive
- it works without external AI in fallback mode
- it keeps human control in the loop

### Tradeoff: best-effort node traceability

Exact BPMN node id mapping is easy when task names are unique, but harder when repeated labels exist. The current implementation uses a practical best-effort mapping, which is acceptable for a portfolio build but a known future improvement area.

### Tradeoff: selective refactor instead of full rewrite

The codebase originally concentrated a lot of logic in `designer.js`. Instead of a high-risk rewrite, BA-specific logic was extracted into `ba-tools.js` first. This improves structure while preserving delivery speed and keeping regression risk low.

## What Was Added in the BA-Oriented Upgrade

- real business scenario tests
- BA review warnings in Step 2
- BPMN quality checklist in Step 2 and Analyze modal
- traceability fields in the review table
- BA brief export
- catalog compare for AS-IS / TO-BE style review
- landing-page explanation of why the tool exists
- README oriented around product value, not only implementation

## Why This Matters For a Portfolio

This project demonstrates more than frontend polish or XML generation. It shows:

- product thinking
- BA workflow understanding
- BPMN modeling awareness
- traceability mindset
- pragmatic use of AI with human review
- ability to turn a demo into a more credible internal tool concept

## Next Logical Iterations

- side-by-side compare between any two saved catalog processes
- stronger support for rework loops and advanced BPMN patterns
- richer report export templates
- direct capture of assumptions, rules, and open questions during review
