import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AssetId, ModelId, ProviderId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { AssetIntakeOutcome } from "@/components/assets/use-asset-intake";

const intake = mock(
	async (_files: File[]): Promise<AssetIntakeOutcome> => ({
		assets: [],
		failures: [],
		zedToken: undefined,
	}),
);

mock.module("@/components/assets/use-asset-intake", () => ({
	useAssetIntake: () => ({
		intake,
		reset: () => undefined,
		isPending: false,
	}),
}));
mock.module("@/components/chat/usage/usage-indicator", () => ({
	UsageIndicator: () => null,
}));
mock.module("@/components/chat/chat-asset-picker", () => ({
	ChatAssetPicker: () => null,
}));
mock.module("@/components/chat/chat-model-notice", () => ({
	ChatModelNotice: () => null,
}));

const { Composer } = await import("./composer");

const assetOf = (name: string) =>
	({
		id: crypto.randomUUID() as AssetId,
		title: name,
		fileType: "txt",
		size: 4,
	}) as Asset;

const fileOf = (name: string) =>
	new File(
		[
			"text",
		],
		name,
		{
			type: "text/plain",
		},
	);

const composer = (onSend: (draft: unknown) => Promise<boolean>) => {
	const view = render(
		<Composer
			onSend={onSend}
			model={{
				modelId: crypto.randomUUID() as ModelId,
				providerId: crypto.randomUUID() as ProviderId,
			}}
			tools={() => null}
		/>,
	);
	const fileInput = view.container.querySelector(
		"input[type=file]",
	) as HTMLInputElement;
	const textarea = screen.getByRole("textbox");
	return {
		attach: (...files: File[]) =>
			fireEvent.change(fileInput, {
				target: {
					files,
				},
			}),
		type: (text: string) =>
			fireEvent.change(textarea, {
				target: {
					value: text,
				},
			}),
		submit: () =>
			act(async () => {
				textarea.closest("form")?.requestSubmit();
				// The submit handler goes on once the upload settles.
				await intake.mock.results.at(-1)?.value;
			}),
		pressEnter: (init: { isComposing?: boolean; keyCode?: number } = {}) =>
			act(async () => {
				fireEvent.keyDown(textarea, {
					key: "Enter",
					...init,
				});
				await intake.mock.results.at(-1)?.value;
			}),
		textarea,
	};
};

beforeEach(() => {
	intake.mockReset();
});

afterEach(cleanup);

