# Noshiro - Input Orchestration

Noshiro centralizes interactive input for TakaoEngine. It exposes a small API for prompting users (yes/no, free text) and managing raw key handlers for TTY flows.

## Usage

```ts
import { InputManager } from '@atsu/noshiro';

const input = new InputManager();
const shouldCreate = await input.promptYesNo('Generate a map?', {
  defaultValue: false,
});

if (shouldCreate) {
  // create map
}
```

### Key handling

```ts
const input = new InputManager();

const attached = input.enableRawMode(key => {
  if (key === '\u001b') stop();
  if (key === '\r') nextTurn();
});

// Later
input.disableRawMode();
```

## Scripts

- `npm run build` to produce CJS/ESM bundles in `dist/`.
- `npm run lint` to check code style.
- `npm test` to run package tests (Vitest).
