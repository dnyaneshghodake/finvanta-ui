/**
 * Design-system enforcement rules — DESIGN_SYSTEM.md §3, §13b.
 *
 * Flat-config entry. Spread into eslint.config.mjs:
 *   import designSystemRules from "./eslint.rules.design-system.js";
 *   export default defineConfig([..., ...designSystemRules]);
 *
 * Scope is intentionally narrow (dashboard page files) so these rules
 * document policy without creating noise in shared components.
 */
const designSystemRules = [
  {
    // §3 Content Width Ownership — DashboardShell owns `max-w-[1320px] mx-auto`.
    // Page components must not duplicate it.
    // §13b Page Heading Rule — h1 uses `text-lg` (18px), never text-xl/2xl/3xl.
    //
    // All three selectors live in a SINGLE `no-restricted-syntax` rule
    // entry. ESLint flat config does not merge rule arrays across config
    // objects that match the same `files` glob — the last one wins and
    // silently replaces earlier definitions. Keeping them together is
    // the only way to enforce all three simultaneously.
    //
    // Note: the §3 `mx-auto` ban catches page-level content wrappers,
    // but `mx-auto` is also legitimate for centering icons / empty-state
    // glyphs inside a page. A purely-syntactic lint rule cannot
    // distinguish the two — the handful of legitimate cases are
    // suppressed inline with `// eslint-disable-next-line`.
    files: ["app/(dashboard)/**/page.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // §3 — className literals containing max-w-[...] in a page file.
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/\\bmax-w-\\[/]',
          message:
            "DESIGN_SYSTEM §3: DashboardShell owns the content width. " +
            "Remove max-w-* from page components.",
        },
        {
          // §3 — className literals containing mx-auto in a page file.
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(^|\\s)mx-auto(\\s|$)/]',
          message:
            "DESIGN_SYSTEM §3: DashboardShell owns mx-auto on page-level " +
            "wrappers. If this is legitimate icon / empty-state centering, " +
            "suppress with `// eslint-disable-next-line no-restricted-syntax`.",
        },
        {
          // §13b — <h1 className="... text-xl | text-2xl | text-3xl ...">
          selector:
            'JSXElement[openingElement.name.name="h1"] JSXAttribute[name.name="className"] > Literal[value=/\\btext-(xl|2xl|3xl)\\b/]',
          message:
            "DESIGN_SYSTEM §13b: h1 page headings use text-lg (18px). " +
            "text-xl/2xl/3xl are forbidden on h1.",
        },
      ],
    },
  },
];

export default designSystemRules;
