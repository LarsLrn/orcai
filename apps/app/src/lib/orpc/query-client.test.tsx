import { afterEach, describe, expect, test } from "bun:test";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import {
	act,
	cleanup,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { ReasonError } from "@/lib/errors/reason-error";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { createQueryClient } from "./query-client";

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={createQueryClient()}>
		{children}
		<Toaster />
	</QueryClientProvider>
);

const failing = () => Promise.reject(new ReasonError("BOT_NOT_FOUND"));

// Sonner keeps its toasts in a module-level store.
afterEach(() => {
	cleanup();
	toast.dismiss();
});

describe("createQueryClient", () => {
	test("a failed mutation that names an error toast shows it once, with its reason", async () => {
		const { result } = renderHook(
			() =>
				useMutation({
					mutationFn: failing,
					meta: {
						errorToast: "Could not star the bot",
					},
				}),
			{
				wrapper,
			},
		);

		await act(async () => {
			await result.current.mutateAsync().catch(() => undefined);
		});

		await screen.findByText("Could not star the bot");
		await waitFor(() =>
			expect(
				screen.getAllByText(reasonMessage("BOT_NOT_FOUND", undefined)),
			).toHaveLength(1),
		);
	});

	test("a failed mutation without one stays silent", async () => {
		const { result } = renderHook(
			() => ({
				silent: useMutation({
					mutationFn: failing,
				}),
				named: useMutation({
					mutationFn: () => Promise.reject(new ReasonError("CHAT_NOT_FOUND")),
					meta: {
						errorToast: "Could not open the chat",
					},
				}),
			}),
			{
				wrapper,
			},
		);

		await act(async () => {
			await result.current.silent.mutateAsync().catch(() => undefined);
			await result.current.named.mutateAsync().catch(() => undefined);
		});

		// The later toast is up, so the earlier failure had its chance to show one.
		await screen.findByText("Could not open the chat");
		expect(
			Array.from(
				document.querySelectorAll("[data-sonner-toast]"),
				(toast) => toast.querySelector("[data-title]")?.textContent,
			),
		).toEqual([
			"Could not open the chat",
		]);
	});
});
