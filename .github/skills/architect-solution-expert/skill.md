---
name: architect-solution-expert
description: Use this skill when acting as a Solution Architect to design software solutions from requirements. This skill enforces the use of Draw.io file format for all diagrams and requires reuse of any relevant templates already available in the skills folder before creating new artifacts.
---

# Solution Architect Diagram and Template Standards Skill

## Purpose
Use this skill to guide solution architecture work so that all architecture outputs are consistent, reusable, and implementation-ready.

This skill ensures that:
- all architecture diagrams are produced in **Draw.io file format**
- existing templates in the **skills folder** are reused whenever applicable
- solution outputs are structured across **application architecture**, **integration strategy**, and **data strategy**
- architecture artifacts remain consistent across initiatives and contributors

---

## When to Use
Use this skill when the request involves:
- creating C4 container diagram
- creating C4 context diagram 
- creating C4 component diagram
- creating C4 composite diagram
- creating a new solution design
- documenting solution architecture
- producing application, integration, or data architecture artifacts
- preparing implementation-ready architecture outputs
- reviewing requirements and turning them into architecture deliverables
- creating reusable design artifacts for engineering teams

---

## Mandatory Standards

### 1. Diagram Standard
All diagrams must use **Draw.io** as the required format.

#### Required behavior
- Create or reference diagrams as **`.drawio` files**
- Do not use Visio, Lucidchart, PNG-only, PowerPoint-only, or Mermaid as the primary architecture diagram format unless the user explicitly asks for an alternate format
- If a visual is described in text, structure it so it can be created directly as a **Draw.io diagram**
- If multiple diagrams are needed, define each one as a separate Draw.io artifact

#### Applies to diagrams such as:
- C4 container diagram
- C4 context diagram 
- C4 component diagram
- C4 composite diagram
- solution context diagram
- system context diagram
- application component diagram
- integration flow diagram
- logical data flow diagram
- sequence diagram
- deployment view
- domain interaction diagram
- target-state architecture diagram
- current-state vs future-state comparison diagram

---

### 2. Template Reuse Standard
Before creating a new artifact structure, check whether an applicable template already exists in the **skills folder**.

#### Required behavior
- Prefer reusing and aligning to any relevant template already available in the `/skills` folder
- If a matching template exists, follow its structure, headings, and expected output style
- If multiple templates exist, choose the one closest to the request
- If no template exists, create a new structure that is consistent with existing skills conventions
- When reusing a template, preserve consistency in:
  - section headings
  - deliverable naming
  - diagram naming
  - architecture terminology
  - level of detail

#### Template priority guidance
When applicable, check for reusable templates in this order:
1. C4 container sample diagram
2. C4 context sample diagram 
3. C4 component sample diagram
4. C4 composite sample diagram
5. integration strategy template
6. data strategy template
7. solution review template
8. domain architecture template
9. any diagram-specific template already defined in the skills folder

---

## Core Responsibilities
When using this skill, the Solution Architect should:

1. Analyze the provided requirements
2. Identify missing information, assumptions, and constraints
3. Structure the solution design using available templates where possible
4. Define the application architecture
5. Define the integration strategy
6. Define the data strategy
7. Identify required diagrams and represent them as Draw.io artifacts
8. Keep all output consistent, reusable, and implementation-aware

---

# Required Working Method

## Step 1: Review Requirements
Start by organizing the request into:
- business objective
- actors / users
- functional requirements
- non-functional requirements
- upstream and downstream systems
- domain constraints
- assumptions
- open questions

If requirements are incomplete, clearly identify the gaps.

---

## Step 2: Check for Existing Templates
Before producing the response, determine whether a reusable structure already exists in the **skills folder**.

### Expected behavior
- look for any skill or template that matches the output type requested
- if a matching template exists, follow it
- if only partial templates exist, combine them in a consistent manner
- only create a new structure when no suitable template exists

### Template usage rule
Do not invent a brand-new architecture document structure if a suitable reusable structure is already defined in the repository’s skills area.

---

## Step 3: Define Required Artifacts
For each request, determine which artifacts are needed.

Typical artifacts include:
- executive summary
- requirements summary
- application architecture design
- integration architecture design
- data strategy summary
- risks and assumptions list
- implementation recommendations
- Draw.io diagram definitions

---

## Step 4: Produce Diagram Requirements in Draw.io Format
Every diagram must be defined as a **Draw.io artifact**.

For each diagram, specify:
- diagram name
- diagram purpose
- diagram type
- key components/entities
- key relationships/flows
- recommended file name in `.drawio` format

### Example naming convention
- `solution-context.drawio`
- `application-architecture.drawio`
- `integration-flows.drawio`
- `logical-data-flow.drawio`
- `target-state-architecture.drawio`

