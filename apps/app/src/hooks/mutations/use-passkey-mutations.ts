import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useEnterApp } from "@/hooks/use-enter-app";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

/** Signs in with a passkey alone; the authenticator verifies the user. */
export const usePasskeySignInMutation = () => {
	const enterApp = useEnterApp();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (_: undefined) => {
				const result = await authClient.signIn.passkey();
				if (result.error) throw toAuthError(result.error);
				return result.data;
			},
			onSuccess: (data) => {
				enterApp(data.user);
			},
		}),
		messages: {
			loading: m.auth_signin_toast_loading(),
			success: m.auth_signin_toast_success(),
			error: m.auth_signin_toast_error(),
		},
	});
};

export const useAddPasskeyMutation = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (_: undefined) => {
				const result = await authClient.passkey.addPasskey();
				if (result.error) throw toAuthError(result.error);
			},
		}),
		messages: {
			loading: m.passkey_add_toast_loading(),
			success: m.passkey_add_toast_success(),
			error: m.passkey_add_toast_error(),
		},
	});

export const useDeletePasskeyMutation = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (input: { id: string }) => {
				const result = await authClient.passkey.deletePasskey({
					id: input.id,
				});
				if (result.error) throw toAuthError(result.error);
			},
		}),
		messages: {
			loading: m.passkey_delete_toast_loading(),
			success: m.passkey_delete_toast_success(),
			error: m.passkey_delete_toast_error(),
		},
		confirm: {
			title: m.passkey_delete_confirm_title(),
			description: m.passkey_delete_confirm_description(),
			confirmText: m.common_delete_button(),
			cancelText: m.common_cancel_button(),
		},
	});
