/**
 * Design-system enforcement rules — DESIGN_SYSTEM.md §3, §13b.
 *
 * Wire into the root ESLint config via:
 *   const dsRules = require('./eslint.rules.design-system');
 *   module.exports = { ..., overrides: [...dsRules.overrides] };
 *
 * Scope is intentionally narrow (dashboard page files) so these rules
 * document policy without creating noise in shared components.
 */
module.exports = {
  overrides: [
    {
      // §3 Content Width Ownership — DashboardShell owns `max-w-[1320px] mx-auto`.
      // Page components must not duplicate it.
      // §13b Page Heading Rule — h1 uses `text-lg` (18px), never text-xl/2xl/3xl.
      files: ['app/(dashboard)/**/page.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            // className literals containing max-w-[...] anywhere in a page file
            selector:
              'JSXAttribute[name.name="className"] > Literal[value=/\\bmax-w-\\[/]',
            message:
              'DESIGN_SYSTEM §3: DashboardShell owns the content width. ' +
              'Remove max-w-* from page components.',
          },
          {
            // mx-auto on a page-level wrapper (same rule)
            selector:
              'JSXAttribute[name.name="className"] > Literal[value=/(^|\\s)mx-auto(\\s|$)/]',
            message:
              'DESIGN_SYSTEM §3: DashboardShell owns mx-auto. ' +
              'Remove from page components.',
          },
          {
            // <h1 className="... text-xl ..."> / text-2xl / text-3xl
            selector:
              'JSXElement[openingElement.name.name="h1"] JSXAttribute[name.name="className"] > Literal[value=/\\btext-(xl|2xl|3xl)\\b/]',
            message:
              'DESIGN_SYSTEM §13b: h1 page headings use text-lg (18px). ' +
              'text-xl/2xl/3xl are forbidden on h1.',
          },
        ],
      },
    },
  ],
};
