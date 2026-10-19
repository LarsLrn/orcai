import { isDefinedError, type ORPCError } from "@orpc/client";
import {
	type UseMutationOptions,
	type UseMutationResult,
	useMutation,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	type ConfirmOptions,
	useConfirm,
} from "@/components/ui/dialog/confirm-dialog";
import { reasonMessageOf } from "@/lib/errors/describe-error";

const isDefinedORPCError = (error: unknown) => {
	const maybeError = error as ORPCError<string, unknown>;

	return isDefinedError(maybeError);
};

export const MUTATION_ACTION_CANCELLED = "cancelled" as const;

export type MutationActionCancelled = {
	status: typeof MUTATION_ACTION_CANCELLED;
};

export type MutationActionSuccess<TData> = {
	status: "success";
	data: TData;
};

export type MutationActionDefinedError<TError> = {
	status: "error";
	error: Extract<TError, ORPCError<string, unknown>>;
	isDefinedError: true;
};

export type MutationActionUnhandledError<TError> = {
	status: "error";
	error: TError;
	isDefinedError: false;
};

export type MutationActionError<TError> =
	| MutationActionDefinedError<TError>
	| MutationActionUnhandledError<TError>;

type MessageResolver<TArgs> = string | ((args: TArgs) => string);

type MutationActionMessages<TData, TError, TVariables> = {
	loading: MessageResolver<{
		input: TVariables;
	}>;
	success: MessageResolver<{
		input: TVariables;
		data: TData;
	}>;
	error: MessageResolver<{
		input: TVariables;
		error: TError;
	}>;
};

const resolveMessage = <TArgs>(
	message: MessageResolver<TArgs>,
	args: TArgs,
) => {
	if (typeof message === "function") {
		return message(args);
	}

	return message;
};

/**
 * Mutation action with built-in toast + optional confirmation flow.
 */
type MutationActionConfig<TData, TError, TVariables, TContext> = {
	mutationOptions: () => UseMutationOptions<
		TData,
		TError,
		TVariables,
		TContext
	>;
	messages: MutationActionMessages<TData, TError, TVariables>;
	confirm?: ConfirmOptions | ((input: TVariables) => ConfirmOptions);
};

type MutationActionState<TData, TError, TVariables, TContext> = Pick<
	UseMutationResult<TData, TError, TVariables, TContext>,
	| "data"
	| "error"
	| "variables"
	| "status"
	| "isIdle"
	| "isPending"
	| "isSuccess"
	| "isError"
	| "failureCount"
	| "failureReason"
	| "submittedAt"
	| "reset"
>;

type MutationActionResult<TData, TError, TVariables, TContext, TResult> =
	MutationActionState<TData, TError, TVariables, TContext> & {
		/**
		 * Fire-and-forget mutation.
		 * Useful when you only need side effects (toast/state), not the result.
		 */
		mutate: (input: TVariables) => void;
		/**
		 * Runs the mutation and resolves with its result.
		 * Never throws; returns a status union.
		 */
		mutateAsync: (input: TVariables) => Promise<TResult>;
	};

/**
 * Action wrapper around TanStack Query `useMutation` with:
 * - normalized loading/success/error toasts
 * - optional confirmation dialog before mutation
 * - a reduced return shape focused on action ergonomics
 */
export function useMutationAction<
	TData,
	TError,
	TVariables,
	TContext = unknown,
>(
	config: MutationActionConfig<TData, TError, TVariables, TContext> & {
		confirm: ConfirmOptions | ((input: TVariables) => ConfirmOptions);
	},
): MutationActionResult<
	TData,
	TError,
	TVariables,
	TContext,
	| MutationActionSuccess<TData>
	| MutationActionError<TError>
	| MutationActionCancelled
>;
export function useMutationAction<
	TData,
	TError,
	TVariables,
	TContext = unknown,
>(
	config: MutationActionConfig<TData, TError, TVariables, TContext> & {
		confirm?: undefined;
	},
): MutationActionResult<
	TData,
	TError,
	TVariables,
	TContext,
	MutationActionSuccess<TData> | MutationActionError<TError>
>;
export function useMutationAction<
	TData,
	TError,
	TVariables,
	TContext = unknown,
>(config: MutationActionConfig<TData, TError, TVariables, TContext>) {
	const confirm = useConfirm();
	const mutation = useMutation<TData, TError, TVariables, TContext>(
		config.mutationOptions(),
	);
	// Query reports `isPending` and `variables` a tick late; this marks a button busy before a second click lands.
	const [starting, setStarting] = useState<{
		input: TVariables;
	} | null>(null);

	const mutateAsync = async (input: TVariables) => {
		if (config.confirm) {
			const confirmOptions =
				typeof config.confirm === "function"
					? config.confirm(input)
					: config.confirm;
			const isConfirmed = await confirm(confirmOptions);

			if (!isConfirmed) {
				return {
					status: MUTATION_ACTION_CANCELLED,
				} as MutationActionCancelled;
			}
		}

		setStarting({
			input,
		});
		const toastPromise = toast.promise(mutation.mutateAsync(input), {
			loading: resolveMessage(config.messages.loading, {
				input,
			}),
			success: (data) =>
				resolveMessage(config.messages.success, {
					input,
					data,
				}),
			// The hook's own copy is the title; a translated reason is the detail.
			error: (error) => ({
				message: resolveMessage(config.messages.error, {
					input,
					error: error as TError,
				}),
				description: reasonMessageOf(error),
			}),
		});

		try {
			const data = (await toastPromise.unwrap()) as TData;

			return {
				status: "success",
				data,
			} as MutationActionSuccess<TData>;
		} catch (error) {
			if (isDefinedORPCError(error)) {
				return {
					status: "error",
					error: error as Extract<TError, ORPCError<string, unknown>>,
					isDefinedError: true,
				} as MutationActionDefinedError<TError>;
			}

			return {
				status: "error",
				error: error as TError,
				isDefinedError: false,
			} as MutationActionUnhandledError<TError>;
		} finally {
			setStarting(null);
		}
	};

	const mutate = (input: TVariables) => {
		void mutateAsync(input);
	};

	return {
		mutate,
		mutateAsync,
		data: mutation.data,
		error: mutation.error,
		variables: starting ? starting.input : mutation.variables,
		status: mutation.status,
		isIdle: mutation.isIdle,
		isPending: mutation.isPending || starting !== null,
		isSuccess: mutation.isSuccess,
		isError: mutation.isError,
		failureCount: mutation.failureCount,
		failureReason: mutation.failureReason,
		submittedAt: mutation.submittedAt,
		reset: mutation.reset,
	} as MutationActionResult<
		TData,
		TError,
		TVariables,
		TContext,
		| MutationActionSuccess<TData>
		| MutationActionError<TError>
		| MutationActionCancelled
	>;
}
