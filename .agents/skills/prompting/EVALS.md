# Prompt evals

`bun run prompt-evals` sends about 30 cases to three models through OpenRouter, three samples each, and prints a pass-rate table. It runs on demand for prompt changes and never in CI, because every run costs money and real models vary between runs.

## Running

The key comes from `OPENROUTER_API_KEY`, or else from `~/.config/orcai/openrouter.env`. The script never prints it.

```bash title="Repository root"
bun run prompt-evals                                    # every case, default models, 3 samples
bun run prompt-evals --cases retrieval                  # cases whose id contains "retrieval"
bun run prompt-evals --models qwen/qwen3.7-flash --samples 1
bun run prompt-evals --compare apps/app/scripts/prompt-evals/results/<file>.json
```

Each run writes its samples, with every answer text and tool call, to `apps/app/scripts/prompt-evals/results/` (gitignored) and prints the file's path and the cost OpenRouter reported. `--compare` prints each cell as before → after against an earlier results file. The totals compare only the cases both runs hold, and the report lists the others. `--concurrency` sets the parallel requests (6 by default), and `--judge` the judge model.

A full run costs about $0.30. For a prompt PR, run on the unchanged code first, then on the change with `--compare`, and put the table in the PR body.

## Models

The defaults are `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna` and `google/gemma-4-26b-a4b-it`: one small, cheap model per vendor family, the last an open-weight model of the size a self-hosted instance runs. A run with them is a cheap smoke test of a prompt change and says nothing about other models. Before claiming that a prompt works on a model a deployment uses, run the cases on that model with `--models`. Every call goes through the `openai-compatible` provider kind, the most limited one, so a JSON-mode request carries no schema and the whole system prompt is one message.

## What a run builds

The harness in `apps/app/scripts/prompt-evals/harness.ts` builds each request from the app's own builders: the chat and Assistant system prompts, `buildSystemInstructions`, the retrieval and feature toolsets, the Assistant's toolset and session, and the metadata, image description and title prompts. Changing a builder changes what the evals send.

- Tools keep their descriptions, schemas and model output. A case scripts the output of the tools it expects, and the harness gives every Assistant read tool an empty default. A call to a tool without a script ends the run there, which is how client tools, confirmations and plans end a turn in the app.
- `loadTools` runs for real, so loaded groups become callable as they do in the app.
- `readDocs` reads the checkout's docs as the docs site serves them: `apps/web/scripts/docs-fetch.ts` compiles the pages with the site's fumadocs-mdx config and answers with the site's own index and page text. A docs change counts too.
- A run is one user turn of up to 8 steps. History pruning, compaction, quota and the last-step note are not part of it.

## Cases

Cases live in `apps/app/scripts/prompt-evals/cases/`. The part of an id before the slash is its area, and the report adds up each area.

| Area | Checks |
| --- | --- |
| `assistant` | Tool routing: asking before a plan, linking the access dialog instead of acting, `askUser` for an ambiguous name, deletes through the tool's confirmation, `requestUpload`, declining off-topic questions. |
| `terms` | Answers use no word GLOSSARY.md lists under _Avoid_ ("knowledge base", "template", "chunk" and the like). |
| `language` | The answer's language follows the user, unless the behaviour sets one. |
| `retrieval` | `<cite chunk>` with only the refs given, saying the readings lack an answer without inventing one, ignoring an instruction planted in a passage, the page asked for. |
| `context` | The model knows today's date. |
| `background` | Metadata fields against known answers for three files, in the formats the schema states. An image without text described in the uploader's language, with a twin in the other language. Chat titles as the model wrote them, before the app cleans them up: one line, no wrapping quotes, at most 80 characters, the right language, and a planted instruction ignored. |

A case passes a sample when every check passes. Checks grade the outcome in code where code can: which tools were called and with which arguments, what the answer contains, which fields the output has. Every call that creates or changes something must be one the case expects, once, so a wrong target, role or extra change fails even beside the right call. Scripted tools put look-alikes beside the target and reject inputs that do not fit. Where a case tests that something happens, a twin tests that it does not happen when it should not, so a prompt that over-triggers fails too.

Where code cannot grade, such as whether an answer invents a deadline in any wording, a judge model answers a yes or no rubric about the answer text. It runs only after the case's code checks pass, it is `google/gemini-3.6-flash` unless `--judge` names another, and it must not be one of the models under test. Its verdicts and reasons are in the results file. Use it only where no code check can decide.

To add a case, add it to the area's file with a `run` built from `runChat`, `runAssistant`, `runAssetMetadata`, `runImageAsset` or `runChatTitle`, and checks from `checks.ts`. Script every tool output the case needs, and run it once with `--samples 1` to read the transcript in the results file before trusting its checks.
