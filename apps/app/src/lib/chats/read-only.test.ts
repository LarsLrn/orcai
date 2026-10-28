import { describe, expect, test } from "bun:test";
import type { BotId, OrganizationId } from "@orcai/core";
import { chatReadOnlyReason } from "./read-only";

const home = crypto.randomUUID() as OrganizationId;
const elsewhere = crypto.randomUUID() as OrganizationId;
const botId = crypto.randomUUID() as BotId;

const chat = ({
	withBot = false,
	botDeletedAt = null,
}: {
	withBot?: boolean;
	botDeletedAt?: Date | null;
} = {}) => ({
	organizationId: home,
	botId: withBot ? botId : null,
	botDeletedAt,
});

const writable = {
	activeOrganizationId: home,
	isMember: true,
	botUsable: true,
};

describe("chatReadOnlyReason", () => {
	test("a chat of the active organisation is writable", () => {
		expect(chatReadOnlyReason(chat(), writable)).toBeNull();
		expect(
			chatReadOnlyReason(
				chat({
					withBot: true,
				}),
				writable,
			),
		).toBeNull();
	});

	test("a member in another organisation reads it only", () => {
		expect(
			chatReadOnlyReason(chat(), {
				...writable,
				activeOrganizationId: elsewhere,
			}),
		).toBe("other-organization");
	});

	test("a former member reads it only, also without any active organisation", () => {
		expect(
			chatReadOnlyReason(chat(), {
				...writable,
				activeOrganizationId: undefined,
				isMember: false,
			}),
		).toBe("not-member");
	});

	test("a bot the user may not use leaves its chat read-only until it is shared again", () => {
		expect(
			chatReadOnlyReason(
				chat({
					withBot: true,
				}),
				{
					...writable,
					botUsable: false,
				},
			),
		).toBe("bot-unavailable");
		expect(
			chatReadOnlyReason(chat(), {
				...writable,
				botUsable: false,
			}),
		).toBeNull();
	});

	test("a deleted bot outranks the organisation, and the organisation the bot's access", () => {
		expect(
			chatReadOnlyReason(
				chat({
					botDeletedAt: new Date(),
				}),
				{
					...writable,
					activeOrganizationId: elsewhere,
					isMember: false,
				},
			),
		).toBe("bot-deleted");
		expect(
			chatReadOnlyReason(
				chat({
					withBot: true,
				}),
				{
					activeOrganizationId: elsewhere,
					isMember: true,
					botUsable: false,
				},
			),
		).toBe("other-organization");
	});
});
