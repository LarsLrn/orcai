import { describe, expect, mock, test } from "bun:test";
import type { AssetId } from "@orcai/core";
import type { KeptUploads } from "@orcai/schema";
import { act, renderHook } from "@testing-library/react";
import { useUploadAnswer } from "./use-upload-answer";

const apa = {
	id: "00000000-0000-4000-8000-000000000001" as AssetId,
	title: "APA 7.pdf",
};

const mla = {
	id: "00000000-0000-4000-8000-000000000002" as AssetId,
	title: "MLA.pdf",
};

const titles: Record<string, string> = {
	[apa.id]: apa.title,
	[mla.id]: mla.title,
};

type KeepInput = {
	toolCallId: string;
	assetIds: AssetId[];
	zedToken: string | undefined;
};

/** Stores what it is given, keeping only the assets it knows, as the server does. */
const storing = (input: KeepInput): Promise<KeptUploads> =>
	Promise.resolve({
		assets: input.assetIds.flatMap((id) =>
			titles[id]
				? [
						{
							id,
							title: titles[id],
						},
					]
				: [],
		),
		zedToken: input.zedToken,
	});

const setUp = ({
	confirmDiscard = async () => true,
	kept,
	keep = storing,
}: {
	confirmDiscard?: () => Promise<boolean>;
	kept?: KeptUploads;
	keep?: (input: KeepInput) => Promise<KeptUploads>;
} = {}) => {
	const output = mock((_: unknown) => undefined);
	const keepUploads = mock(keep);
	const { result } = renderHook(() =>
		useUploadAnswer({
			toolCallId: "upload-1",
			answers: {
				approve: () => undefined,
				output,
				continue: async () => undefined,
				uploads: () => kept,
				keepUploads,
			},
			confirmDiscard,
		}),
	);

	return {
		result,
		output,
		keepUploads,
	};
};

const outputs = (output: ReturnType<typeof mock>) =>
	output.mock.calls.map(
		([call]) =>
			(
				call as {
					output: unknown;
				}
			).output,
	);

