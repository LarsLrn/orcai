import { describe, expect, test } from "bun:test";
import { parseOptions } from "./stack";

describe("parseOptions", () => {
	test("rejects an unknown flag", () => {
		expect(() =>
			parseOptions([
				"e2e",
				"--grep",
			]),
		).toThrow("Unknown flag '--grep'. Put delegated arguments after --.");
	});

	test("passes delegated arguments through after --", () => {
		const options = parseOptions([
			"e2e",
			"--",
			"--grep",
			"tenancy",
		]);

		expect(options.command).toBe("e2e");
		expect(options.args).toEqual([
			"--grep",
			"tenancy",
		]);
		expect(options.flags.has("grep")).toBe(false);
	});
});
