import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import {
	applyTurnDecisions,
	CONTINUATION_LEASE_MS,
	isContinuationClaimLive,
	withoutContinuationClaim,
} from "./apply-turn-decisions";

type Part = UIMessage["parts"][number];

const requested = (id: string): Part => ({
	type: "tool-deleteBot",
	toolCallId: `call-${id}`,
	state: "approval-requested",
	input: {
		ids: [
			id,
		],
	},
	approval: {
		id: `approval-${id}`,
	},
});

const responded = (id: string, approved: boolean): Part => ({
	type: "tool-deleteBot",
	toolCallId: `call-${id}`,
	state: "approval-responded",
	input: {
		ids: [
			id,
		],
	},
	approval: {
		id: `approval-${id}`,
		approved,
	},
});

const earlierStep: Part[] = [
	{
		type: "step-start",
	},
	{
		type: "tool-deleteBot",
		toolCallId: "call-old",
		state: "output-available",
		input: {
			ids: [
				"old",
			],
		},
		output: {
			deleted: 1,
		},
		approval: {
			id: "approval-old",
			approved: true,
		},
	},
];

const reply = (parts: Part[]) => ({
	id: "reply",
	role: "assistant",
	parts,
});

const now = new Date("2026-10-20T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const apply = (
	parts: Part[],
	decisions: Parameters<typeof applyTurnDecisions>[0]["decisions"],
	continuedAt?: string,
) =>
	applyTurnDecisions({
		messageId: "reply",
		lastMessage: {
			...reply(parts),
			continuedAt,
		},
		decisions,
		now,
	});

describe("applyTurnDecisions", () => {
	test("patches only the referenced parts of the last step", () => {
		const lastStep: Part[] = [
			{
				type: "step-start",
			},
			{
				type: "text",
				text: "Deleting both.",
			},
			{
				type: "tool-findBots",
				toolCallId: "call-find",
				state: "output-available",
				input: {},
				output: [],
			},
			requested("a"),
			requested("b"),
		];

		const result = apply(
			[
				...earlierStep,
				...lastStep,
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-b",
					approved: false,
					reason: "Keep it",
				},
			],
		);

		expect(result).toEqual({
			ok: true,
			parts: [
				...earlierStep,
				...lastStep.slice(0, 3),
				responded("a", true),
				{
					...responded("b", false),
					approval: {
						id: "approval-b",
						approved: false,
						reason: "Keep it",
					},
				} as Part,
			],
		});
		if (result.ok) {
			expect(result.parts[0]).toBe(earlierStep[0]);
			expect(result.parts[1]).toBe(earlierStep[1]);
		}
	});

	test("rejects an unknown approval id", () => {
		const result = apply(
			[
				{
					type: "step-start",
				},
				requested("a"),
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-x",
					approved: true,
				},
			],
		);

		expect(result).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_DECISIONS_INCOMPLETE",
		});
	});

	test("rejects a partial answer", () => {
		const result = apply(
			[
				{
					type: "step-start",
				},
				requested("a"),
				requested("b"),
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
			],
		);

		expect(result).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_DECISIONS_INCOMPLETE",
		});
	});

	test("rejects an approval answered twice in one request", () => {
		const result = apply(
			[
				{
					type: "step-start",
				},
				requested("a"),
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-a",
					approved: false,
				},
			],
		);

		expect(result).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_DECISIONS_INCOMPLETE",
		});
	});

	test("rejects parts that are no longer pending", () => {
		const contradicted = apply(
			[
				{
					type: "step-start",
				},
				responded("a", true),
			],
			[
				{
					approvalId: "approval-a",
					approved: false,
				},
			],
		);
		const earlier = apply(
			[
				...earlierStep,
				{
					type: "step-start",
				},
				requested("a"),
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-old",
					approved: true,
				},
			],
		);

		expect(contradicted).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
		expect(earlier).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
	});

	test("accepts decisions that repeat the stored answers", () => {
		const parts: Part[] = [
			...earlierStep,
			{
				type: "step-start",
			},
			responded("a", true),
			responded("b", false),
		];

		expect(
			apply(parts, [
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-b",
					approved: false,
				},
			]),
		).toEqual({
			ok: true,
			parts,
		});
	});

	test("patches pending parts next to repeated answers", () => {
		const result = apply(
			[
				{
					type: "step-start",
				},
				responded("a", true),
				requested("b"),
			],
			[
				{
					approvalId: "approval-a",
					approved: true,
				},
				{
					approvalId: "approval-b",
					approved: false,
				},
			],
		);

		expect(result).toEqual({
			ok: true,
			parts: [
				{
					type: "step-start",
				},
				responded("a", true),
				responded("b", false),
			],
		});
	});

	test("refuses any continuation while another one holds the reply", () => {
		const parts: Part[] = [
			{
				type: "step-start",
			},
			responded("a", true),
		];

		expect(apply(parts, [], ago(1000))).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
		expect(
			apply(
				[
					{
						type: "step-start",
					},
					requested("a"),
				],
				[
					{
						approvalId: "approval-a",
						approved: true,
					},
				],
				ago(1000),
			),
		).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
		expect(apply(parts, [], ago(CONTINUATION_LEASE_MS))).toEqual({
			ok: true,
			parts,
		});
	});

	test("rejects a reply that is not the chat's last row", () => {
		const moved = applyTurnDecisions({
			messageId: "reply",
			lastMessage: {
				id: "later",
				role: "user",
				parts: [],
			},
			decisions: [
				{
					approvalId: "approval-a",
					approved: true,
				},
			],
			now,
		});
		const userRow = applyTurnDecisions({
			messageId: "reply",
			lastMessage: {
				id: "reply",
				role: "user",
				parts: [],
			},
			decisions: [],
			now,
		});

		expect(moved).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
		expect(userRow).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_DECISIONS_INCOMPLETE",
		});
	});

	test("accepts no decisions as a retry of an answered step", () => {
		const parts: Part[] = [
			...earlierStep,
			{
				type: "step-start",
			},
			responded("a", true),
			responded("b", false),
		];

		expect(apply(parts, [])).toEqual({
			ok: true,
			parts,
		});
	});

	test("refuses no decisions while an approval is pending or nothing is left to run", () => {
		const pending = apply(
			[
				{
					type: "step-start",
				},
				responded("a", true),
				requested("b"),
			],
			[],
		);
		const finished = apply(earlierStep, []);

		expect(pending).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_DECISIONS_INCOMPLETE",
		});
		expect(finished).toMatchObject({
			ok: false,
			reason: "CHAT_TURN_NOT_AWAITING",
		});
	});
});

describe("isContinuationClaimLive", () => {
	test("holds a claim until its lease runs out", () => {
		expect(isContinuationClaimLive(undefined, now)).toBe(false);
		expect(isContinuationClaimLive(ago(0), now)).toBe(true);
		expect(isContinuationClaimLive(ago(CONTINUATION_LEASE_MS - 1), now)).toBe(
			true,
		);
		expect(isContinuationClaimLive(ago(CONTINUATION_LEASE_MS), now)).toBe(
			false,
		);
		expect(isContinuationClaimLive("not a date", now)).toBe(false);
	});

	test("drops the claim from stored metadata", () => {
		expect(
			withoutContinuationClaim({
				model: "m",
				zedToken: "z",
				continuedAt: ago(0),
			}),
		).toEqual({
			model: "m",
			zedToken: "z",
		});
	});
});
