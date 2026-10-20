import { beforeEach, describe, expect, test } from "bun:test";
import type { GroupId, OrganizationInvitationId, UserId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { cookieName } from "@/paraglide/runtime";
import { answers, procedureCalls, resetProcedures } from "../test-procedures";

const id = (index: number) =>
	`6a1f1c1e-2a3f-4c1d-9e8f-0a1b2c3d4e${String(index).padStart(2, "0")}`;

const names = new Map([
	[
		id(1),
		"Teaching",
	],
	[
		id(2),
		"Anna",
	],
]);

const find = ({ id: key }: { id: string }) => {
	const name = names.get(key);

	return name
		? Effect.succeed({
				data: {
					name,
				},
			})
		: Effect.fail(
				new ORPCError("NOT_FOUND", {
					data: {
						reason: "GROUP_NOT_FOUND",
					},
				}),
			);
};

const done = () =>
	Effect.succeed({
		success: true,
		message: "",
	});

beforeEach(() => {
	resetProcedures();
	answers["group.find"] = find;
	answers["user.find"] = find;
	answers["group.delete"] = done;
	answers["organizationMember.delete"] = done;
	answers["organizationInvitation.delete"] = done;
	answers["organizationInvitation.list"] = () =>
		Effect.succeed({
			data: [
				{
					id: id(3),
					email: "anna@example.org",
				},
			],
			rowCount: 1,
		});
	answers["organizationInvitation.create"] = (input: {
		items: {
			email: string;
		}[];
	}) =>
		Effect.succeed({
			data: input.items.map((item, index) => ({
				id: id(10 + index),
				email: item.email,
			})),
		});
});

const { deleteGroups } = await import("./delete-group");
const { removeMembers } = await import("./remove-members");
const { cancelInvitations } = await import("./cancel-invitation");
const { inviteMembers } = await import("./invite-members");
const { createAssistantTurn } = await import("../turn-state");

const deps = (reqHeaders?: Headers) => ({
	context: {
		secureCookies: false,
		reqHeaders,
	} as ORPCContext,
	turn: createAssistantTurn({
		zedToken: undefined,
		chatId: "chat",
		replyId: "reply",
	}),
});

const callNames = () => procedureCalls.map(({ procedure }) => procedure);

describe("deleteGroup", () => {
	test("returns the names read before the delete", async () => {
		const output = await Effect.runPromise(
			deleteGroups(deps(), [
				id(1) as GroupId,
				id(9) as GroupId,
				id(1) as GroupId,
			]),
		);

		expect<unknown>(output).toEqual({
			deleted: [
				{
					type: "group",
					id: id(1),
					name: "Teaching",
				},
				{
					type: "group",
					id: id(9),
					name: undefined,
				},
			],
		});
		expect(callNames().at(-1)).toBe("group.delete");
		expect(procedureCalls.at(-1)?.input).toEqual({
			refs: [
				{
					id: id(1),
				},
				{
					id: id(9),
				},
			],
		});
	});
});

describe("deleteGroup with a wrong id", () => {
	test("names the ids it could not read as missing groups", async () => {
		answers["group.delete"] = () =>
			Effect.fail(
				new ORPCError("NOT_FOUND", {
					data: {
						reason: "GROUP_NOT_FOUND",
					},
				}),
			);

		const error = await Effect.runPromise(
			Effect.flip(
				deleteGroups(deps(), [
					id(1) as GroupId,
					id(9) as GroupId,
				]),
			),
		);

		expect(String((error as Error).message)).toBe(
			`GROUP_NOT_FOUND: No group with id ${id(9)}. Ids of other kinds (bots, templates, repositories, assets, members) are not group ids.`,
		);
	});
});

describe("removeMembers", () => {
	test("returns the names read before the removal and maps ids to refs", async () => {
		const output = await Effect.runPromise(
			removeMembers(deps(), [
				id(2) as UserId,
			]),
		);

		expect<unknown>(output).toEqual({
			removed: [
				{
					type: "member",
					id: id(2),
					name: "Anna",
				},
			],
		});
		expect(procedureCalls).toEqual([
			{
				procedure: "user.find",
				input: {
					id: id(2),
				},
			},
			{
				procedure: "organizationMember.delete",
				input: {
					refs: [
						{
							userId: id(2),
						},
					],
				},
			},
		]);
	});
});

describe("cancelInvitation", () => {
	test("returns the emails read before the invitations are withdrawn", async () => {
		const output = await Effect.runPromise(
			cancelInvitations(deps(), [
				id(3) as OrganizationInvitationId,
				id(4) as OrganizationInvitationId,
			]),
		);

		expect<unknown>(output).toEqual({
			withdrawn: [
				{
					type: "invitation",
					id: id(3),
					email: "anna@example.org",
				},
				{
					type: "invitation",
					id: id(4),
					email: undefined,
				},
			],
		});
		expect(callNames()).toEqual([
			"organizationInvitation.list",
			"organizationInvitation.delete",
		]);
	});
});

describe("inviteMembers", () => {
	test("sends a week's expiry and the caller's locale", async () => {
		const now = new Date("2026-10-20T08:00:00.000Z");
		const output = await Effect.runPromise(
			inviteMembers(
				deps(
					new Headers({
						cookie: `${cookieName}=de`,
					}),
				),
				{
					emails: [
						"anna@example.org",
						"ben@example.org",
					],
					role: "manager",
				},
				now,
			),
		);

		expect(procedureCalls).toEqual([
			{
				procedure: "organizationInvitation.create",
				input: {
					role: "manager",
					expiresAt: new Date("2026-10-27T08:00:00.000Z"),
					locale: "de",
					items: [
						{
							email: "anna@example.org",
						},
						{
							email: "ben@example.org",
						},
					],
				},
			},
		]);
		expect<unknown>(output).toEqual({
			invited: [
				{
					type: "invitation",
					id: id(10),
					email: "anna@example.org",
				},
				{
					type: "invitation",
					id: id(11),
					email: "ben@example.org",
				},
			],
			role: "manager",
			expiresAt: "2026-10-27T08:00:00.000Z",
		});
	});

	test("leaves the locale to the procedure without request headers", async () => {
		await Effect.runPromise(
			inviteMembers(
				deps(),
				{
					emails: [
						"anna@example.org",
					],
					role: "member",
				},
				new Date(),
			),
		);

		expect(procedureCalls[0]?.input).toMatchObject({
			locale: undefined,
		});
	});
});
