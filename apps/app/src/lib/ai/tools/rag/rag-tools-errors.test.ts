import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Repository } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import { chatSources } from "@/lib/ai/citations/chat-sources";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, resetProcedures } from "../assistant/test-procedures";

const { getPassagesTool } = await import("./get-passages");
const { getAssetPageTool } = await import("./get-asset-page");
const { listRepositoryAssetsTool } = await import("./list-repository-assets");
const { searchRepositoriesTool } = await import("./search-repositories");

const deps = {
	blocks: [
		{
			id: "block-1",
			name: "Handbook",
			config: {},
		},
	] as unknown as Repository[],
	context: {
		secureCookies: false,
	} as ORPCContext,
	sources: chatSources([]),
};

const options = {
	toolCallId: "call",
	messages: [],
	context: {},
};

const denied = () =>
	Effect.fail(
		new ORPCError("FORBIDDEN", {
			message: "You do not have permission to read this repository.",
			data: {
				reason: "PERMISSION_DENIED",
			},
		}),
	);

const errorText = (run: Promise<unknown> | undefined) =>
	run?.then(
		() => {
			throw new Error("expected a rejection");
		},
		(error: unknown) => (error as Error).message,
	);

beforeEach(() => {
	answers["block.readiness"] = () =>
		Effect.succeed({
			data: [],
		});
});

afterEach(resetProcedures);

describe("repository tool errors", () => {
	test("a search without a query says what to provide", async () => {
		const run = searchRepositoriesTool(deps).execute?.({}, options);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"INVALID_TOOL_INPUT: Provide query or queryVariants.",
		);
	});

	test("a search by the dropped queries alias says what to provide", async () => {
		const run = searchRepositoriesTool(deps).execute?.(
			{
				queries: [
					"refund policy",
				],
			} as never,
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"INVALID_TOOL_INPUT: Provide query or queryVariants.",
		);
	});

	test("a failed search keeps the procedure's reason", async () => {
		answers["assetPoint.searchRepository"] = denied;

		const run = searchRepositoriesTool(deps).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"PERMISSION_DENIED: You do not have permission to read this repository.",
		);
	});

	test("a failed passage read keeps the procedure's reason", async () => {
		answers["assetPoint.searchRepository"] = denied;

		const run = getPassagesTool(deps).execute?.(
			{
				passages: [
					"101",
				],
				neighbours: 0,
			},
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"PERMISSION_DENIED: You do not have permission to read this repository.",
		);
	});

	test("a failed asset lookup keeps the procedure's reason", async () => {
		answers["block.readiness"] = denied;

		const run = listRepositoryAssetsTool(deps).execute?.(
			{
				limit: 30,
			},
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"PERMISSION_DENIED: You do not have permission to read this repository.",
		);
	});

	test("a failed page read keeps the procedure's reason", async () => {
		answers["block.readiness"] = denied;

		const run = getAssetPageTool(deps).execute?.(
			{
				page: 1,
				includeAdjacentPages: 0,
				limit: 12,
			},
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"PERMISSION_DENIED: You do not have permission to read this repository.",
		);
	});

	test("a defect does not leak its message", async () => {
		answers["assetPoint.searchRepository"] = () =>
			Effect.die(new Error("connection to qdrant:6333 refused"));

		const run = searchRepositoriesTool(deps).execute?.(
			{
				query: "refund policy",
			},
			options,
		);

		expect(await errorText(run as Promise<unknown>)).toBe(
			"INTERNAL_SERVER_ERROR: The request failed on the server.",
		);
	});
});
