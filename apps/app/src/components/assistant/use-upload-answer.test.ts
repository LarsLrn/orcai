import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useUploadAnswer } from "./use-upload-answer";

const asset = {
	id: "00000000-0000-4000-8000-000000000001",
	title: "APA 7.pdf",
} as const;

const setUp = (confirmDiscard: () => Promise<boolean> = async () => true) => {
	const output = mock((_: unknown) => undefined);
	const { result } = renderHook(() =>
		useUploadAnswer({
			toolCallId: "upload-1",
			answers: {
				approve: () => undefined,
				output,
				continue: async () => undefined,
			},
			confirmDiscard,
		}),
	);

	return {
		result,
		output,
	};
};

const outputs = (output: ReturnType<typeof mock>) =>
	output.mock.calls.map(
		([call]) =>
			(
				call as {
					output: {
						status: string;
					};
				}
			).output.status,
	);

describe("useUploadAnswer", () => {
	test("created assets answer saved with the zedToken the create returned", () => {
		const { result, output } = setUp();

		act(() => {
			result.current.created(
				[
					asset as never,
				],
				"zed-created",
			);
		});

		expect(output.mock.calls[0]?.[0]).toEqual({
			tool: "requestUpload",
			toolCallId: "upload-1",
			output: {
				status: "saved",
				assets: [
					asset,
				],
			},
			zedToken: "zed-created",
		});
	});

	test("Cancel before any upload answers without asking", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, output } = setUp(confirmDiscard);

		await act(() => result.current.cancel());

		expect(confirmDiscard).not.toHaveBeenCalled();
		expect(outputs(output)).toEqual([
			"cancelled",
		]);
	});

	test("Cancel during an upload asks and stays when the user stays", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, output } = setUp(confirmDiscard);

		act(() => {
			result.current.setIsUploading(true);
		});
		await act(() => result.current.cancel());

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(output).not.toHaveBeenCalled();
	});

	test("assets created while the discard prompt is open win", async () => {
		let discard: (value: boolean) => void = () => undefined;
		const { result, output } = setUp(
			() =>
				new Promise((resolve) => {
					discard = resolve;
				}),
		);

		act(() => {
			result.current.setIsUploading(true);
		});
		let cancelled: Promise<void> = Promise.resolve();
		act(() => {
			cancelled = result.current.cancel();
		});
		act(() => {
			result.current.created(
				[
					asset as never,
				],
				"zed-created",
			);
		});
		discard(true);
		await act(() => cancelled);

		expect(outputs(output)).toEqual([
			"saved",
		]);
	});

	test("assets created after Cancel answered change nothing", async () => {
		const { result, output } = setUp();

		await act(() => result.current.cancel());
		act(() => {
			result.current.created(
				[
					asset as never,
				],
				"zed-created",
			);
		});

		expect(outputs(output)).toEqual([
			"cancelled",
		]);
	});
});
