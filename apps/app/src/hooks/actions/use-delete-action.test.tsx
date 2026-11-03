import { afterEach, describe, expect, mock, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { ConfirmDialogProvider } from "@/components/ui/dialog/confirm-dialog";
import { ReasonError } from "@/lib/errors/reason-error";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { createQueryClient } from "@/lib/orpc/query-client";
import { m } from "@/paraglide/messages";
import { useDeleteAction } from "./use-delete-action";

const copy = {
	loading: ({ count }: { count: number }) => `Deleting ${String(count)}`,
	success: ({ count }: { count: number }) => `Deleted ${String(count)}`,
	error: ({ count }: { count: number }) => `Could not delete ${String(count)}`,
	title: ({ count }: { count: number }) => `Delete ${String(count)} items?`,
	namedTitle: ({ name }: { name: string }) => `Delete ${name}?`,
	description: () => "This cannot be undone.",
	confirmText: () => "Delete",
};

const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={createQueryClient()}>
		<ConfirmDialogProvider>
			{children}
			<Toaster />
		</ConfirmDialogProvider>
	</QueryClientProvider>
);

const renderDelete = (
	mutationFn: (input: {
		refs: {
			id: string;
		}[];
	}) => Promise<unknown>,
	names?: string[],
) =>
	renderHook(
		() =>
			useDeleteAction({
				mutationOptions: () => ({
					mutationFn,
				}),
				copy,
				target: {
					names,
				},
			}),
		{
			wrapper,
		},
	);

const oneRef = {
	refs: [
		{
			id: "a",
		},
	],
};

/** Starts an action inside `act`, so its confirm renders. */
const start = <T,>(run: () => Promise<T>) => {
	let started: Promise<T> | undefined;
	act(() => {
		started = run();
	});
	return started as Promise<T>;
};

/** Awaits an action inside `act`, so its state settles before the next assertion. */
const settle = async <T,>(outcome: Promise<T>) => {
	let settled: T | undefined;
	await act(async () => {
		settled = await outcome;
	});
	return settled as T;
};

// Sonner keeps its toasts in a module-level store.
afterEach(() => {
	cleanup();
	toast.dismiss();
});

describe("useDeleteAction", () => {
	test("deletes once the confirm naming the single target is accepted", async () => {
		const mutationFn = mock(async () => ({}));
		const { result } = renderDelete(mutationFn, [
			"Ada",
		]);

		const outcome = start(() => result.current.mutateAsync(oneRef));
		await screen.findByText("Delete Ada?");
		expect(mutationFn).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", {
				name: "Delete",
			}),
		);

		expect((await settle(outcome)).status).toBe("success");
		expect(mutationFn).toHaveBeenCalledTimes(1);
		await screen.findByText("Deleted 1");
	});

	test("counts every ref it deletes", async () => {
		const { result } = renderDelete(async () => ({}));

		const outcome = start(() =>
			result.current.mutateAsync({
				refs: [
					{
						id: "a",
					},
					{
						id: "b",
					},
				],
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Delete",
			}),
		);

		expect((await settle(outcome)).status).toBe("success");
		await screen.findByText("Deleted 2");
	});

	test("leaves the items when the confirm is cancelled", async () => {
		const mutationFn = mock(async () => ({}));
		const { result } = renderDelete(mutationFn);

		const outcome = start(() =>
			result.current.mutateAsync({
				refs: [
					{
						id: "a",
					},
					{
						id: "b",
					},
				],
			}),
		);
		await screen.findByText("Delete 2 items?");
		fireEvent.click(
			screen.getByRole("button", {
				name: m.common_cancel_button(),
			}),
		);

		expect((await settle(outcome)).status).toBe("cancelled");
		expect(mutationFn).not.toHaveBeenCalled();
	});

	test("a failed delete shows one error toast with its reason", async () => {
		const { result } = renderDelete(() =>
			Promise.reject(new ReasonError("MODEL_NOT_FOUND")),
		);

		const outcome = start(() => result.current.mutateAsync(oneRef));
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Delete",
			}),
		);

		expect((await settle(outcome)).status).toBe("error");
		await screen.findByText("Could not delete 1");
		await waitFor(() =>
			expect(
				screen.getAllByText(reasonMessage("MODEL_NOT_FOUND", undefined)),
			).toHaveLength(1),
		);
	});
});
