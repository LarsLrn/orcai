import { afterEach, describe, expect, mock, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { createQueryClient } from "@/lib/orpc/query-client";
import { m } from "@/paraglide/messages";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		assistant: {
			create: {
				mutationOptions: () => ({
					mutationFn: async () => ({
						data: {
							id: "chat-1",
						},
						meta: {},
					}),
				}),
			},
		},
	},
}));
mock.module("@/components/assistant/use-assistant-model", () => ({
	useAssistantModel: () => ({
		availability: "set",
		modelId: "model-1",
		providerId: "provider-1",
	}),
}));
mock.module("@/components/quota/use-quota-status", () => ({
	useQuotaStatus: () => ({
		data: undefined,
	}),
}));

const { useAssistantStarter } = await import("./use-assistant-starter");

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={createQueryClient()}>
		{children}
		<Toaster />
	</QueryClientProvider>
);

// Sonner keeps its toasts in a module-level store.
afterEach(() => {
	cleanup();
	toast.dismiss();
});

describe("useAssistantStarter", () => {
	test("a conversation that cannot be opened keeps the draft and shows the start failure once", async () => {
		const onConversationCreated = mock(() =>
			Promise.reject(new Error("navigation failed")),
		);
		const { result } = renderHook(
			() =>
				useAssistantStarter({
					onConversationCreated,
				}),
			{
				wrapper,
			},
		);

		let sent: boolean | undefined;
		await act(async () => {
			sent = await result.current.handleSend("Hello");
		});

		expect(sent).toBe(false);
		expect(onConversationCreated).toHaveBeenCalledWith(
			"chat-1",
			"Hello",
			undefined,
		);
		await waitFor(() =>
			expect(
				screen.getAllByText(m.assistant_starter_create_failed_toast_error()),
			).toHaveLength(1),
		);
	});
});
