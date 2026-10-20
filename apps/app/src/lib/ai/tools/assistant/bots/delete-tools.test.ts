import { beforeEach, describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

/** Readable deletable, readable without delete, and unreadable. */
const records = new Map<
	string,
	{
		name: string;
		canDelete: boolean;
		type?: "template" | "database";
	}
>();

const find = ({ id }: { id: string }) => {
	const record = records.get(id);

	return record
		? Effect.succeed({
				data: {
					type: record.type,
					name: record.name,
					title: record.name,
					capabilities: {
						delete: record.canDelete,
					},
				},
			})
		: Effect.fail(
				new ORPCError("FORBIDDEN", {
					data: {
						reason: "PERMISSION_DENIED",
					},
				}),
			);
};

/** Like the delete middleware: one id the user may not delete refuses the batch. */
const remove = ({
	refs,
}: {
	refs: {
		id: string;
	}[];
}) =>
	refs.every(({ id }) => records.get(id)?.canDelete === true)
		? Effect.succeed({
				success: true,
				message: "",
			})
		: Effect.fail(
				new ORPCError("FORBIDDEN", {
					data: {
						reason: "PERMISSION_DENIED",
					},
				}),
			);

beforeEach(() => {
	resetProcedures();
	for (const namespace of [
		"block",
		"asset",
	]) {
		answers[`${namespace}.find`] = find;
		answers[`${namespace}.delete`] = remove;
	}
});

const deleteCalls = () =>
	procedureCalls.filter(({ procedure }) => procedure.endsWith(".delete"));

const { deleteBlockTool } = await import("./delete-block");
const { deleteAssetTool } = await import("./delete-asset");
const { createAssistantTurn } = await import("../turn-state");

const deps = () => ({
	context: {} as ORPCContext,
	turn: createAssistantTurn({
		zedToken: undefined,
		chatId: "chat",
		replyId: "reply",
	}),
});

const options = {
	toolCallId: "delete",
	messages: [],
} as never;

describe("delete tools", () => {
	test("deleteBlock returns the names it read before deleting", async () => {
		const [own, shared, hidden] = Array.from(
			{
				length: 3,
			},
			() => crypto.randomUUID() as BlockId,
		);
		records.set(own, {
			name: "Strict",
			canDelete: true,
			type: "template",
		});
		records.set(shared, {
			name: "Sources",
			canDelete: false,
			type: "database",
		});

		const output = await deleteBlockTool(deps()).execute?.(
			{
				ids: [
					own,
					shared,
					hidden,
				],
			},
			options,
		);

		expect(output).toEqual({
			deleted: [
				{
					type: "template",
					id: own,
					name: "Strict",
				},
			],
			skipped: [
				{
					type: "repository",
					id: shared,
					name: "Sources",
				},
				{
					type: "block",
					id: hidden,
					name: undefined,
				},
			],
		});
		expect(deleteCalls()).toEqual([
			{
				procedure: "block.delete",
				input: {
					refs: [
						{
							id: own,
						},
					],
				},
			},
		]);
	});

	test("a target the user may not delete is skipped, not sent, so the rest is deleted", async () => {
		const [deletable, locked] = Array.from(
			{
				length: 2,
			},
			() => crypto.randomUUID() as AssetId,
		);
		records.set(deletable, {
			name: "Draft notes",
			canDelete: true,
		});
		records.set(locked, {
			name: "Shared notes",
			canDelete: false,
		});

		const output = await deleteAssetTool(deps()).execute?.(
			{
				ids: [
					deletable,
					locked,
				],
			},
			options,
		);

		expect(output).toEqual({
			deleted: [
				{
					type: "asset",
					id: deletable,
					name: "Draft notes",
				},
			],
			skipped: [
				{
					type: "asset",
					id: locked,
					name: "Shared notes",
				},
			],
		});
		expect(deleteCalls()).toEqual([
			{
				procedure: "asset.delete",
				input: {
					refs: [
						{
							id: deletable,
						},
					],
				},
			},
		]);
	});

	test("nothing is sent when no target may be deleted", async () => {
		const locked = crypto.randomUUID() as AssetId;
		records.set(locked, {
			name: "Shared notes",
			canDelete: false,
		});

		const output = await deleteAssetTool(deps()).execute?.(
			{
				ids: [
					locked,
				],
			},
			options,
		);

		expect(output).toEqual({
			deleted: [],
			skipped: [
				{
					type: "asset",
					id: locked,
					name: "Shared notes",
				},
			],
		});
		expect(deleteCalls()).toEqual([]);
	});

	test("deleteAsset names assets by their title", async () => {
		const id = crypto.randomUUID() as AssetId;
		records.set(id, {
			name: "Lecture notes",
			canDelete: true,
		});

		const output = await deleteAssetTool(deps()).execute?.(
			{
				ids: [
					id,
				],
			},
			options,
		);

		expect(output).toEqual({
			deleted: [
				{
					type: "asset",
					id,
					name: "Lecture notes",
				},
			],
			skipped: [],
		});
		expect(deleteCalls()).toEqual([
			{
				procedure: "asset.delete",
				input: {
					refs: [
						{
							id,
						},
					],
				},
			},
		]);
	});
});
