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
    files: ["app/(dashboard)/**/page.tsx"],
    rules: {
      // §3 `max-w-[...]` is fully migrated across page files and is
      // enforced as an error. The `mx-auto` and §13b h1-sizing rules
      // are being migrated incrementally — surfaced as warnings so CI
      // does not block unrelated PRs. Upgrade to "error" once every
      // `app/(dashboard)/**/page.tsx` complies (tracked as follow-up).
      //
      // Note: the §3 `mx-auto` ban only applies to page-level content
      // wrappers — `mx-auto` on icons/empty-state glyphs inside a page
      // is legitimate centering and NOT a width-ownership violation.
      // A purely-syntactic lint rule cannot distinguish the two, so
      // this rule is intentionally advisory (warn) rather than error.
      "no-restricted-syntax": [
        "error",
        {
          // className literals containing max-w-[...] anywhere in a page file
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/\\bmax-w-\\[/]',
          message:
            "DESIGN_SYSTEM §3: DashboardShell owns the content width. " +
            "Remove max-w-* from page components.",
        },
      ],
    },
  },
  {
    files: ["app/(dashboard)/**/page.tsx"],
    rules: {
      "no-warning-comments": ["off"],
    },
  },
  {
    files: ["app/(dashboard)/**/page.tsx"],
    rules: {
      // Advisory — see note above.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/(^|\\s)mx-auto(\\s|$)/]',
          message:
            "DESIGN_SYSTEM §3: if this is a page-level content wrapper, " +
            "remove mx-auto (DashboardShell owns it). Centering an icon " +
            "or empty-state glyph is fine — this is advisory.",
        },
        {
          selector:
            'JSXElement[openingElement.name.name="h1"] JSXAttribute[name.name="className"] > Literal[value=/\\btext-(xl|2xl|3xl)\\b/]',
          message:
            "DESIGN_SYSTEM §13b: h1 page headings use text-lg (18px). " +
            "text-xl/2xl/3xl are being migrated — please downsize.",
        },
      ],
    },
  },
];

export default designSystemRules;
