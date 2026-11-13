# Forgix Website

Private static Astro workspace. Install once from the repository root using Bun 1.4.4.
Website commands require Node 26; plugin and existing CI commands remain on Node 24.

```sh
bun install --frozen-lockfile
bun run site:dev
bun run site:build
```

The shared Bun isolated linker is required: the website's Astro checker resolves
TypeScript 6, while repository and plugin tooling retain TypeScript 7. Neither the root
nor the plugin compiler is downgraded.

This workspace is not part of the plugin's npm distribution. No production deployment
is configured or authorized by its local build commands.