describe("useUploadAnswer", () => {
	test("each change is kept, and only Continue answers, with the stored list", async () => {
		const { result, output, keepUploads } = setUp();

		await act(async () => {
			result.current.created(
				[
					apa,
				],
				"zed-apa",
			);
		});
		await act(async () => {
			result.current.created(
				[
					mla,
				],
				"zed-mla",
			);
		});

		expect(output).not.toHaveBeenCalled();
		expect(keepUploads.mock.calls.at(-1)?.[0]).toEqual({
			toolCallId: "upload-1",
			assetIds: [
				apa.id,
				mla.id,
			],
			zedToken: "zed-mla",
		});

		await act(() => result.current.continue());

		expect(output.mock.calls[0]?.[0]).toEqual({
			tool: "requestUpload",
			toolCallId: "upload-1",
			output: {
				status: "saved",
				assets: [
					apa,
					mla,
				],
			},
			zedToken: "zed-mla",
		});
	});

	test("a removed upload leaves the list and the answer", async () => {
		const { result, output, keepUploads } = setUp();

		await act(async () => {
			result.current.created(
				[
					apa,
					mla,
				],
				"zed-created",
			);
		});
		await act(async () => {
			result.current.removed(apa.id);
		});
		await act(() => result.current.continue());

		expect(keepUploads.mock.calls[1]?.[0]).toMatchObject({
			assetIds: [
				mla.id,
			],
		});
		expect(outputs(output)).toEqual([
			{
				status: "saved",
				assets: [
					mla,
				],
			},
		]);
	});

	test("a reload restores the kept list and its zedToken", async () => {
		const { result, output } = setUp({
			kept: {
				assets: [
					apa,
				],
				zedToken: "zed-kept",
			},
		});

		expect(result.current.initialAssetIds).toEqual([
			apa.id,
		]);

		await act(() => result.current.continue());

		expect(output.mock.calls[0]?.[0]).toMatchObject({
			output: {
				status: "saved",
				assets: [
					apa,
				],
			},
			zedToken: "zed-kept",
		});
	});

	test("Continue answers only with the files still there, and not at all when none are", async () => {
		const deleted = {
			id: "00000000-0000-4000-8000-000000000009" as AssetId,
			title: "Deleted elsewhere.pdf",
		};
		const partly = setUp({
			kept: {
				assets: [
					apa,
					deleted,
				],
			},
		});

		await act(() => partly.result.current.continue());

		expect(outputs(partly.output)).toEqual([
			{
				status: "saved",
				assets: [
					apa,
				],
			},
		]);

		const none = setUp({
			kept: {
				assets: [
					deleted,
				],
			},
		});

		await act(() => none.result.current.continue());

		expect(none.output).not.toHaveBeenCalled();
		expect(none.result.current.problem).toBe("gone");
	});

	test("a failed save shows as unsaved, blocks Continue and clears on retry", async () => {
		let online = false;
		const { result, output } = setUp({
			keep: (input) =>
				online ? storing(input) : Promise.reject(new Error("offline")),
		});

		await act(async () => {
			result.current.created(
				[
					apa,
				],
				undefined,
			);
		});
		expect(result.current.problem).toBe("unsaved");

		await act(() => result.current.continue());
		expect(output).not.toHaveBeenCalled();
		expect(result.current.problem).toBe("unsaved");

		online = true;
		await act(async () => {
			result.current.retry();
		});
		expect(result.current.problem).toBeUndefined();

		await act(() => result.current.continue());
		expect(outputs(output)).toEqual([
			{
				status: "saved",
				assets: [
					apa,
				],
			},
		]);
	});

	test("a change while Continue saves keeps the call waiting", async () => {
		let hold: Promise<void> = Promise.resolve();
		const { result, output } = setUp({
			keep: async (input) => {
				await hold;
				return storing(input);
			},
		});
		await act(async () => {
			result.current.created(
				[
					apa,
					mla,
				],
				undefined,
			);
		});
		const { promise, resolve } = Promise.withResolvers<void>();
		hold = promise;

		let continued: Promise<void> = Promise.resolve();
		act(() => {
			continued = result.current.continue();
		});
		act(() => {
			result.current.removed(apa.id);
		});
		resolve();
		await act(() => continued);

		expect(output).not.toHaveBeenCalled();
	});

	test("Continue with nothing listed or during an upload does not answer", async () => {
		const { result, output, keepUploads } = setUp();

		await act(() => result.current.continue());
		await act(async () => {
			result.current.created(
				[
					apa,
				],
				undefined,
			);
			result.current.setIsUploading(true);
		});
		await act(() => result.current.continue());

		expect(output).not.toHaveBeenCalled();
		expect(keepUploads).toHaveBeenCalledTimes(1);
	});

	test("Cancel before any upload answers without asking", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, output } = setUp({
			confirmDiscard,
		});

		await act(() => result.current.cancel());

		expect(confirmDiscard).not.toHaveBeenCalled();
		expect(outputs(output)).toEqual([
			{
				status: "cancelled",
			},
		]);
	});

	test("Cancel after uploads answers cancelled", async () => {
		const { result, output } = setUp();

		await act(async () => {
			result.current.created(
				[
					apa,
				],
				undefined,
			);
		});
		await act(() => result.current.cancel());

		expect(outputs(output)).toEqual([
			{
				status: "cancelled",
			},
		]);
	});

	test("Cancel during an upload asks and stays when the user stays", async () => {
		const confirmDiscard = mock(async () => false);
		const { result, output } = setUp({
			confirmDiscard,
		});

		act(() => {
			result.current.setIsUploading(true);
		});
		await act(() => result.current.cancel());

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(output).not.toHaveBeenCalled();
	});

	test("nothing changes after the call is answered", async () => {
		const { result, output, keepUploads } = setUp();

		await act(() => result.current.cancel());
		await act(async () => {
			result.current.created(
				[
					apa,
				],
				undefined,
			);
			await result.current.continue();
		});

		expect(keepUploads).not.toHaveBeenCalled();
		expect(outputs(output)).toEqual([
			{
				status: "cancelled",
			},
		]);
	});
});
