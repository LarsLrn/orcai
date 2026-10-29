import { describe, expect, test } from "bun:test";
import { attachmentDisposition } from "../src/server/url-helpers";

describe("attachmentDisposition", () => {
	test("names a plain file", () => {
		expect(attachmentDisposition("report.pdf")).toBe(
			`attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
		);
	});

	test("keeps non-ASCII names in filename* with an ASCII fallback", () => {
		expect(attachmentDisposition("Prüfung 2026.pdf")).toBe(
			`attachment; filename="Pr_fung 2026.pdf"; filename*=UTF-8''Pr%C3%BCfung%202026.pdf`,
		);
	});

	test("cannot break out of the quoted name", () => {
		const header = attachmentDisposition('a"; x=y\\.pdf');

		expect(header.startsWith('attachment; filename="a_; x=y_.pdf";')).toBe(
			true,
		);
		expect(header).toContain("%22");
	});
});
