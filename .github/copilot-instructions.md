# Project Guidelines

## Architecture
- This workspace has two main projects:
- `svc/`: Egg.js backend that serves and executes configurable API-transformation flows.
- `ui/`: React + Webpack admin UI for editing invoke configurations.
- Runtime flow: UI/config data -> MySQL `invoke_info` -> Redis cache (`invokeEntitys`/`invokeEntityKeyMap`) -> `/invoke/*` routes in backend.
- Key backend entry points:
- Routing: `svc/app/router.js`
- Core invoke logic: `svc/app/service/restful.js`
- API controllers (including stream mode): `svc/app/controller/restful.js`
- Middleware interception for invoke routes: `svc/app/middleware/restful.js`

## Build And Test
- Backend setup/run (from `svc/`):
- `npm i`
- `npm run dev` for local development
- `npm start` for production-style start
- `npm run lint`
- `npm run test-local` or `npm test`
- Frontend setup/run (from `ui/`):
- `npm i`
- `npm start` (webpack dev server)
- `npm run build`
- To serve UI from backend static assets, copy build output to backend public dir:
- `cp -r ui/build/* svc/app/public/`

## Conventions
- Placeholder convention: request templates use `@xxx` tokens in URL/head/body and are resolved at runtime.
- `@baseUrl` is reserved and maps from `config.systemInfo` in `svc/config/config.default.js`.
- `Callable API` can fan out to multiple linked `API Configuration` entries; `activeMethod` controls targeted execution.
- Preserve stream route compatibility when changing endpoints:
- `/stream/:invokeName/:activeMethod`
- `/stream/:invokeName/:activeMethod/v1/chat/completions`
- `/stream/:invokeName/:activeMethod/v1/messages`
- Prefer changing invocation/parsing behavior inside `svc/app/service/restful.js` rather than scattering logic across controllers.

## Environment And Safety
- Required services: Node.js, MySQL, Redis.
- Before first run, initialize schema using `svc/initial.sql`.
- Local defaults in `svc/config/config.default.js` include hardcoded DB/Redis credentials and permissive CORS/CSRF; treat as development defaults and avoid propagating to production.
- This project intentionally executes stored parse functions dynamically; review changes in parsing/execution paths carefully because behavior is data-driven.

## Docs Map
- Product usage and examples: `README.md` (English), `README_C.md` (Chinese)
- LLM gateway compatibility details: `svc/AI_GATEWAY_LANGCHAIN_COMPAT.md`
- SQL bootstrap and sample data: `svc/initial.sql`, `svc/example.sql`
- Frontend bundling behavior: `ui/webpack.*.js`

## Agent Working Notes
- Keep edits focused and avoid touching generated/runtime artifacts unless explicitly requested:
- `svc/logs/`
- `svc/run/`
- When changing backend API behavior, validate with at least one local backend command (`npm run dev` or relevant tests) when feasible.