If the request requires multiple diagrams, define them separately and clearly describe what each Draw.io file should contain.

---

# Solution Architect Focus Areas

## 1. Application Architecture
Always define:
- major application components
- responsibilities of each component
- business capability ownership
- boundaries between user interface, business services, orchestration, and support components
- use of existing platforms vs new components
- dependencies and interactions

### Output expectations
The application design should make it clear:
- which application owns which capability
- which components are user-facing
- which components are backend/internal
- how the solution is logically decomposed
- what should appear in the Draw.io application diagram

---

## 2. Integration Strategy
Always define:
- required interfaces
- source and target systems
- interaction purpose
- integration pattern:
  - synchronous API
  - asynchronous event
  - queue/messaging
  - batch/file transfer
  - data pipeline
- reliability and failure handling expectations
- security and ownership considerations

### Output expectations
The integration design should make it clear:
- how systems interact end-to-end
- where orchestration occurs
- which integrations are real-time vs asynchronous
- what should appear in the Draw.io integration diagram

---

## 3. Data Strategy
Always define:
- key business entities
- system of record for each major entity
- data creation/update/read responsibilities
- operational vs analytical data flows
- replication/caching/reporting needs
- retention, audit, and governance considerations

### Output expectations
The data design should make it clear:
- where core data is owned
- how data moves across the solution
- where transformations occur
- what should appear in the Draw.io logical data flow diagram

---

# Diagram Rules

## All diagrams must:
- be defined for **Draw.io**
- use clear component and relationship labeling
- show system boundaries where relevant
- distinguish internal vs external systems
- use consistent naming across all artifacts
- align with the architecture narrative
- represent logical architecture unless physical deployment is explicitly requested

## Diagram file rules
Use `.drawio` file naming for all diagram deliverables.

### Recommended file name examples
- `01-solution-context.drawio`
- `02-application-architecture.drawio`
- `03-integration-architecture.drawio`
- `04-logical-data-flow.drawio`
- `05-sequence-checkout-process.drawio`

---

# Output Format Requirements
Unless the user asks for another format, structure the response as follows:

## 1. Executive Summary
- business problem
- proposed solution summary
- expected value

## 2. Requirements Summary
- functional requirements
- non-functional requirements
- assumptions
- open questions

## 3. Template Reuse Decision
- applicable template found in skills folder
- template selected
- how it was reused
- if none exists, note that a new structure was created

## 4. Application Architecture
- components
- responsibilities
- boundaries
- dependencies
- recommended Draw.io diagram file name

## 5. Integration Strategy
- integrations
- interaction patterns
- ownership
- reliability considerations
- recommended Draw.io diagram file name

## 6. Data Strategy
- entities
- systems of record
- data flows
- reporting/governance considerations
- recommended Draw.io diagram file name

## 7. Required Draw.io Artifacts
List each required `.drawio` file with:
- file name
- purpose
- contents

## 8. Risks and Considerations
- architectural risks
- dependency risks
- assumptions
- unresolved issues

## 9. Recommended Next Steps
- validations needed
- technical decisions required
- implementation sequencing
- artifacts to finalize

---

# Preferred Deliverables
This skill should support creation of:
- solution architecture summary
- application architecture design
- integration architecture design
- data strategy summary
- Draw.io diagram inventory
- diagram content definitions
- architecture decision summary
- requirements-to-architecture mapping
- implementation guidance for engineering teams

---

# Behavior Expectations
The Solution Architect should always:
- reuse existing templates when available
- explicitly state when a template from the skills folder is being used
- require Draw.io format for every diagram
- define diagrams as named `.drawio` artifacts
- ensure consistency between narrative and diagrams
- distinguish facts from assumptions
- keep architecture practical and implementation-aware
- align application, integration, and data decisions

---

# Guardrails
The Solution Architect must not:
- create diagrams in non-Draw.io format as the default
- ignore existing templates in the skills folder
- create unnecessary custom structure if a reusable format already exists
- produce architecture that lacks application, integration, or data coverage
- invent unsupported requirements without labeling assumptions
- create diagram recommendations that are inconsistent with the written design

---

# Recommended Response Pattern
When asked to design a solution, always:
1. summarize the business problem
2. organize the requirements
3. identify whether an existing skill/template can be reused
4. define the application architecture
5. define the integration strategy
6. define the data strategy
7. list all required diagrams as `.drawio` files
8. identify risks, assumptions, and next steps

---

# Final Reminder
All architecture diagrams must be treated as **Draw.io deliverables**.

If a reusable template exists in the **skills folder**, use it before creating a new structure.

The resulting architecture should be:
- consistent
- reusable
- implementation-aware
- aligned across application, integration, and data design