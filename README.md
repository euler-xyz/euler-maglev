# Maglev: Special Purpose Minimal UI for Euler Vaults

Maglev is a minimal and experimental interface for managing EulerSwap instances, and a few other small dedicated tasks in the Euler ecosystem. It depends on an `MaglevLens` contract found in [euler-devland](https://github.com/euler-xyz/euler-devland).

## Setup

Install dependencies:

    pnpm install

Initialize the git submodule:

    git submodule update --init

Start the dev server:

    pnpm run dev

## Dev mode

By default, `pnpm run dev` attempts to load local chain configs and mock data from the [euler-devland](https://github.com/euler-xyz/euler-devland) repo. It expects it as a sibling directory:

    ../euler-devland/dev-ctx/

If `euler-devland` is not present, the app will fall back gracefully with a console warning.

To explicitly skip devland imports (even if the directory exists):

    pnpm run dev:no-devland

### Devland setup

Checkout the `euler-devland` repo side-by-side with this repo and run its `install.sh` script.

## Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start dev server (loads devland if available) |
| `pnpm run dev:no-devland` | Start dev server skipping devland imports |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview production build locally |
| `pnpm run lint` | Run ESLint |

## License

Copyright 2025 Euler Labs. GPL licensed.
