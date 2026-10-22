import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useRequestDataExportMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.dataExport.request.mutationOptions(),
		messages: {
			loading: m.account_data_export_request_toast_loading(),
			success: m.account_data_export_request_toast_success(),
			error: m.account_data_export_request_toast_error(),
		},
	});
