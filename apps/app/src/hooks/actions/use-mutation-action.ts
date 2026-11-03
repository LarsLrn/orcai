import {
	type MutationFunction,
	type MutationFunctionContext,
	type UseMutationOptions,
	useMutation,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	type ConfirmOptions,
	useConfirm,
} from "@/components/ui/dialog/confirm-dialog";
import { reasonMessageOf } from "@/lib/errors/describe-error";

export type MutationActionResult<TData, TError> =
	| {
			status: "success";
			data: TData;
	  }
	| {
			status: "error";
			error: TError;
	  }
	| {
			status: "cancelled";
	  };

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

const resolveMessage = <TArgs>(message: MessageResolver<TArgs>, args: TArgs) =>
	typeof message === "function" ? message(args) : message;

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

/**
 * Runs a mutation behind an optional confirm, with loading, success and error
 * toasts. `mutateAsync` never throws; it resolves with a status.
 */
export function useMutationAction<
	TData,
	TError,
	TVariables,
	TContext = unknown,
>(config: MutationActionConfig<TData, TError, TVariables, TContext>) {
	const confirm = useConfirm();
	const mutation = useMutation(config.mutationOptions());
	// Query reports `isPending` and `variables` a tick late; this marks a button busy before a second click lands.
	const [starting, setStarting] = useState<{
		input: TVariables;
	} | null>(null);

	const mutateAsync = async (
		input: TVariables,
	): Promise<MutationActionResult<TData, TError>> => {
		if (config.confirm) {
			const confirmed = await confirm(
				typeof config.confirm === "function"
					? config.confirm(input)
					: config.confirm,
			);
			if (!confirmed) {
				return {
					status: "cancelled",
				};
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
			error: (error: TError) => ({
				message: resolveMessage(config.messages.error, {
					input,
					error,
				}),
				description: reasonMessageOf(error),
			}),
		});

		try {
			return {
				status: "success",
				data: await toastPromise.unwrap(),
			};
		} catch (error) {
			return {
				status: "error",
				error: error as TError,
			};
		} finally {
			setStarting(null);
		}
	};

	return {
		mutate: (input: TVariables) => {
			void mutateAsync(input);
		},
		mutateAsync,
		variables: starting ? starting.input : mutation.variables,
		isPending: mutation.isPending || starting !== null,
		isSuccess: mutation.isSuccess,
	};
}

/**
 * Calls a procedure through its mutation options inside another mutation, so
 * the queries it makes stale are invalidated.
 */
export const callProcedure =
	<TInput, TOutput>(
		options: {
			mutationFn?: MutationFunction<TOutput, TInput>;
		},
		context: MutationFunctionContext,
	) =>
	(input: TInput) => {
		if (!options.mutationFn) {
			throw new Error("Procedure mutation options lack a mutationFn");
		}
		return options.mutationFn(input, context);
	};
