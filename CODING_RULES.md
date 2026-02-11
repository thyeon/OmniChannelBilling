# CODING_RULES.md

This document defines mandatory coding standards.
All generated and modified code MUST follow these rules.

If a task conflicts with these rules, STOP and ask.

---

## 1. GENERAL PRINCIPLES

- Code must be readable before it is clever
- Prefer explicit naming over abbreviations
- Optimize for maintainability over brevity
- Avoid unnecessary abstractions

---

## 2. NAMING CONVENTIONS

- Variables: descriptive, lowerCamelCase
- Functions: verb-based, intention-revealing
- Classes / Types: PascalCase
- Files: kebab-case or camelCase (be consistent)

Bad:
- `calc()`
- `data1`

Good:
- `calculateRiskScore()`
- `historicalPriceSeries`

---

## 3. FUNCTION & MODULE DESIGN

- Functions should do ONE thing
- Avoid functions longer than ~30 lines
- Prefer pure functions where possible
- Avoid deep nesting (max 2–3 levels)

Rules:
- No hidden side effects
- No mutation of inputs unless explicitly documented

---

## 4. LANGUAGE-SPECIFIC RULES (Example: TypeScript)

- `strict` mode assumed
- No `any`
- Prefer interfaces/types for data contracts
- Explicit return types for public functions

If another language is used, apply equivalent strictness.

---

## 5. ERROR HANDLING

- Handle errors explicitly
- Do not swallow errors
- Prefer typed / structured errors

Rules:
- Domain errors must be meaningful
- Infrastructure errors must not leak into Domain layer

---

## 6. COMMENTS & DOCUMENTATION

- Comment WHY, not WHAT
- Avoid redundant comments
- Public functions must have short doc comments

Bad:

// add 1 to x
x = x + 1

Good : 

// Risk score is increased to reflect volatility premium


## 7. TESTING RULES
	•	Business logic must be unit-testable
	•	Tests must be deterministic
	•	No reliance on external systems in unit tests
Rules:
	•	Test behavior, not implementation
	•	Avoid snapshot tests for business logic

## 8. AI-SPECIFIC RULES
When generating code:
	•	Do NOT reformat unrelated files
	•	Do NOT apply stylistic changes unless requested
	•	Do NOT refactor existing logic unless explicitly instructed
If unsure about style or patterns, ASK.

## END OF CODING RULES