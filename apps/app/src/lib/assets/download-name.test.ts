import { describe, expect, test } from "bun:test";
import { downloadName } from "./download-name";

describe("downloadName", () => {
	test("keeps a title that already ends in the extension", () => {
		expect(downloadName("Handbook.pdf", "pdf")).toBe("Handbook.pdf");
		expect(downloadName("Handbook.PDF", "pdf")).toBe("Handbook.PDF");
	});

	test("adds the file type to a title without it", () => {
		expect(downloadName("Handbook", "pdf")).toBe("Handbook.pdf");
		expect(downloadName("Notes v1.2", "docx")).toBe("Notes v1.2.docx");
	});
});
