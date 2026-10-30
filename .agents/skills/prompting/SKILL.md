---
name: prompting
description: How OrcAI writes text that models read. Use when writing or editing a system prompt or feature prompt, a tool or parameter description, a `.describe()` on a schema a model fills, structured-output instructions, or text a tool returns to the model.
---

# Prompting

OrcAI's prompts run on whatever model an organisation connects: Claude, GPT and Gemini, but also a small open-weight model behind vLLM, Ollama, LiteLLM or OpenRouter. Each inference layer drops something: one takes a single system message, one ignores the JSON schema, one puts reasoning in `<think>` tags. Write for the weakest model that may run the text, through the most limited layer, in plain sentences that need no provider feature.

## Steps

1. Find every place the model reads about the topic: the system prompts (`apps/app/src/lib/ai/agents/*-system-prompt.ts`), the feature prompts, the tool and parameter descriptions, `.describe()` text, tool results and their notes, and the work-log lines that replace old tool results in Assistant history. Done when you can name each place and which one owns the rule.
2. Run the evals on the unchanged code, as [`EVALS.md`](EVALS.md) describes, and keep the results file.
3. Write the change to the rules below. Look up every domain noun in [`GLOSSARY.md`](../../../GLOSSARY.md), with the identifier exception under Glossary. Done when each rule exists in one place and no other prompt says the opposite.
4. Run the evals again with `--compare` on the first results file. Add a case to EVALS.md's set when the change fixes a behaviour no case covers. Done when every case that got worse has a reason in the PR body, next to the comparison table.

## Where a rule lives

- A tool's description says what the tool does, when to call it and when not, what each parameter means, what it returns and what it leaves out, and which tool to use instead. Three or four sentences is the floor for anything but a trivial read [A-DT, O-LM].
- The system prompt holds what spans tools: their order, the product's rules, the answer form.
- Each rule lives in one place. A copy raises its weight, so newer models over-apply it, and copies drift into contradictions, which cost more quality than a missing rule [O-CB5, O-LM].
- Few tools with no overlap. When a person cannot tell which tool fits, neither can the model [A-CE]. Deferred tool groups keep the Assistant's active set small.

## Structure

- A short role, then sections in one delimiter style. The existing prompts use a `Heading:` line over a list.
- Stable sections first, then what changes per user or turn in the `variable` part of `SystemPrompt`, so the stable prefix caches. The user's local date goes into the variable part [O-PE, A-model].
- Untrusted text goes in tags or quoted JSON, with one sentence saying it is data, not instructions [O-SPEC, A-HTC]. That covers retrieved passages, attachments, profile fields and anything a user typed that the app puts into a prompt. `assetMetadataPrompt` and the Assistant's Current user section show the pattern.
- A user-authored behaviour sits in its own marked section, and the prompt states what wins when it meets a platform rule.
- Long material comes before the question [A-BP, G-PS].

## Wording

- Say what to do and why. The reason lets the model generalise to cases the rule does not name [A-BP].
- Use calm verbs: "Use this tool when...". Capitals, "CRITICAL" and "If in doubt, use X" make newer models over-trigger [A-BP]. Keep "never" for hard limits, such as claiming an action no tool performed, guessing permissions or giving away a quiz answer [O-LM].
- State the scope ("every answer", "each passage"). Newer models follow instructions literally and do not carry a rule from one item to the next [A-model].
- Give a measure instead of an adjective: "two or three sentences", not "brief" [V-PD, A-model].
- Phrase the target, not the ban: "Write the title as plain text" rather than "Do not use quotes" [A-BP].
- The prompt's own style shapes the answer's style. A prompt full of Markdown gets answers full of Markdown [A-BP].
- Leave out "think step by step" and effort padding such as "be thorough". Newer models reason on their own and over-apply such lines [A-BP, G-G3, O-LM].

## Examples

