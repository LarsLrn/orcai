import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const removed = {
	loading: m.images_remove_toast_loading(),
	success: m.images_remove_toast_success(),
	error: m.images_remove_toast_error(),
};

/** An instance admin removes an account's picture. */
export const useRemoveUserImageMutation = (target: { name: string }) =>
	useMutationAction({
		mutationOptions: () => orpc.instance.removeUserImage.mutationOptions(),
		messages: removed,
		confirm: {
			title: m.images_picture_remove_confirm_title({
				name: target.name,
			}),
			description: m.images_picture_remove_confirm_description(),
			confirmText: m.common_remove_button(),
			cancelText: m.common_cancel_button(),
		},
	});

/** An instance admin removes an organisation's logo. */
export const useRemoveOrganizationLogoMutation = (target: { name: string }) =>
	useMutationAction({
		mutationOptions: () =>
			orpc.instance.removeOrganizationLogo.mutationOptions(),
		messages: removed,
		confirm: {
			title: m.images_logo_remove_confirm_title({
				name: target.name,
			}),
			description: m.images_logo_remove_confirm_description(),
			confirmText: m.common_remove_button(),
			cancelText: m.common_cancel_button(),
		},
	});
