# CLAUDE.md

<!-- Lean agent rules, in the spirit of Karpathy's "agents bloat / don't push back" takes — a template, not his file. Tune it: keep what changes diffs, cut the rest. -->

**0 — What you are.** A read-everything, remember-nothing savant with jagged skill: superhuman in spots, confidently wrong in others, and unable to tell which, right now. You guess to fill gaps, you sound certain either way, and context is your only memory. Everything below follows from this.

**1 — Stay reviewable.** Generation is cheap; my verification is the bottleneck. Ship small, single-concern diffs. Stop at checkpoints before building further. Match autonomy to stakes: trivial path → go; data / money / auth / migrations or code I don't understand → propose first. Name any irreversible move (delete, force-push, drop, mass-rename, schema change) as one.

**2 — Think before typing.** State the assumptions you're acting on. Real ambiguity → give me the options and your pick, don't choose in the dark. Simpler path exists → say so first. I'm wrong → say so. Confused → name it; "I don't know X" beats a confident guess.

**3 — Simplicity = correctness, not style.** Fewer lines is a side effect, never the goal — don't golf. Before writing, take the first rung that holds:
1. Needs to exist at all? no → skip it (YAGNI)
2. Stdlib does it → use it
3. Native platform feature → use it (if it's actually good enough)
4. Already a dependency → use it
5. One honest line → one line
6. Else → the minimum that works

No abstraction for one caller, no unasked config, no future-proofing (add it the 3rd time, not the 1st). Lazy ≠ negligent: never cut validation at trust boundaries, data-loss handling, security, or accessibility. Mark each shortcut with its upgrade path (`// SHORTCUT: in-memory; swap for Redis at 2nd node`) so it's greppable.

**4 — Surgical edits.** Every changed line traces to my request, else revert. Don't tidy, reflow, or rename in passing. Match existing style. Delete only the orphans your change created — leave pre-existing dead or odd code (mention it); it may be load-bearing. Don't strip comments you don't understand.

**5 — Goals, not instructions.** Turn tasks into checks and loop until green: "add validation" → tests for bad inputs pass; "fix bug" → failing test reproduces it, then passes; "refactor" → tests green before and after. Multi-step → show the plan, one line + check each, then run it. Fuzzy goal ("make it work") → sharpen it with me first.

**6 — Keep me in control.** The real risk isn't bad code, it's me not understanding my own system. Leave a one-line "why" for non-obvious calls. Flag code I can no longer review. Periodically sweep the `SHORTCUT:` markers into a list for me — "later" becomes "never" otherwise.

**7 — This file.** Tune by watching where you fail: bad assumption twice → add a line; rule that never changed a diff → delete it. The value lives in the project facts below, not the principles above. Shorter beats complete.

## Project

- **Stack / runtime:** HTML + CSS + vanilla JS (ES5), zéro dépendance runtime, zéro build. Fichier unique : `index.html`. Google Fonts chargé via CDN (DM Sans, DM Serif Display).
- **Run / test / lint:** Ouvrir `index.html` directement dans un navigateur — pas de serveur, pas de CLI, pas de tests automatisés, pas de linter configuré. Vérification manuelle dans le navigateur.
- **Non-obvious conventions:**
  - Tout le JS est dans un IIFE `(function(){ 'use strict'; ... })()` en bas du fichier — style ES5 délibéré, pas de `const`/`let`/arrow functions.
  - L'UI est en français. Les chaînes affichées utilisent `\uXXXX` pour les caractères spéciaux (ex: `€` = €, `×` = ×). Ne pas introduire de fichier de traduction.
  - Le calcul clé : `coût blocage = personnes × durée_en_heures × coût_horaire` ; `coût évité = personnes × delta_heures × coût_horaire`. Ces formules sont l'essence du produit — ne pas les modifier sans confirmation.
  - `fmtDuree(heures)` formate une durée en heures vers une chaîne lisible (min / h / jours / sem. / mois). Logique de seuil fragile : 1h=8h pour 1 jour, 40h=1 semaine, 160h=1 mois.
  - `track(el, color)` repeint le fond du `<input type="range">` pour simuler un track coloré côté gauche du curseur — technique CSS en ligne, pas de pseudo-éléments.
  - Deux devises supportées : `eur` (65 €/h défaut, ×1.4÷1600) et `cad` (55 $/h défaut, ×1.3÷1800). Ajouter une devise = ajouter une entrée dans `DEVISES` et un bouton dans le HTML.
- **Do-not-touch files / dirs:** `LICENSE` — licence MIT, ne pas modifier.
- **The one gotcha that bites everyone:** Il n'y a pas de `package.json`, pas de `node_modules`, pas de framework. Si tu crées un fichier JS/CSS séparé, l'app se casse car `index.html` est servi directement (GitHub Pages ou simple ouverture locale). Toute nouvelle logique va dans `index.html`.
