import { describe, expect, test } from "bun:test";
import { summarizeErrorCause } from "@/asset/error-summary";

describe("summarizeErrorCause", () => {
	test("keeps an error's identifying fields and its cause's", () => {
		const cause = Object.assign(new Error("socket hang up"), {
			code: "ECONNRESET",
		});
		const error = Object.assign(
			new Error("upload failed", {
				cause,
			}),
			{
				_tag: "S3Error",
				operation: "put",
				$metadata: {
					httpStatusCode: 503,
				},
			},
		);
		expect(summarizeErrorCause(error)).toEqual({
			name: "Error",
			tag: "S3Error",
			message: "upload failed",
			operation: "put",
			statusCode: 503,
			causeName: "Error",
			causeCode: "ECONNRESET",
			causeMessage: "socket hang up",
		});
	});

	test("redacts data URLs and cuts long messages", () => {
		const dataUrl = `data:image/png;base64,${"A".repeat(1000)}`;
		expect(summarizeErrorCause(dataUrl)).toEqual({
			message: `[redacted-data-url:${dataUrl.length} chars]`,
		});
		const { message } = summarizeErrorCause(new Error("x".repeat(400)));
		expect(message).toBe(`${"x".repeat(320)}...[truncated 80 chars]`);
	});
});
