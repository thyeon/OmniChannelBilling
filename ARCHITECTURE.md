# ARCHITECTURE.md

This document defines the system architecture and non-negotiable boundaries.
All AI-generated and human-written code MUST follow this document.

If a task conflicts with this architecture, STOP and escalate.

---

## 1. ARCHITECTURAL GOALS

The system is designed to:

- Be modular and maintainable
- Support incremental development
- Minimize coupling between components
- Allow AI-assisted development without architectural degradation

Non-goals:
- Premature optimization
- Over-engineering
- Unnecessary abstraction layers

---

## 2. HIGH-LEVEL SYSTEM OVERVIEW

The system follows a **layered architecture** with clear separation of concerns.

[ UI / Client ]
|
[ API / Application Layer ]
|
[ Domain / Business Logic ]
|
[ Infrastructure / External Services ]


Each layer has strict responsibilities and boundaries.

---

## 3. LAYER RESPONSIBILITIES

### 3.1 UI / Client Layer

Responsibilities:
- User interaction
- Input validation (basic only)
- Rendering and state management

Rules:
- MUST NOT contain business logic
- MUST NOT access databases or external services directly
- MUST communicate only via API layer

---

### 3.2 API / Application Layer

Responsibilities:
- Request handling
- Orchestration of use cases
- Input/output transformation
- Authorization (if applicable)

Rules:
- MUST be thin
- MUST delegate all business rules to Domain layer
- MUST NOT contain core calculations or decision logic

---

### 3.3 Domain / Business Logic Layer

Responsibilities:
- Core business rules
- Calculations, scoring, decision making
- Validation of business invariants

Rules:
- MUST be framework-agnostic
- MUST be deterministic and testable
- MUST NOT depend on UI, HTTP, or database libraries

This layer is the **most important and most protected**.

---

### 3.4 Infrastructure Layer

Responsibilities:
- Database access
- External APIs
- File systems
- Messaging systems

Rules:
- MUST implement interfaces defined by Domain/Application layers
- MUST NOT leak infrastructure details upward
- MUST be replaceable without changing business logic

---

## 4. MODULE STRUCTURE (RECOMMENDED)

Example folder structure:
src/
ui/
api/
domain/
models/
services/
rules/
infrastructure/
db/
external/

Rules:
- Cross-layer imports are NOT allowed
- Dependencies flow downward only

---

## 5. DEPENDENCY RULES

Allowed dependencies:

- UI → API
- API → Domain
- Domain → (no outward dependencies)
- Infrastructure → Domain interfaces

Disallowed dependencies:

- Domain → API / UI / Infrastructure
- UI → Domain (directly)
- API → Infrastructure (directly, unless via interfaces)

Violations must be rejected.

---

## 6. STATE & DATA FLOW

- State flows **downward**
- Data mutations occur only in:
  - Domain layer
  - Infrastructure implementations

Rules:
- Domain logic must be pure where possible
- Side effects must be isolated

---

## 7. ERROR HANDLING STRATEGY

- Domain layer returns explicit error types or results
- API layer translates errors to HTTP / transport responses
- UI layer handles presentation of errors only

Rules:
- No silent failures
- No generic catch-all error handling in Domain layer

---

## 8. TESTING STRATEGY (ARCHITECTURAL VIEW)

- Domain layer: unit tests (fast, deterministic)
- API layer: integration tests
- Infrastructure layer: contract tests / mocks

Rules:
- Business rules MUST be testable without infrastructure
- Tests must not depend on UI

---

## 9. CHANGE RULES

Allowed changes:
- Adding new domain services
- Extending existing rules without breaking contracts

Restricted changes:
- Changing layer responsibilities
- Introducing new architectural patterns

Breaking changes require explicit approval.

---

## 10. AI-SPECIFIC RULES (IMPORTANT)

When generating code:

- Respect layer boundaries strictly
- Prefer adding code over modifying existing behavior
- Ask before introducing new abstractions
- Do NOT refactor architecture unless explicitly instructed

If unsure where code belongs, ASK.

## 11. Tech Stacks 

- FrontendTech Stack:  Next.js 14+, React 18+, TypeScript, Tailwind CSS 3.4+, shadcn/ui
- State Management: Zustand, React Query
- Presistent Layer Tech Stack : MongoDB
- Backend Tech Stack : Node.js 18+
---

## END OF ARCHITECTURE