import type {
	TotpCodeSchemaType,
	TwoFactorChallengeSchemaType,
	TwoFactorPasswordSchemaType,
} from "@orcai/schema";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useEnterApp } from "@/hooks/use-enter-app";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

/** Starts enrolment: a TOTP secret and backup codes, active once a code confirms them. */
export const useEnableTwoFactorMutation = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: TwoFactorPasswordSchemaType) => {
				const result = await authClient.twoFactor.enable({
					password: values.password,
				});
				if (result.error) throw toAuthError(result.error);
				return result.data;
			},
		}),
		messages: {
			loading: m.two_factor_enable_toast_loading(),
			success: m.two_factor_enable_toast_success(),
			error: m.two_factor_enable_toast_error(),
		},
	});

/** Confirms enrolment with a first code, which turns two-factor authentication on. */
export const useConfirmTwoFactorMutation = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: TotpCodeSchemaType) => {
				const result = await authClient.twoFactor.verifyTotp({
					code: values.code,
				});
				if (result.error) throw toAuthError(result.error);
			},
		}),
		messages: {
			loading: m.two_factor_confirm_toast_loading(),
			success: m.two_factor_confirm_toast_success(),
			error: m.two_factor_confirm_toast_error(),
		},
	});

/** The second sign-in step, with an authenticator code or a backup code. */
export const useTwoFactorChallengeMutation = (method: "totp" | "backup") => {
	const enterApp = useEnterApp();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: TwoFactorChallengeSchemaType) => {
				const input = {
					code: values.code,
					trustDevice: values.trustDevice,
				};
				const result =
					method === "totp"
						? await authClient.twoFactor.verifyTotp(input)
						: await authClient.twoFactor.verifyBackupCode(input);
				if (result.error) throw toAuthError(result.error);
				return result.data;
			},
			onSuccess: (data) => {
				enterApp(data.user);
			},
		}),
		messages: {
			loading: m.two_factor_challenge_toast_loading(),
			success: m.auth_signin_toast_success(),
			error: m.two_factor_challenge_toast_error(),
		},
	});
};

export const useGenerateBackupCodesMutation = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: TwoFactorPasswordSchemaType) => {
				const result = await authClient.twoFactor.generateBackupCodes({
					password: values.password,
				});
				if (result.error) throw toAuthError(result.error);
				return result.data.backupCodes;
			},
		}),
		messages: {
			loading: m.two_factor_backup_codes_toast_loading(),
			success: m.two_factor_backup_codes_toast_success(),
			error: m.two_factor_backup_codes_toast_error(),
		},
	});

export const useDisableTwoFactorMutation = () => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: TwoFactorPasswordSchemaType) => {
				const result = await authClient.twoFactor.disable({
					password: values.password,
				});
				if (result.error) throw toAuthError(result.error);
			},
			onSuccess: () => router.invalidate(),
		}),
		messages: {
			loading: m.two_factor_disable_toast_loading(),
			success: m.two_factor_disable_toast_success(),
			error: m.two_factor_disable_toast_error(),
		},
	});
};
