# Knowledge Folder

This folder is the staging area for coach-authored knowledge that can later be fed into workout generation and review flows.

What belongs here:
- programming principles
- movement coaching notes
- regression and progression rules
- contraindications and red flags
- energy-system prescriptions
- return-to-play constraints
- client-facing coaching language and style guidance

What does not happen automatically yet:
- The current deterministic workout draft builder does not automatically read every file in this folder.
- To make this knowledge influence generation, we need a retrieval or loader layer that selects only the relevant knowledge for the current client, goal, session, and structure template.

Recommended structure:
- `knowledge/principles/`
  - global programming heuristics and rules
- `knowledge/movements/`
  - movement-specific standards, regressions, progressions, substitutions
- `knowledge/clients/`
  - optional client archetype or special-case notes templates, not raw PHI dumps
- `knowledge/templates/`
  - starter formats to copy when adding new knowledge

Recommended authoring rules:
- Keep entries short and practical.
- Prefer explicit decision rules over long essays.
- Write in coach language, but structure it so code can retrieve and reason over it.
- Avoid dumping whole books or copyrighted source material verbatim.
- Instead, write your own distilled principles, checklists, and applied rules.

Best next implementation path:
1. Add your knowledge here using the templates.
2. Build a server-side retrieval layer that selects the right files for the current client and workout context.
3. Pass only those selected snippets into workout generation.
4. Keep hard constraints deterministic and use retrieved knowledge to shape recommendations.