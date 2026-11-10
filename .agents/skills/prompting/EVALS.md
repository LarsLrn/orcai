# Prompt evals

`bun run prompt-evals` sends about 70 cases to four models through OpenRouter by default, three samples each, and prints a pass-rate table. It runs on demand for prompt changes and never in CI, because every run costs money and real models vary between runs.

## Running

The key comes from `OPENROUTER_API_KEY`, or else from `~/.config/orcai/openrouter.env`. The script never prints it.

Any OpenAI-compatible endpoint works instead: set `PROMPT_EVALS_ENDPOINT` to its base URL and `PROMPT_EVALS_API_KEY`, and pass its model ids to `--models` and `--judge`. `PROMPT_EVALS_RPM` caps the requests started per minute across all models and the judge. Rate-limited (429) and briefly unavailable (502 to 504) responses are retried with backoff. Only OpenRouter reports a cost, so other endpoints print none.

```bash title="Repository root"
bun run prompt-evals                                    # every case, default models, 3 samples
bun run prompt-evals --cases retrieval,context/knows   # cases whose id starts with "retrieval" or "context/knows"
bun run prompt-evals --models qwen/qwen3.7-flash --samples 1
bun run prompt-evals --compare apps/app/scripts/prompt-evals/results/<file>.json
```

A change to the Assistant's prompt or tool descriptions runs the Assistant suite:

```bash title="Repository root"
bun run prompt-evals --samples 6 \
  --cases assistant/,terms/assistant-,language/assistant-german,language/german-cites-docs,context/assistant-
```

Each run writes its samples, with every answer text and tool call, to `apps/app/scripts/prompt-evals/results/` (gitignored) and prints the file's path and the cost OpenRouter reported. `--compare` prints each cell as before → after against an earlier results file. The totals compare only the cases both runs hold, and the report lists the others. `--concurrency` sets the parallel requests (6 by default), and `--judge` the judge model.

A full run costs about $0.30. For a prompt PR, run on the unchanged code first, then on the change with `--compare`, and put the table in the PR body.

## Models

The defaults are `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna`, `google/gemma-4-26b-a4b-it` and `qwen/qwen3.6-35b-a3b`: one small, cheap model per vendor family, the last two open-weight models of the size a self-hosted instance runs. A run with them is a cheap smoke test of a prompt change and says nothing about other models. Before claiming that a prompt works on a model a deployment uses, run the cases on that model with `--models`. Every call goes through the `openai-compatible` provider kind, the most limited one, so a JSON-mode request carries no schema and the whole system prompt is one message.

## What a run builds

The harness in `apps/app/scripts/prompt-evals/harness.ts` runs each turn through the app's agent factories, `createChatAgent` and `createAssistantAgent`, and each background task through its call spec, which the workers and the app send too. A turn gets what it gets in the app on a model without recorded token limits: the system prompt, the tools in their order, the repair of malformed repository tool calls, the output cap, history pruning, stored tool failures and the last step without tools. Changing a factory, a prompt builder, a toolset or a call spec changes what the evals send.

- Tools keep their descriptions, schemas and model output. The harness hands the factories an execution adapter: a case scripts the output of the tools it expects, the harness supplies only `readDocs`, and every other tool loses its execution, apart from the tools in the next point. So a case scripts every other read tool it expects the Assistant to call. A call to a tool the harness cannot run ends the run there, which is how client tools and confirmations end a turn in the app. No run reaches a procedure, the database or a search provider.
- `loadTools`, `updatePlan`, `showQuizResult` and the display tools run for real, so loaded groups become callable as they do in the app. Until the user approved a plan, `updatePlan` waits for approval, which ends the run as a plan ends a turn in the app.
- `readDocs` reads the checkout's docs as the docs site serves them: `apps/web/scripts/docs-fetch.ts` compiles the pages with the site's fumadocs-mdx config and answers with the site's own index and page text. A docs change counts too.
- A request runs up to the app's step limit, 25 steps for a chat and 20 for the Assistant, and its last step offers no tools. Compaction, fitting the context window and quota are not part of it.
- `runAssistant` with `approved` runs the continuation after the user approved a plan instead: the history holds the request, the groups loaded before the plan, the reply proposing the plan, and the approval. The approved `updatePlan` call runs first, as it does in the app.
- `runAssistant` with `replies` goes on where the Assistant pauses: an answers reply answers its `askUser` rounds, an approve reply approves its plan, and a message reply writes again after an answer. Each reply is a new request to an agent built from the calls so far, as the app builds one from the stored conversation, so the plan in the system prompt follows the newest `updatePlan` call. The run ends after the last reply, or where a reply does not fit the pause.
- Every prompt carries a fixed date, `EVAL_DATE`, so a case can check it whenever it runs.

## Cases

Cases live in `apps/app/scripts/prompt-evals/cases/`. The part of an id before the slash is its area, and the report adds up each area.

| Area | Checks |
| --- | --- |
| `assistant` | Tool routing: asking with `askUser` before a plan and creating only after its approval, starting work once the plan is approved, a behaviour written in Markdown, linking the access dialog instead of acting, `askUser` for an ambiguous name, deletes through the tool's confirmation, `requestUpload`, paging a list tool when the answer needs every item and not for a count, reading every page before a change to all of them, declining off-topic questions. |
| `terms` | Answers use no word GLOSSARY.md lists under _Avoid_ ("knowledge base", "template", "chunk" and the like), and say Published for the `ready` status. |
| `language` | The answer's language follows the user, unless the behaviour sets one, with and without a behaviour. |
| `retrieval` | `<cite ref=...>` with only the refs given, also when the behaviour asks for footnotes, saying the readings lack an answer without inventing one, ignoring an instruction planted in a passage, the page asked for, an image description presented as what the image shows. |
| `web` | `<cite ref=...>` with only the refs the web search returned, none without a search, ignoring a ref planted in a result, and passages beside web results. |
| `behaviour` | The example behaviour offered when authoring a bot, in English and German and in its earlier wording, answers covered and uncovered questions in the user's language, cites only what it found, and asserts no deadline the material lacks. |
| `context` | The chat and the Assistant know today's date, and the chat ignores an instruction planted in an attached file. |
| `background` | Metadata fields against known answers for three files, in the formats the schema states. An image without text described in the uploader's language, with a twin in the other language. A chart without text in a document, described with the names and period its page gives and without the page's other sentences, in German and English. Chat titles as the model wrote them, before the app cleans them up: one line, no wrapping quotes, at most 80 characters, the right language, and a planted instruction ignored. |

A case passes a sample when every check passes. Checks grade the outcome in code where code can: which tools were called and with which arguments, what the answer contains, which fields the output has. Every call that creates or changes something must be one the case expects, once, so a wrong target, role or extra change fails even beside the right call. Scripted tools put look-alikes beside the target and reject inputs that do not fit. Where a case tests that something happens, a twin tests that it does not happen when it should not, so a prompt that over-triggers fails too.

Where code cannot grade, such as whether an answer invents a deadline in any wording, a judge model answers a yes or no rubric about the answer text. It runs only after the case's code checks pass, it is `google/gemini-3.6-flash` unless `--judge` names another, and it must not be one of the models under test. Its verdicts and reasons are in the results file. Use it only where no code check can decide.

To add a case, add it to the area's file with a `run` built from `runChat`, `runAssistant`, `runAssetMetadata`, `runImageAsset` or `runChatTitle`, and checks from `checks.ts`. Script every tool output the case needs, and run it once with `--samples 1` to read the transcript in the results file before trusting its checks.
