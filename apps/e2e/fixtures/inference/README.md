# Mock inference server

An OpenAI-compatible endpoint for the e2e suite, on the host, in the
Playwright process. It answers deterministically, so a spec may assert on the
exact text it returns.

```ts
import { expect, test } from "../../fixtures/inference/fixture";

test("my area talks to the mock", async ({ api, inference }) => {
	const provider = await api.as("admin").provider.create({
		name: "Mock",
		description: "",
		endpoint: inference.url,
		compatibility: "openai",
		meteringMode: "tokens",
		apiKey: "any-key",
		enabled: true,
	});

	await api.as("admin").model.discover({
		providerId: provider.data.id,
	});

	expect(inference.requests.at(-1)?.path).toBe("/v1/models");
});
```

`test` from `fixtures/inference/fixture.ts` is `test` from `fixtures/index.ts`
plus one worker-scoped `inference` fixture, so every core fixture stays
available. Import from here only when a spec needs an endpoint that answers.

## Endpoints

| Endpoint | Behaviour |
| --- | --- |
| `GET /v1/models` | `e2e-mock-chat` and `e2e-mock-embedding`, both owned by `orcai-e2e`. |
| `POST /v1/chat/completions` | `Mock inference reply to: <last user message>`, `finish_reason: "stop"`, usage in every response. `stream: true` sends the same text as Server-Sent Events, one delta per word, then `[DONE]`; `stream_options.include_usage` adds a final usage chunk. |
| `POST /v1/embeddings` | A vector per input, single string or array. Length is the request's `dimensions`, else the `embeddingDimensions` option, else 1024. The same input always yields the same vector. |
| anything else | 404 with an OpenAI-style error body. |

The mock answers for any `model` it is asked for and echoes the name back. It
accepts any `Authorization` header, or none, unless it is started with
`requireApiKey: true`, which makes a request without `Authorization: Bearer`
a 401.

## Knobs

- `respondWith({ text })` replaces the echo for every model,
  `respondWith({ text, model })` for one.
- `failNext({ status, message?, code? })` answers the next request with that
  error, whatever the endpoint. Queue several to fail several.
- `requests` holds every request the mock saw: `method`, `path`, parsed JSON
  `body`, and the `authorization` and `contentType` headers.
- `reset()` clears requests, scripted replies, and scripted failures. Call it
  at the top of a spec: the fixture is worker-scoped, so the mock outlives a
  single test.

## The global endpoint

Only a provider entity's `endpoint` is per request. Embeddings, chat titles,
and image descriptions read `OPENAI_COMPATIBLE_BASE_URL` from the app's
environment, so pointing those at the mock means the app has to start with the
mock's URL already known. `fixtures/inference/serve.ts` is that entry: it
starts the mock on `E2E_INFERENCE_PORT` with `EMBEDDING_DIMENSIONS` and stays
up. It is the first `webServer` entry in `apps/e2e/playwright.config.ts`, so
it comes up before the app, and `scripts/stack.ts` points the app's
`OPENAI_COMPATIBLE_BASE_URL` at it for every `bun run stack e2e` run.

The global mock refuses to reuse an existing server. Worker-local mocks reset
settings and recorded requests before and after each test, including failures.
