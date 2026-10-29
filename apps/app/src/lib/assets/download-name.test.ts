import { describe, expect, test } from "bun:test";
import type { AssetFileType } from "@orcai/schema";
import { downloadName } from "./download-name";

const asset = (
	fileName: string | null,
	title: string,
	fileType: AssetFileType,
) => ({
	fileName,
	title,
	fileType,
});

describe("downloadName", () => {
	test("uses the uploaded file name when the asset has one", () => {
		expect(downloadName(asset("scan_0042.pdf", "Handbook", "pdf"))).toBe(
			"scan_0042.pdf",
		);
	});

	test("keeps a title that already ends in the extension", () => {
		expect(downloadName(asset(null, "Handbook.pdf", "pdf"))).toBe(
			"Handbook.pdf",
		);
		expect(downloadName(asset(null, "Handbook.PDF", "pdf"))).toBe(
			"Handbook.PDF",
		);
	});

	test("adds the file type to a title without it", () => {
		expect(downloadName(asset(null, "Handbook", "pdf"))).toBe("Handbook.pdf");
		expect(downloadName(asset(null, "Notes v1.2", "docx"))).toBe(
			"Notes v1.2.docx",
		);
	});

	test("adds the file type to an uploaded name without an extension", () => {
		expect(downloadName(asset("scan", "Handbook", "pdf"))).toBe("scan.pdf");
		expect(downloadName(asset("photo.jpg", "Photo", "jpeg"))).toBe("photo.jpg");
	});

	test("drops path components from the name", () => {
		expect(downloadName(asset("../../report.pdf", "Report", "pdf"))).toBe(
			"report.pdf",
		);
		expect(downloadName(asset("C:\\docs\\report.pdf", "Report", "pdf"))).toBe(
			"report.pdf",
		);
	});

	test("drops control and bidirectional characters from the name", () => {
		expect(
			downloadName(asset("invoice\u202Efdp.exe\u0000", "Invoice", "pdf")),
		).toBe("invoicefdp.exe");
		expect(downloadName(asset(null, "Re\u202Eport\n", "pdf"))).toBe(
			"Report.pdf",
		);
	});

	test("falls back to the title when the uploaded name leaves nothing", () => {
		expect(downloadName(asset("..", "Handbook", "pdf"))).toBe("Handbook.pdf");
		expect(downloadName(asset("\u202E", "Handbook", "pdf"))).toBe(
			"Handbook.pdf",
		);
	});

	test("caps a long name and keeps its extension", () => {
		const long = downloadName(
			asset(`${"a".repeat(10_000)}.pdf`, "Long", "pdf"),
		);
		expect(long.length).toBe(200);
		expect(long.endsWith(".pdf")).toBe(true);
		expect(downloadName(asset(null, "t".repeat(10_000), "pdf")).length).toBe(
			200,
		);
	});
});
