import { describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useUploadAnswer } from "./use-upload-answer";

const asset = {
	id: "00000000-0000-4000-8000-000000000001",
	title: "APA 7.pdf",
} as const;

const setUp = (confirmDiscard: () => Promise<boolean> = async () => true) => {
	const addToolOutput = mock(async (_: unknown) => undefined);
	const keepZedToken = mock((_: string | undefined) => undefined);
	const { result } = renderHook(() =>
		useUploadAnswer({
			toolCallId: "upload-1",
			actions: {
				addToolOutput: addToolOutput as never,
				keepZedToken,
			},
			confirmDiscard,
		}),
	);

	return {
		result,
		addToolOutput,
		keepZedToken,
	};
};

const outputs = (addToolOutput: ReturnType<typeof mock>) =>
	addToolOutput.mock.calls.map(
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
	test("a save answers with the assets and keeps its zedToken", () => {
		const { result, addToolOutput, keepZedToken } = setUp();

		act(() => {
			result.current.save(
				[
					asset as never,
				],
				"zed-saved",
			);
		});

		expect(addToolOutput.mock.calls[0]?.[0]).toEqual({
			tool: "requestUpload",
			toolCallId: "upload-1",
			output: {
				status: "saved",
				assets: [
					asset,
				],
			},
		});
		expect(keepZedToken).toHaveBeenCalledWith("zed-saved");
	});

	test("Cancel waits while the save runs", async () => {
		const { result, addToolOutput } = setUp();

		act(() => {
			result.current.setIsSaving(true);
		});
		await act(() => result.current.cancel());
		expect(addToolOutput).not.toHaveBeenCalled();

		act(() => {
			result.current.setIsSaving(false);
			result.current.save(
				[
					asset as never,
				],
				undefined,
			);
		});
		expect(outputs(addToolOutput)).toEqual([
			"saved",
		]);
	});

	test("asks before discarding uploads and stays when the user stays", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, addToolOutput } = setUp(confirmDiscard);

		act(() => {
			result.current.setHasPendingUploads(true);
		});
		await act(() => result.current.cancel());

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(addToolOutput).not.toHaveBeenCalled();
	});

	test("a save that lands while the discard prompt is open wins", async () => {
		let discard: (value: boolean) => void = () => undefined;
		const { result, addToolOutput } = setUp(
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

		expect(outputs(addToolOutput)).toEqual([
			"saved",
		]);
	});

	test("a save after Cancel answered changes nothing", async () => {
		const { result, addToolOutput, keepZedToken } = setUp();

		await act(() => result.current.cancel());
		act(() => {
			result.current.save(
				[
					asset as never,
				],
				"zed-saved",
			);
		});

		expect(outputs(addToolOutput)).toEqual([
			"cancelled",
		]);
		expect(keepZedToken).not.toHaveBeenCalledWith("zed-saved");
	});
});
