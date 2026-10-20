import { describe, expect, test } from "bun:test";
import { chatIdSchema, organizationIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { checkTurnChat } from "./load-turn-chat";

const chatId = chatIdSchema.parse("0b7f4f5e-3c1a-4d2b-8e9f-1a2b3c4d5e6f");
const activeOrganizationId = organizationIdSchema.parse(
	"1c8e5a6f-4d2b-4e3c-9f0a-2b3c4d5e6f70",
);
const otherOrganizationId = organizationIdSchema.parse(
	"2d9f6b70-5e3c-4f4d-8a1b-3c4d5e6f7081",
);

const refusal = (chat: Parameters<typeof checkTurnChat>[0]["chat"]) =>
	Effect.runSync(
		Effect.flip(
			checkTurnChat({
				chatId,
				chat,
				activeOrganizationId,
			}),
		),
	).reason;

describe("checkTurnChat", () => {
	test("a missing chat is not found", () => {
		expect(refusal(undefined)).toBe("CHAT_NOT_FOUND");
	});

	test("an assistant conversation of another organisation is refused", () => {
		expect(
			refusal({
				kind: "assistant",
				organizationId: otherOrganizationId,
			}),
		).toBe("ASSISTANT_ORGANIZATION_MISMATCH");
	});

	test("an assistant conversation of the active organisation passes", () => {
		const chat = {
			kind: "assistant" as const,
			organizationId: activeOrganizationId,
		};

		expect(
			Effect.runSync(
				checkTurnChat({
					chatId,
					chat,
					activeOrganizationId,
				}),
			),
		).toBe(chat);
	});

	test("a plain chat passes in any organisation", () => {
		const chat = {
			kind: "chat" as const,
			organizationId: null,
		};

		expect(
			Effect.runSync(
				checkTurnChat({
					chatId,
					chat,
					activeOrganizationId,
				}),
			),
		).toBe(chat);
	});
});
