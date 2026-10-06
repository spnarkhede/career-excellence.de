# Components

One entry per auth-related component (page, function, endpoint, hook, middleware,
database object, edge function, etc.), per [AUTH_RULES.md](../../AUTH_RULES.md).
Every component must answer all 8 questions below. Add or update an entry whenever a
component is created or changed in any phase.

## Template

Copy this block for each component.

```
### <Component name> (<file path>)

1. **What it does:**
2. **What calls it:**
3. **What it calls:**
4. **What data it receives:**
5. **What data it returns:**
6. **What happens when it fails:**
7. **Whether it is secure:**
8. **Whether it can create inconsistent state:**
```

## Component inventory

No components recorded yet. This phase wrote no application code; components will be
added starting in Phase 1 (authentication map) as each is inventoried, and in later
phases as each is created or changed.
