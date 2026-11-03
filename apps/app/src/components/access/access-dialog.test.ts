import { describe, expect, test } from "bun:test";
import { m } from "@/paraglide/messages";

describe("access dialog description", () => {
	test("names every kind in the sentence and never says Block", () => {
		for (const kind of [
			"bot",
			"behaviour",
			"repository",
			"asset",
		] as const) {
			const plain: string = m.access_dialog_description({
				kind,
			});
			const named: string = m.access_dialog_description_named({
				kind,
				name: "Handbooks",
			});
			expect(plain).toContain(kind);
			expect(named).toContain(kind);
			expect(named).toContain("Handbooks");
			expect(`${plain} ${named}`).not.toMatch(/block/i);
		}
	});
});
