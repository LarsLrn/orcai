import { describe, expect, test } from "bun:test";
import {
	csvFileName,
	escapeCsvField,
	formatCsvValue,
	toCsv,
} from "./data-table-csv";

describe("escapeCsvField", () => {
	test("leaves plain fields untouched", () => {
		expect(escapeCsvField("plain")).toBe("plain");
	});

	test("quotes fields containing commas, quotes or line breaks", () => {
		expect(escapeCsvField("a,b")).toBe('"a,b"');
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
	});
});

describe("toCsv", () => {
	test("joins fields with commas and rows with CRLF", () => {
		expect(
			toCsv([
				[
					"Email",
					"Role",
				],
				[
					"a@example.com",
					"admin, owner",
				],
			]),
		).toBe('Email,Role\r\na@example.com,"admin, owner"\r\n');
	});
});

describe("formatCsvValue", () => {
	test("renders empty values as empty strings", () => {
		expect(formatCsvValue(null)).toBe("");
		expect(formatCsvValue(undefined)).toBe("");
	});

	test("renders dates as ISO strings and objects as JSON", () => {
		expect(formatCsvValue(new Date("2026-09-01T10:00:00.000Z"))).toBe(
			"2026-09-01T10:00:00.000Z",
		);
		expect(
			formatCsvValue({
				a: 1,
			}),
		).toBe('{"a":1}');
		expect(formatCsvValue(42)).toBe("42");
	});
});

describe("csvFileName", () => {
	test("appends the csv extension once", () => {
		expect(csvFileName("invitations")).toBe("invitations.csv");
		expect(csvFileName("report.CSV")).toBe("report.CSV");
	});
});
