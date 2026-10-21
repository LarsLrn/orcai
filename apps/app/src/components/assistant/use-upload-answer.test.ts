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
	test("a save answers with the assets and the zedToken it returned", () => {
		const { result, output } = setUp();

		act(() => {
			result.current.save(
				[
					asset as never,
				],
				"zed-saved",
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
			zedToken: "zed-saved",
		});
	});

	test("Cancel waits while the save runs", async () => {
		const { result, output } = setUp();

		act(() => {
			result.current.setIsSaving(true);
		});
		await act(() => result.current.cancel());
		expect(output).not.toHaveBeenCalled();

		act(() => {
			result.current.setIsSaving(false);
			result.current.save(
				[
					asset as never,
				],
				undefined,
			);
		});
		expect(outputs(output)).toEqual([
			"saved",
		]);
	});

	test("asks before discarding uploads and stays when the user stays", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, output } = setUp(confirmDiscard);

		act(() => {
			result.current.setHasPendingUploads(true);
		});
		await act(() => result.current.cancel());

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(output).not.toHaveBeenCalled();
	});

	test("a save that lands while the discard prompt is open wins", async () => {
		let discard: (value: boolean) => void = () => undefined;
		const { result, output } = setUp(
			() =>
				new Promise((resolve) => {
					discard = resolve;
				}),
		);

		act(() => {
			result.current.setHasPendingUploads(true);
		});
		let cancelled: Promise<void> = Promise.resolve();
		act(() => {
			cancelled = result.current.cancel();
		});
		act(() => {
			result.current.save(
				[
					asset as never,
				],
				"zed-saved",
			);
		});
		discard(true);
		await act(() => cancelled);

		expect(outputs(output)).toEqual([
			"saved",
		]);
	});

	test("a save after Cancel answered changes nothing", async () => {
		const { result, output } = setUp();

		await act(() => result.current.cancel());
		act(() => {
			result.current.save(
				[
					asset as never,
				],
				"zed-saved",
			);
		});

		expect(outputs(output)).toEqual([
			"cancelled",
		]);
	});
});
