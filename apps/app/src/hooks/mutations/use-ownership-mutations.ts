import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** The owner hands one bot, block or asset to another member. */
export const useHandOverMutation = (
	name: string,
	opts: ReturnType<typeof orpc.resource.handOver.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.resource.handOver.mutationOptions(opts),
		messages: {
			loading: m.ownership_hand_over_toast_loading({
				name,
			}),
			success: m.ownership_hand_over_toast_success({
				name,
			}),
			error: m.ownership_hand_over_toast_error({
				name,
			}),
		},
	});
