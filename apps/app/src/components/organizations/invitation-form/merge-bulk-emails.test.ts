import { describe, expect, test } from "bun:test";
import { mergeBulkEmails } from "./merge-bulk-emails";

const rows = (...emails: string[]) =>
	emails.map((email) => ({
		email,
	}));

describe("mergeBulkEmails", () => {
	test("appends the pasted addresses to the filled rows", () => {
		expect(mergeBulkEmails(rows("a@x.org"), "b@x.org\nc@x.org")).toEqual(
			rows("a@x.org", "b@x.org", "c@x.org"),
		);
	});

	test("replaces the blank starting row", () => {
		expect(mergeBulkEmails(rows(""), "a@x.org")).toEqual(rows("a@x.org"));
	});

	test("skips addresses already in the rows or pasted twice, ignoring case", () => {
		expect(
			mergeBulkEmails(rows("a@x.org"), "A@x.org\nb@x.org\n B@X.org "),
		).toEqual(rows("a@x.org", "b@x.org"));
	});

	test("skips blank lines and trims the rest", () => {
		expect(mergeBulkEmails(rows(), "\n  a@x.org  \n\n")).toEqual(
			rows("a@x.org"),
		);
	});

	test("leaves the rows alone when nothing new is pasted", () => {
		expect(mergeBulkEmails(rows("a@x.org", ""), "a@x.org\n\n")).toEqual(
			rows("a@x.org", ""),
		);
	});
});
