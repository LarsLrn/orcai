import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	type ConfirmOptions,
	useConfirm,
} from "@/components/ui/dialog/confirm-dialog";

type ActionMessages = {
	loading: string;
	success: string;
	error: string;
};

type MutationOptionsFactory = (
	...args: any[]
) => UseMutationOptions<any, any, any, any>;

type MutationInput<TFactory extends MutationOptionsFactory> =
	ReturnType<TFactory> extends UseMutationOptions<any, any, infer TInput, any>
		? TInput
		: never;

type MutationResult<TFactory extends MutationOptionsFactory> =
	ReturnType<TFactory> extends UseMutationOptions<infer TResult, any, any, any>
		? TResult
		: never;

type MutationActionConfig<TFactory extends MutationOptionsFactory> = {
	mutationOptions: TFactory;
	messages: ActionMessages;
	confirm?:
		| ConfirmOptions
		| ((input: MutationInput<TFactory>) => ConfirmOptions);
	onSuccess?: (
		result: MutationResult<TFactory>,
		input: MutationInput<TFactory>,
	) => void | Promise<void>;
};

type RunOptions<TFactory extends MutationOptionsFactory> = {
	onSuccess?: (
		result: MutationResult<TFactory>,
		input: MutationInput<TFactory>,
	) => void | Promise<void>;
};

const getErrorDescription = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return undefined;
};

export const useMutationAction = <TFactory extends MutationOptionsFactory>(
	config: MutationActionConfig<TFactory>,
) => {
	const confirm = useConfirm();
	const mutation = useMutation(config.mutationOptions());

	const run = async (
		input: MutationInput<TFactory>,
		options?: RunOptions<TFactory>,
	) => {
		if (config.confirm) {
			const confirmOptions =
				typeof config.confirm === "function"
					? config.confirm(input)
					: config.confirm;
			const isConfirmed = await confirm(confirmOptions);

			if (!isConfirmed) {
				return;
			}
		}

		return toast.promise(mutation.mutateAsync(input), {
			loading: config.messages.loading,
			success: async (result) => {
				await config.onSuccess?.(result, input);
				await options?.onSuccess?.(result, input);
				return config.messages.success;
			},
			error: (error) => ({
				message: config.messages.error,
				description: getErrorDescription(error),
			}),
		});
	};

	return {
		run,
		...mutation,
	};
};
