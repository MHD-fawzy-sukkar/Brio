# Development

Run commands from the repository root unless stated otherwise. Requires Node.js 24.11 or newer and pnpm.

## First-time setup

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Copy the templates only if the destination files do not already exist, then fill in your local values:

| File                    | Values                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| `apps/web/.env.local`   | Public `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                                 |
| `apps/worker/.dev.vars` | `GOOGLE_CLIENT_ID` and the Cloudinary settings listed in the template |

Both runtime files are ignored by Git. Provider secrets belong only on the server. Keep `DEV_AUTH_BYPASS` and `DEV_MEDIA_BYPASS` false outside isolated local tests.

## Run the cloud application locally

```powershell
pnpm build
pnpm db:migrate:local
pnpm --filter @brio/worker dev
```

Open the Wrangler URL printed in the terminal. It serves the built frontend and API from one origin, which is the useful path for testing cookies, authentication and WebSocket upgrades. Rebuild the frontend after editing it.

`pnpm dev` starts Next.js and Worker concurrently for development; it does not replace testing the complete application through the same-origin Worker.

## Run LAN from source

```powershell
pnpm lan:build
pnpm lan:start
```

Open `http://localhost:3210/local/`. After preparation, `Start-LAN.cmd` can also start the server and open the dashboard. Rebuild and restart after source changes. LAN play does not need Google or Cloudinary secrets. See [Operations](operations.md) for importing a quiz and connecting phones.

## Useful commands

| Command                        | Purpose                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm quality`                 | Architecture and formatting checks, shared-package builds, application type checks, all tests, cloud web build and projection benchmark |
| `pnpm typecheck` / `pnpm test` | Run workspace type checks or tests separately                                                                                           |
| `pnpm architecture`            | Check source-size budgets, dependency boundaries and import cycles                                                                      |
| `pnpm format`                  | Format source files                                                                                                                     |
| `pnpm lan:build`               | Build the separate LAN frontend and shared packages                                                                                     |
| `pnpm lan:package`             | Package the prepared LAN runtime for Windows                                                                                            |
| `pnpm lan:desktop`             | Package LAN and build the Windows presenter installer                                                                                   |
| `pnpm performance`             | Compare current snapshot projection with the historical fixture                                                                         |

Desktop packaging requires Windows x64, the .NET Framework compiler and the Node 24.11.1 runtime used by the packaging script. Cloud output is `apps/web/out`; LAN output is `apps/web/out-lan`. Run builds sequentially.

## Verification

Tests live beside source in `*.test.ts` files and run through `tsx` with Node's test runner. LAN integration tests bind local HTTP/WebSocket ports. Source budgets are 300 lines for production files and 400 for tests.

The [performance report](performance/snapshot-projection.json) compares one host and 150 player snapshots, asserting equivalent output. It measures DTO preparation, excluding network and JSON transport; it is not a venue-capacity or whole-site speed measurement.

Format documentation with `pnpm exec prettier --write README.md "docs/*.md"`. Keep [Project status](status.md) current when release evidence or remaining acceptance work changes.
