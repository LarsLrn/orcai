import { describe, expect, test } from "bun:test";
import { createZedTokenMailbox } from "./zed-token-mailbox";

describe("createZedTokenMailbox", () => {
	test("starts empty", () => {
		expect(createZedTokenMailbox().read()).toBeUndefined();
	});

	test("keeps the last recorded token", () => {
		const mailbox = createZedTokenMailbox();

		mailbox.record("first");
		mailbox.record("second");

		expect(mailbox.read()).toBe("second");
	});

	test("ignores writes without a token", () => {
		const mailbox = createZedTokenMailbox();

		mailbox.record("first");
		mailbox.record(undefined);

		expect(mailbox.read()).toBe("first");
	});
});
