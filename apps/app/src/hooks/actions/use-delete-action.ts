import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";

type Counted = (inputs: { count: number }) => string;

/** One resource's delete copy, each counted by the refs deleted at once. */
export type DeleteCopy = {
	loading: Counted;
	success: Counted;
	error: Counted;
	title: Counted;
	/** Titles the confirm when one item with a name goes. */
	namedTitle: (inputs: { name: string }) => string;
	description: Counted;
	confirmText: Counted;
};

/** Deletes `refs` behind a confirm that names a single target. */
export const useDeleteAction = <
	TData,
	TError,
	TVariables extends {
		refs: readonly unknown[];
	},
	TContext,
>({
	mutationOptions,
	copy,
	target,
}: {
	mutationOptions: () => UseMutationOptions<
		TData,
		TError,
		TVariables,
		TContext
	>;
	copy: DeleteCopy;
	target?: DestructiveTarget;
}) => {
	const counted = ({ input }: { input: TVariables }) => ({
		count: input.refs.length,
	});

	return useMutationAction({
		mutationOptions,
		messages: {
			loading: (args) => copy.loading(counted(args)),
			success: (args) => copy.success(counted(args)),
			error: (args) => copy.error(counted(args)),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? copy.namedTitle({
							name,
						})
					: copy.title({
							count,
						}),
				description: copy.description({
					count,
				}),
				confirmText: copy.confirmText({
					count,
				}),
			};
		},
	});
};
