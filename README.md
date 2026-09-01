# dsh-memory-core

Portable, read-only-first primitives for layered DSH memory:

- slash-delimited Topic routing;
- private-path suppression;
- index target and trigger validation;
- Topic metadata checks;
- staged global skill-evolution candidates;
- deterministic Node.js regression tests.

The evolution pipeline records sanitized candidates only. Formal Topics, Runtime Memory, and Skills require a host-side user-confirmation flow; the core package never promotes a candidate silently.

This repository contains no user memory, credentials, deployment paths, or DSH production configuration.

## Usage

```bash
npm test
npm run check
node ./bin/dsh-memory.mjs route "custom topic" --home ./fixtures/sample-home
DSH_MEMORY_HOME=/path/to/memory node ./bin/dsh-memory-evolution.mjs audit --strict
DSH_MEMORY_HOME=/path/to/memory node ./bin/dsh-memory-evolution.mjs question
```

The core package owns parsing, candidate validation, routing, and tests. Skill instructions, Provider adapters, and external GitHub writes are separate packages.
