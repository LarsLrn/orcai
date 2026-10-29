import { describe, expect, mock, test } from "bun:test";
import type { BotId } from "@orcai/core";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { botTileActions } = await import("./bot-tile");

const noop = () => undefined;

const actionKeys = (capabilities: Record<string, boolean>) =>
	botTileActions(
		{
			id: "bot-1" as BotId,
			capabilities,
		},
		{
			onAccess: noop,
			onDelete: noop,
		},
	).flatMap((action) =>
		action
			? [
					action.destructive ? `${action.key}!` : action.key,
				]
			: [],
	);

describe("botTileActions", () => {
	test("a bot the user may only use offers no actions", () => {
		expect(
			actionKeys({
				use: true,
			}),
		).toEqual([]);
	});

	test("each action follows its capability, Delete last and destructive", () => {
		expect(
			actionKeys({
				edit: true,
				manage_access: true,
				delete: true,
			}),
		).toEqual([
			"edit",
			"access",
			"delete!",
		]);
		expect(
			actionKeys({
				edit: true,
			}),
		).toEqual([
			"edit",
		]);
	});
});
