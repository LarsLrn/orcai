import { describe, expect, test } from "bun:test";
import { noSourceList } from "./checks";

const passes = (text: string) =>
	noSourceList.pass({
		text,
		calls: [],
		stop: "answer",
		output: undefined,
	});

describe("noSourceList", () => {
	test.each([
		"Use et al.\n\nSources: APA guide, p. 8",
		"Use et al.\n\n## Sources\n- APA guide",
		"Use et al.\n\n**References**\n- APA guide",
		"Use et al.\n\nQuelle: APA-Leitfaden",
		"Verwenden Sie et al.\n\n## Quellen\n- APA-Leitfaden",
		"Verwenden Sie et al.\n\n### Literaturverzeichnis\n- APA-Leitfaden",
		"Verwenden Sie et al.\n\n**Quellenangaben**\n- APA-Leitfaden",
		"Verwenden Sie et al.\n\n## Quellenverzeichnis\n- APA-Leitfaden",
	])("flags %j", (text) => {
		expect(passes(text)).toBe(false);
	});

	test.each([
		"The sources say to use et al. for three authors.",
		"Quellen nennen Sie im Text mit Nachnamen.",
		'Use <cite chunk="k7f3a2">et al.</cite>',
	])("allows %j", (text) => {
		expect(passes(text)).toBe(true);
	});
});
