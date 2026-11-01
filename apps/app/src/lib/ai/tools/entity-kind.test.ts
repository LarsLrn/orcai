import { describe, expect, test } from "bun:test";
import { isMissing, wrongBlockText, wrongIdText } from "./entity-kind";

describe("wrongIdText", () => {
	test("an invitation's hint names every other kind", () => {
		expect(wrongIdText("invitation", "i-1", "INVITATION_NOT_FOUND")).toBe(
			"INVITATION_NOT_FOUND: No invitation with id i-1. Ids of other kinds (bots, behaviours, repositories, assets, groups, members) are not invitation ids.",
		);
	});

	test("other kinds' hints name invitations", () => {
		expect(wrongIdText("member", "u-1", "MEMBER_NOT_FOUND")).toEndWith(
			"Ids of other kinds (bots, behaviours, repositories, assets, groups, invitations) are not member ids.",
		);
	});

	test("a block takes behaviour and repository ids", () => {
		expect(
			wrongIdText(
				"block",
				[
					"b-1",
					"b-2",
				],
				"BLOCK_NOT_FOUND",
			),
		).toBe(
			"BLOCK_NOT_FOUND: No behaviour or repository with one of the ids b-1, b-2. Ids of other kinds (bots, assets, groups, members, invitations) are not behaviour or repository ids.",
		);
	});
});

describe("wrongBlockText", () => {
	test("names the expected kind and what the block is", () => {
		expect(wrongBlockText("behaviour", "b-1", "repository")).toBe(
			"BEHAVIOUR_BLOCK_TYPE_INVALID: No behaviour with id b-1. Ids of other kinds (bots, repositories, assets, groups, members, invitations) are not behaviour ids. That id is a repository.",
		);
	});
});

describe("isMissing", () => {
	test("a block of the other type is a missing behaviour, not a missing repository", () => {
		const failure = {
			reason: "BEHAVIOUR_BLOCK_TYPE_INVALID",
		};

		expect(isMissing("behaviour", failure)).toBe(true);
		expect(isMissing("repository", failure)).toBe(false);
	});

	test("without a reason, the NOT_FOUND entity decides", () => {
		expect(
			isMissing("member", {
				entity: "user",
			}),
		).toBe(true);
		expect(
			isMissing("group", {
				entity: "user",
			}),
		).toBe(false);
		expect(isMissing("invitation", {})).toBe(true);
	});

	test("a reason wins over the entity", () => {
		expect(
			isMissing("group", {
				reason: "MEMBER_NOT_FOUND",
				entity: "group",
			}),
		).toBe(false);
	});
});
