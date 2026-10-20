import { afterEach, describe, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { m } from "@/paraglide/messages";
import { overwriteServerAsyncLocalStorage } from "@/paraglide/runtime";
import { createToolLines } from "./assistant-tool-lines";

const toolPart = (
	toolName: string,
	id: string,
	input: unknown,
	output: unknown,
) => ({
	type: `tool-${toolName}`,
	toolCallId: id,
	state: "output-available",
	input,
	output,
});

afterEach(() => {
	overwriteServerAsyncLocalStorage(undefined);
});

describe("createToolLines", () => {
	test("summarises stored outputs, naming ids from earlier outputs", () => {
		const { lines } = createToolLines([
			{
				parts: [
					toolPart(
						"findBots",
						"find",
						{
							query: "citation",
						},
						{
							total: 1,
							bots: [
								{
									id: "bot-1",
									name: "Citation check",
								},
							],
						},
					),
					toolPart(
						"deleteBot",
						"delete",
						{
							ids: [
								"bot-1",
							],
						},
						{
							deleted: [
								{
									id: "bot-1",
								},
							],
							skipped: [],
						},
					),
				],
			},
		]);

		expect(lines.get("delete")).toBe(
			m.assistant_tool_delete_bot_summary(
				{
					names: "“Citation check”",
					count: 1,
				},
				{
					locale: "en",
				},
			),
		);
	});

	test("summarises docs pages and the index", () => {
		const { lines } = createToolLines([
			{
				parts: [
					toolPart(
						"readDocs",
						"page",
						{
							path: "/docs/using-orcai/bots",
						},
						{
							path: "/docs/using-orcai/bots",
							title: "Bots",
							url: "https://orcai.test/docs/using-orcai/bots",
							content: "# Bots\n\nA long page.",
						},
					),
					toolPart(
						"readDocs",
						"index",
						{},
						{
							path: null,
							title: null,
							url: "https://orcai.test/docs",
							content: "index",
						},
					),
				],
			},
		]);

		expect(lines.get("page")).toBe(
			"Read the docs page “Bots” (/docs/using-orcai/bots)",
		);
		expect(lines.get("index")).toBe("Read the docs index");
	});

	test("records outputs of the current generation", () => {
		const toolLines = createToolLines([]);

		toolLines.record([
			{
				toolCallId: "get",
				toolName: "getBot",
				input: {
					id: "bot-1",
				},
				output: {
					id: "bot-1",
					name: "Citation check",
				},
			},
		]);

		expect(toolLines.lines.get("get")).toBe(
			m.assistant_tool_get_bot_summary(
				{
					name: "“Citation check”",
				},
				{
					locale: "en",
				},
			),
		);
	});

	test("writes English inside a German request", () => {
		const storage = new AsyncLocalStorage<{
			locale?: "en" | "de";
		}>();
		overwriteServerAsyncLocalStorage(storage);

		const line = storage.run(
			{
				locale: "de",
			},
			() => {
				const toolLines = createToolLines([]);
				toolLines.record([
					{
						toolCallId: "get",
						toolName: "getBot",
						input: {
							id: "bot-1",
						},
						output: {
							id: "bot-1",
							name: "Citation check",
						},
					},
				]);
				return toolLines.lines.get("get");
			},
		);

		expect(line).toBe(
			m.assistant_tool_get_bot_summary(
				{
					name: "“Citation check”",
				},
				{
					locale: "en",
				},
			),
		);
		expect(line).not.toBe(
			m.assistant_tool_get_bot_summary(
				{
					name: "„Citation check“",
				},
				{
					locale: "de",
				},
			),
		);
	});

	test("leaves unknown tools without a line", () => {
		const { lines } = createToolLines([
			{
				parts: [
					toolPart("mysteryTool", "x", {}, {}),
				],
			},
		]);

		expect(lines.has("x")).toBe(false);
	});
});
