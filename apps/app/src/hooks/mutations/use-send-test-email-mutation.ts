import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useSendTestEmailMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.health.sendTestEmail.mutationOptions(),
		messages: {
			loading: m.instance_health_test_email_toast_loading(),
			success: ({ data }) =>
				data.queued
					? m.instance_health_test_email_toast_success()
					: m.instance_health_test_email_toast_recent(),
			error: m.instance_health_test_email_toast_error(),
		},
	});
