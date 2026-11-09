import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ChatDraft } from "./chat-draft";
import { useOpeningMessage } from "./use-opening-message";

const opening: ChatDraft = {
	text: "Plan my week",
	attachments: [],
};

const branched: ChatDraft = {
	text: "Where the branch started",
	attachments: [],
};

const open = async (reached: boolean) => {
	const sent: unknown[] = [];
	const session = {
		sendFirst: (message: unknown) => {
			sent.push(message);
			return Promise.resolve(reached);
		},
	};
	const view = renderHook(() =>
		useOpeningMessage({
			session,
			pendingMessage: opening,
			draft: branched,
		}),
	);
	await waitFor(() => expect(sent).toHaveLength(1));
	return {
		sent,
		composerDraft: () => view.result.current,
	};
};

afterEach(cleanup);

describe("useOpeningMessage", () => {
	test("sends the opening message and leaves the composer's draft", async () => {
		const { sent, composerDraft } = await open(true);

		expect(sent).toEqual([
			{
				text: "Plan my week",
				metadata: undefined,
			},
		]);
		await Promise.resolve();
		expect(composerDraft()).toEqual({
			draft: branched,
			version: 0,
		});
	});

	test("an opening message that never reached the transcript comes back as the composer's draft", async () => {
		const { composerDraft } = await open(false);

		await waitFor(() =>
			expect(composerDraft()).toEqual({
				draft: opening,
				version: 1,
			}),
		);
	});
});
