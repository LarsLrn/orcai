import { describe, expect, test } from "bun:test";
import { safeExternalUrl } from "../../src";

describe("safeExternalUrl", () => {
	test("keeps http and https URLs as given", () => {
		for (const url of [
			"https://www.who.int/news-room/fact-sheets/detail/malaria",
			"http://example.org/a?b=c#d",
		]) {
			expect(safeExternalUrl(url)).toBe(url);
		}
	});

	test("rejects other schemes, credentials and relative URLs", () => {
		for (const url of [
			"javascript:alert(1)",
			"data:text/html,<script>alert(1)</script>",
			"mailto:a@example.org",
			"https://user:secret@example.org/",
			"https://user@example.org/",
			"/docs/using-orcai/bots",
			"example.org",
			"",
		]) {
			expect(safeExternalUrl(url)).toBeUndefined();
		}
	});
});
