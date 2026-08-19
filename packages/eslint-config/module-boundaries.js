// RULES.md #2: "A module may only be reached through its public service
// class or its queue handlers. Never import another module's repository,
// entity, or internal helper." This turns that convention into a lint rule.
//
// Usage, from a service's eslint.config.js:
//   const { moduleBoundaries } = require("@aca/eslint-config/module-boundaries");
//   module.exports = [...base, moduleBoundaries()];
function moduleBoundaries() {
  return {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/modules/*/*.repository",
                "**/modules/*/*.entity",
                "**/modules/*/internal/*",
              ],
              message:
                "Reach another module through its <module>.service.ts or a queue job, not its repository, entity, or internal helpers (RULES.md #2).",
            },
          ],
        },
      ],
    },
  };
}

module.exports = { moduleBoundaries };
