# dsh-memory-core

Portable, read-only-first primitives for layered DSH memory:

- slash-delimited Topic routing;
- private-path suppression;
- index target and trigger validation;
- Topic metadata checks;
- deterministic Node.js regression tests.

This repository contains no user memory, credentials, deployment paths, or DSH production configuration. It does not install schedules or write memory by default.

## Usage

```bash
npm test
npm run check
node ./bin/dsh-memory.mjs route "custom topic" --home ./fixtures/sample-home
node ./bin/dsh-memory.mjs audit --home ./fixtures/sample-home --strict
```

Set `DSH_MEMORY_HOME` instead of `--home` when integrating with a DSH deployment. A host integration should pass the exact workspace path explicitly; do not infer it from the current directory.

## Scope

The core package owns parsing, routing, validation, and tests. Skill instructions, Provider adapters, and external GitHub writes are separate packages.
