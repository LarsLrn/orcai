import { describe, expect, test } from "bun:test";
import { requestUploadTool, SAVED_UPLOAD_NEXT_STEP } from "./request-upload";

const modelOutput = (
	output: Parameters<
		NonNullable<typeof requestUploadTool.toModelOutput>
	>[0]["output"],
) =>
	requestUploadTool.toModelOutput?.({
		toolCallId: "upload-1",
		input: {
			reason: "Upload the style guides",
		},
		output,
	});

describe("requestUpload model output", () => {
	test("says saved assets are not attached and how to attach them", async () => {
		const assets = [
			{
				id: "00000000-0000-4000-8000-000000000001",
				title: "APA 7.pdf",
			},
		];

		expect(
			await modelOutput({
				status: "saved",
				assets: assets as never,
			}),
		).toEqual({
			type: "json",
			value: {
				status: "saved",
				attached: false,
				assets,
				next: SAVED_UPLOAD_NEXT_STEP,
			},
		});
	});

	test("passes a cancellation through", async () => {
		expect(
			await modelOutput({
				status: "cancelled",
			}),
		).toEqual({
			type: "json",
			value: {
				status: "cancelled",
			},
		});
	});
});
