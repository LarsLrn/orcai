import { describe, expect, test } from "bun:test";
import { initialsOf } from "../../src/utils/text-utils";

describe("initialsOf", () => {
	test("takes the first letter of a single word", () => {
		expect(initialsOf("ada")).toBe("A");
	});

	test("takes the first letters of the first and last words", () => {
		expect(initialsOf("Ada Lovelace")).toBe("AL");
		expect(initialsOf("  Ada  King   Lovelace ")).toBe("AL");
	});

	test("is empty without a name", () => {
		expect(initialsOf("")).toBe("");
		expect(initialsOf("   ")).toBe("");
		expect(initialsOf(null)).toBe("");
	});

	test("keeps non-Latin letters whole", () => {
		expect(initialsOf("Ögmundur Þórsson")).toBe("ÖÞ");
		expect(initialsOf("山田 太郎")).toBe("山太");
		expect(initialsOf("Zoë 👩🏽‍🔬")).toBe("Z👩🏽‍🔬");
	});
});
