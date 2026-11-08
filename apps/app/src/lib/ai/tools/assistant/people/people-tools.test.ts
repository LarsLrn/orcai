import { beforeEach, describe, expect, test } from "bun:test";
import type { GroupId, OrganizationInvitationId, UserId } from "@orcai/core";
import { ORPCError } from "@orpc/client";
import type { Tool } from "ai";
import * as Effect from "effect/Effect";
import { testRequestContext } from "@/lib/testing/request-context";
import { cookieName } from "@/paraglide/runtime";
import {
	answers,
	procedureCalls,
	resetProcedures,
	runPromise,
} from "../test-procedures";

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

const findMember = ({ userId }: { userId: string }) =>
	find({
		id: userId,
	});

const done = () =>
	Effect.succeed({
		success: true,
		message: "",
	});

const unavailable = () =>
	Effect.fail(
		new ORPCError("SERVICE_UNAVAILABLE", {
			message: "Permissions could not be checked right now. Try again shortly.",
			data: {
				reason: "PERMISSIONS_UNAVAILABLE",
			},
		}),
	);

const UNAVAILABLE_TEXT =
	"PERMISSIONS_UNAVAILABLE: Permissions could not be checked right now. Try again shortly.";

const handingOver = () =>
	Effect.succeed({
		success: true,
		handedOver: {
			receiverId: id(1),
			bots: 2,
			blocks: 1,
			assets: 0,
		},
	});

beforeEach(() => {
	resetProcedures();
	answers["group.find"] = find;
	answers["organizationMember.find"] = findMember;
	answers["group.delete"] = done;
	answers["organizationMember.delete"] = done;
	answers["organizationInvitation.delete"] = done;
	answers["organizationInvitation.find"] = ({ id: key }: { id: string }) =>
		key === id(3)
			? Effect.succeed({
					data: {
						email: "anna@example.org",
					},
				})
			: Effect.fail(
					new ORPCError("NOT_FOUND", {
						data: {
							reason: "INVITATION_NOT_FOUND",
						},
					}),
				);
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
			skipped: [],
		});
});

const { deleteGroups } = await import("./delete-group");
const { removeMembers, removeMembersTool } = await import("./remove-members");
const { changeMemberRoleTool } = await import("./change-member-role");
const { cancelInvitations, cancelInvitationTool } = await import(
	"./cancel-invitation"
);
const { inviteMembers } = await import("./invite-members");
const { createAssistantTurn } = await import("../turn-state");

const deps = (reqHeaders?: Headers) => ({
	context: testRequestContext({
		reqHeaders,
	}),
	turn: createAssistantTurn({
		zedToken: undefined,
	}),
});

const callNames = () => procedureCalls.map(({ procedure }) => procedure);

const execute = <Input, Output>(tool: Tool<Input, Output>, input: Input) =>
	tool.execute?.(input, {
		toolCallId: "call-1",
		messages: [],
		context: {},
	});