- Examples steer format and behaviour reliably, so use them where a format is hard to describe, such as the `<cite>` syntax, and where an eval shows a failure the rule alone does not fix. Keep them few, varied and identical in structure, inside tags [A-BP, G-PS, V-FS].
- Each example matches the rules exactly, because the model copies it [O-LM]. A long list of edge cases works worse than a few canonical examples [A-CE]. The evals decide whether an example stays.

## Provider limits

- No prefill, no forced tool choice, no temperature, no reliance on caching or native search. Newer Claude models reject prefill and forced tool choice, Gemini warns against low temperature, and the open-weight layers support each unevenly [A-BP, A-DT, G-G3].
- No parameter or field that asks for the model's reasoning. Ask for a short explanation, since a reasoning field can trigger a refusal on the newest Claude models [A-DT, A-SO].
- `buildSystemInstructions` joins the system prompt into one message for every kind but `anthropic`, because many chat templates take only one. Write each section so it reads well in either form.

## Structured output

- Field meaning goes in the schema's `.describe()`, which the AI SDK forwards. State formats ("page range as 12-15", "dates as YYYY-MM-DD"), make unknown fields nullable, and say what to return when the input does not fit [G-SO, V-CGO, O-SO].
- On `openai-compatible`, OrcAI asks for JSON mode, and the AI SDK sends no schema with it. The prompt text is then the only schema the model sees, so it stays in the prompt there, rendered from the Zod schema by `jsonAnswerInstructions` (`packages/ai/src/json-answer.ts`) rather than written by hand. On `anthropic` and `openai` the API carries the schema, and repeating it in the prompt lowers quality [V-CGO, O-LM].
- Code validates the output. Small models wrap JSON in code fences, return an array where the schema has a string, or spend the whole output budget on reasoning.

## Language

- Prompts are in English. Bots and the Assistant answer in the language the user writes in, unless the behaviour sets another, and the prompt says so, because no vendor leaves this to inference [A-ML, V-SI]. Where the app knows the user's locale, it goes in the variable part.
- Background outputs follow their source: metadata is in the file's language, a chat title in the language of the first message, and an image description without text in the uploader's locale.

## Glossary

- Every domain noun the model may repeat to a user uses its GLOSSARY.md word: in system prompts, descriptions, tool results and notes. The model echoes these words in chat, where the UI's terms would otherwise lose.
- Identifiers the model types stay exact: tool names, parameter names and enum values such as `template`, `viewer` or `ready`. Where one differs from the glossary, the description maps it once ("`template`: a behaviour").
- Plain English in background prompts, such as "the document" a metadata model reads, is not a product term.
- The Assistant's work-log lines (`assistant_tool_*` in the message catalogues) are UI strings and model input at once. An edit keeps each line naming its target.

## Sources

Accessed 2026-10-29. The research behind these rules compares the three vendors' current guides and keeps what they agree on.

- [A-BP] Anthropic, [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices). [A-model] the per-model pages beside it, such as [Haiku 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5).
- [A-DT] Anthropic, [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools). [A-HTC] [Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls). [A-SO] [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). [A-ML] [Multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support).
- [A-CE] Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
- [O-LM] OpenAI, [Using the latest model](https://developers.openai.com/api/docs/guides/latest-model). [O-PE] [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering). [O-FC] [Function calling](https://developers.openai.com/api/docs/guides/function-calling). [O-SO] [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
- [O-CB5] OpenAI Cookbook, [GPT-5 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide). [O-SPEC] [Model Spec](https://model-spec.openai.com/2026-10-29.html).
- [G-PS] Google, [Prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies). [G-G3] [Gemini 3 guide](https://ai.google.dev/gemini-api/docs/gemini-3). [G-SO] [Structured output](https://ai.google.dev/gemini-api/docs/structured-output).
- [V-PD] Vertex AI, [Prompt design strategies](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies). [V-SI] [System instructions](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions). [V-CGO] [Control generated output](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output). [V-FS] [Few-shot examples](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/few-shot-examples).
