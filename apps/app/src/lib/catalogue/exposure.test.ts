import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { blocksToList, type ExposedBlock } from "./exposure";

const block = (
	name: string,
	state: Pick<ExposedBlock, "listed" | "canManageAccess">,
): ExposedBlock => ({
	id: crypto.randomUUID() as BlockId,
	name,
	...state,
});

const listed = block("Listed", {
	listed: true,
	canManageAccess: false,
});
const managed = block("Managed", {
	listed: false,
	canManageAccess: true,
});
const foreign = block("Foreign", {
	listed: false,
	canManageAccess: false,
});

describe("blocksToList", () => {
	test("a bot whose blocks are all listed lists nothing more", () => {
		expect(
			blocksToList(
				[
					listed,
				],
				[],
			),
		).toEqual({
			_tag: "List",
			blockIds: [],
		});
	});

	test("confirmed unlisted blocks the actor manages are listed", () => {
		expect(
			blocksToList(
				[
					listed,
					managed,
				],
				[
					managed.id,
				],
			),
		).toEqual({
			_tag: "List",
			blockIds: [
				managed.id,
			],
		});
	});

	test("an unconfirmed unlisted block asks for confirmation", () => {
		expect(
			blocksToList(
				[
					managed,
				],
				[],
			),
		).toEqual({
			_tag: "Unconfirmed",
			blocks: [
				managed,
			],
		});
	});

	test("one unlisted block the actor cannot manage refuses the whole operation", () => {
		expect(
			blocksToList(
				[
					managed,
					foreign,
				],
				[
					managed.id,
					foreign.id,
				],
			),
		).toEqual({
			_tag: "Forbidden",
			blocks: [
				foreign,
			],
		});
	});
});