describe("deleteGroup", () => {
	test("returns the names read before the delete", async () => {
		const output = await runPromise(
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

		const error = await runPromise(
			Effect.flip(
				deleteGroups(deps(), [
					id(1) as GroupId,
					id(9) as GroupId,
				]),
			),
		);

		expect(String((error as Error).message)).toBe(
			`GROUP_NOT_FOUND: No group with id ${id(9)}. Ids of other kinds (bots, behaviours, repositories, assets, members, invitations) are not group ids.`,
		);
	});
});

describe("removeMembers", () => {
	test("returns the names read before the removal and maps ids to refs", async () => {
		const output = await runPromise(
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
				procedure: "organizationMember.find",
				input: {
					userId: id(2),
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

	test("names the receiver of the content that moved", async () => {
		answers["organizationMember.delete"] = handingOver;

		const output = await runPromise(
			removeMembers(
				deps(),
				[
					id(2) as UserId,
				],
				id(1) as UserId,
			),
		);

		expect<unknown>(output).toEqual({
			removed: [
				{
					type: "member",
					id: id(2),
					name: "Anna",
				},
			],
			handedOver: {
				receiver: {
					type: "member",
					id: id(1),
					name: "Teaching",
				},
				bots: 2,
				blocks: 1,
				assets: 0,
			},
		});
		expect(procedureCalls[1]).toEqual({
			procedure: "organizationMember.delete",
			input: {
				refs: [
					{
						userId: id(2),
					},
				],
				receiverId: id(1),
			},
		});
	});

	test("leaves out a receiver name it cannot find", async () => {
		answers["organizationMember.delete"] = handingOver;
		answers["organizationMember.find"] = ({ userId }: { userId: string }) =>
			userId === id(1)
				? Effect.fail(new ORPCError("NOT_FOUND"))
				: findMember({
						userId,
					});

		const output = await runPromise(
			removeMembers(
				deps(),
				[
					id(2) as UserId,
				],
				id(1) as UserId,
			),
		);

		expect<unknown>(output).toMatchObject({
			handedOver: {
				receiver: {
					id: id(1),
					name: undefined,
				},
			},
		});
	});
});

describe("a receiver lookup that fails after the change", () => {
	const lookupFails = () => {
		answers["organizationMember.find"] = ({ userId }: { userId: string }) =>
			userId === id(1)
				? unavailable()
				: findMember({
						userId,
					});
	};
	const appliedText = `${UNAVAILABLE_TEXT} The change was applied, only naming its receiver failed; check with listMembers before retrying.`;

	test("removeMembers says the removal was applied and keeps its write", async () => {
		answers["organizationMember.delete"] = handingOver;
		lookupFails();
		const tool = deps();

		await expect(
			execute(removeMembersTool(tool), {
				userIds: [
					id(2) as UserId,
				],
				receiverId: id(1) as UserId,
			}),
		).rejects.toThrow(appliedText);
		expect(tool.turn.writes.all()).toEqual([
			{
				path: "organizationMember.delete",
				handedOver: true,
			},
		]);
	});

	test("changeMemberRole says the role change was applied and keeps its write", async () => {
		answers["organizationMember.update"] = () =>
			Effect.succeed({
				data: {
					userId: id(2),
					role: "viewer",
				},
				handedOver: {
					receiverId: id(1),
					bots: 1,
					blocks: 0,
					assets: 0,
				},
			});
		lookupFails();
		const tool = deps();

		await expect(
			execute(changeMemberRoleTool(tool), {
				userId: id(2) as UserId,
				role: "viewer",
				receiverId: id(1) as UserId,
			}),
		).rejects.toThrow(appliedText);
		expect(tool.turn.writes.all()).toEqual([
			{
				path: "organizationMember.update",
				handedOver: true,
			},
		]);
	});
});

describe("cancelInvitation", () => {
	test("returns the emails read before the invitations are withdrawn", async () => {
		const output = await runPromise(
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
			"organizationInvitation.find",
			"organizationInvitation.find",
			"organizationInvitation.delete",
		]);
	});

	test("reports permissions that cannot be checked and withdraws nothing", async () => {
		answers["organizationInvitation.find"] = unavailable;

		await expect(
			execute(cancelInvitationTool(deps()), {
				ids: [
					id(3) as OrganizationInvitationId,
				],
			}),
		).rejects.toThrow(UNAVAILABLE_TEXT);
		expect(callNames()).toEqual([
			"organizationInvitation.find",
		]);
	});
});

describe("inviteMembers", () => {
	test("sends a week's expiry and the caller's locale", async () => {
		const now = new Date("2026-10-20T08:00:00.000Z");
		const output = await runPromise(
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
			skipped: [],
			role: "manager",
			expiresAt: "2026-10-27T08:00:00.000Z",
		});
	});

	test("leaves the locale to the procedure when the request names none", async () => {
		await runPromise(
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
