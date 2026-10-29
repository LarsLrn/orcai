import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AssetId, ModelId, ProviderId } from "@orcai/core";
import type { Asset } from "@orcai/schema";
import {
	QueryClient,
	QueryClientProvider,
	skipToken,
} from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { AssetIntakeOutcome } from "@/components/documents/use-asset-intake";

const intake = mock(
	async (_files: File[]): Promise<AssetIntakeOutcome> => ({
		assets: [],
		failures: [],
		zedToken: undefined,
	}),
);

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		bot: {
			find: {
				queryOptions: () => ({
					queryKey: [
						"bot.find",
					],
					queryFn: skipToken,
				}),
			},
		},
	},
}));
mock.module("@/components/documents/use-asset-intake", () => ({
	useAssetIntake: () => ({
		intake,
		reset: () => undefined,
		isPending: false,
	}),
}));
mock.module("@/components/chat/model-picker", () => ({
	ModelPicker: () => null,
}));
mock.module("@/components/chat/usage/usage-indicator", () => ({
	UsageIndicator: () => null,
}));
mock.module("@/components/chat/chat-asset-picker", () => ({
	ChatAssetPicker: () => null,
}));
mock.module("@/components/chat/bot-selector", () => ({
	BotSelectorButton: () => null,
}));
mock.module("@/components/chat/chat-model-notice", () => ({
	ChatModelNotice: () => null,
}));

const { NewChatInput } = await import("./new-chat-input");

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
		<QueryClientProvider client={new QueryClient()}>
			<NewChatInput
				selectedModelId={crypto.randomUUID() as ModelId}
				selectedProviderId={crypto.randomUUID() as ProviderId}
				onModelSelect={() => undefined}
				onSend={onSend}
				isCreating={false}
			/>
		</QueryClientProvider>,
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
		textarea,
	};
};

beforeEach(() => {
	intake.mockReset();
});

afterEach(cleanup);

describe("NewChatInput", () => {
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
});
