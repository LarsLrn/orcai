import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Requests an export of the user's data after a confirm that says whether one was made before. */
export const useRequestDataExportMutation = (exportedBefore: boolean) =>
	useMutationAction({
		mutationOptions: () => orpc.dataExport.request.mutationOptions(),
		messages: {
			loading: m.account_data_export_request_toast_loading(),
			success: m.account_data_export_request_toast_success(),
			error: m.account_data_export_request_toast_error(),
		},
		confirm: {
			title: m.account_data_export_confirm_title(),
			description: exportedBefore
				? m.account_data_export_confirm_again_description()
				: m.account_data_export_confirm_description(),
			confirmText: m.account_data_export_confirm_button(),
			confirmVariant: "default",
		},
	});