describe("Composer", () => {
	test("a failed upload keeps the draft and the failed file and starts no chat", async () => {
		const broken = fileOf("broken.txt");
		intake.mockResolvedValueOnce({
			assets: [
				assetOf("notes.txt"),
			],
			failures: [
				{
					file: broken,
					name: "broken.txt",
					message: "Too large",
				},
			],
			zedToken: undefined,
		});
		const onSend = mock(async () => true);
		const view = composer(onSend);

		view.attach(fileOf("notes.txt"), broken);
		view.type("Summarise these");
		await view.submit();

		await waitFor(() => expect(intake).toHaveBeenCalledTimes(1));
		expect(onSend).not.toHaveBeenCalled();
		expect((view.textarea as HTMLTextAreaElement).value).toBe(
			"Summarise these",
		);
		expect(screen.getByText("broken.txt")).toBeTruthy();
		expect(screen.getByText("notes.txt")).toBeTruthy();
	});

	test("a retry after a failed chat creation reuses the uploaded files", async () => {
		const notes = assetOf("notes.txt");
		intake.mockResolvedValueOnce({
			assets: [
				notes,
			],
			failures: [],
			zedToken: undefined,
		});
		const onSend = mock(async (_draft: unknown) => false);
		const view = composer(onSend);

		view.attach(fileOf("notes.txt"));
		view.type("Summarise this");
		await view.submit();
		await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

		onSend.mockResolvedValueOnce(true);
		await view.submit();

		await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
		expect(intake).toHaveBeenCalledTimes(1);
		expect(onSend.mock.calls[1]?.[0]).toEqual({
			text: "Summarise this",
			attachments: [
				expect.objectContaining({
					assetId: notes.id,
				}),
			],
		});
	});

	test("of two same-named files, the retry uploads the one that failed", async () => {
		const first = fileOf("notes.txt");
		const second = fileOf("notes.txt");
		const uploaded = assetOf("notes.txt");
		intake.mockResolvedValueOnce({
			assets: [
				uploaded,
			],
			failures: [
				{
					file: second,
					name: "notes.txt",
					message: "Too large",
				},
			],
			zedToken: undefined,
		});
		const onSend = mock(async (_draft: unknown) => true);
		const view = composer(onSend);

		view.attach(first, second);
		view.type("Compare these");
		await view.submit();
		await waitFor(() => expect(intake).toHaveBeenCalledTimes(1));
		expect(onSend).not.toHaveBeenCalled();

		const retried = assetOf("notes.txt");
		intake.mockResolvedValueOnce({
			assets: [
				retried,
			],
			failures: [],
			zedToken: undefined,
		});
		await view.submit();

		await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
		expect(intake.mock.calls[1]?.[0]).toHaveLength(1);
		expect(intake.mock.calls[1]?.[0][0]).toBe(second);
		expect(onSend.mock.calls[0]?.[0]).toEqual({
			text: "Compare these",
			attachments: [
				expect.objectContaining({
					assetId: uploaded.id,
				}),
				expect.objectContaining({
					assetId: retried.id,
				}),
			],
		});
	});

	test("Enter sends, but not while it confirms an IME composition", async () => {
		const onSend = mock(async (_draft: unknown) => true);
		const view = composer(onSend);

		view.type("こんにちは");
		await view.pressEnter({
			isComposing: true,
		});
		expect(onSend).not.toHaveBeenCalled();
		// Safari's confirming keydown comes after the composition, as key code 229.
		await view.pressEnter({
			keyCode: 229,
		});
		expect(onSend).not.toHaveBeenCalled();
		expect((view.textarea as HTMLTextAreaElement).value).toBe("こんにちは");

		await view.pressEnter();
		await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
		expect(onSend.mock.calls[0]?.[0]).toEqual({
			text: "こんにちは",
			attachments: [],
		});
		expect((view.textarea as HTMLTextAreaElement).value).toBe("");
	});

	const pendingSend = async () => {
		const notes = assetOf("notes.txt");
		intake.mockResolvedValueOnce({
			assets: [
				notes,
			],
			failures: [],
			zedToken: undefined,
		});
		const send = Promise.withResolvers<boolean>();
		const onSend = mock((_draft: unknown) => send.promise);
		const view = composer(onSend);

		view.attach(fileOf("notes.txt"));
		view.type("Summarise this");
		await view.submit();
		await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
		const settle = (outcome: () => void) =>
			act(async () => {
				const settled = send.promise.catch(() => undefined);
				outcome();
				await settled;
			});
		return {
			view,
			reach: () => settle(() => send.resolve(true)),
			miss: () => settle(() => send.resolve(false)),
			refuse: () => settle(() => send.reject(new Error("Network down"))),
		};
	};

	const value = (view: ReturnType<typeof composer>) =>
		(view.textarea as HTMLTextAreaElement).value;

	test("a sent message leaves the composer at once and stays out once it reached the transcript", async () => {
		const { view, reach } = await pendingSend();

		expect(value(view)).toBe("");
		expect(screen.queryByText("notes.txt")).toBeNull();
		await reach();
		expect(value(view)).toBe("");
		expect(screen.queryByText("notes.txt")).toBeNull();
	});

	test("a refused send, or one stopped before it reached the transcript, comes back into an empty composer", async () => {
		for (const end of [
			"refuse",
			"miss",
		] as const) {
			const pending = await pendingSend();

			await pending[end]();
			expect(value(pending.view)).toBe("Summarise this");
			expect(screen.getByText("notes.txt")).toBeTruthy();
			cleanup();
		}
	});

	test("a refused send keeps what the user wrote meanwhile", async () => {
		const { view, refuse } = await pendingSend();

		view.type("Something else");
		await refuse();
		expect(value(view)).toBe("Something else");
		expect(screen.queryByText("notes.txt")).toBeNull();
	});
});
