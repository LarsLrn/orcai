import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type ActionMessages = {
	loading: string;
	success: string;
	error: string;
};

type ActionConfig<TInput, TResult> = {
	mutationOptions: () => UseMutationOptions<TResult, Error, TInput>;
	messages: ActionMessages;
	onSuccess?: (result: TResult) => void;
};

type SubmitOptions<TResult> = {
	onSuccess?: (result: TResult) => void;
};

export function useFormSubmission<TInput, TResult>(
	config: ActionConfig<TInput, TResult>,
) {
	const { mutateAsync } = useMutation(config.mutationOptions());

	return (value: TInput, options?: SubmitOptions<TResult>) => {
		return toast.promise(mutateAsync(value), {
			loading: config.messages.loading,
			success: (result) => {
				config.onSuccess?.(result);
				options?.onSuccess?.(result);
				return config.messages.success;
			},
			error: (error: Error) => ({
				message: config.messages.error,
				description: error.message,
			}),
		});
	};
}
