import { describe, expect, test } from "bun:test";
import { createTurnWrites } from "./turn-writes";

const publish = [
	"bot",
	"publish",
];

describe("createTurnWrites", () => {
	test("keeps only the procedures the Assistant writes with, and only the fields their stale queries read", () => {
		const writes = createTurnWrites();

		writes.record(
			[
				"bot",
				"find",
			],
			{
				id: "bot-1",
			},
			{},
		);
		writes.record(
			[
				"organizationMember",
				"delete",
			],
			{
				userIds: [
					"user-1",
				],
			},
			{
				handedOver: null,
			},
		);
		writes.record(publish, {}, {});
		writes.record(publish, {}, {});

		expect(writes.all()).toEqual([
			{
				path: "organizationMember.delete",
				handedOver: false,
			},
			{
				path: "bot.publish",
			},
		]);
	});
});
