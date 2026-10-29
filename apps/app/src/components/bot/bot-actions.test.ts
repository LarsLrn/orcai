import { describe, expect, mock, test } from "bun:test";
import type { BotId, OrganizationId } from "@orcai/core";
import type { SourceOrganization } from "@orcai/schema";
import type { Installer } from "@/components/catalogue/installer";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { botActions } = await import("./bot-actions");

const noop = () => undefined;

const actionKeys = (
	capabilities: Record<string, boolean>,
	{
		installedFrom = null,
		installer,
	}: {
		installedFrom?: SourceOrganization | null;
		installer?: Installer;
	} = {},
) =>
	Object.values(
		botActions(
			{
				id: "bot-1" as BotId,
				capabilities,
				installedFrom,
			},
			{
				onAccess: noop,
				onDelete: noop,
				onRemove: noop,
			},
			installer,
		),
	).flatMap((action) =>
		action
			? [
					action.destructive ? `${action.key}!` : action.key,
				]
			: [],
	);

describe("botActions", () => {
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

	test("a bot added from the catalogue is shared and removed by installers, never edited or deleted here", () => {
		const installedFrom = {
			id: "organization-1" as OrganizationId,
			name: "Writing Centre",
			logo: null,
		};
		const editor = {
			edit: true,
			manage_access: true,
			delete: true,
		};
		expect(
			actionKeys(editor, {
				installedFrom,
			}),
		).toEqual([]);
		expect(
			actionKeys(editor, {
				installedFrom,
				installer: {
					organisation: "Methods Lab",
				},
			}),
		).toEqual([
			"access",
			"remove!",
		]);
		expect(
			actionKeys(editor, {
				installer: {
					organisation: "Methods Lab",
				},
			}),
		).toEqual([
			"edit",
			"access",
			"delete!",
		]);
	});
});
