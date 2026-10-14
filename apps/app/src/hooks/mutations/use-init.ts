import type { InitSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { client } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useInit = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const { refetch: refetchSession } = authClient.useSession();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: InitSchemaType) => {
				const initResult = await client.bootstrap.initialize({
					name: values.name,
					email: values.email,
					password: values.password,
					organizationName: values.organizationName,
					organizationSlug: values.organizationSlug,
				});

				const signInResult = await authClient.signIn.email({
					email: values.email,
					password: values.password,
				});

				if (signInResult.error) {
					throw new Error(
						m.auth_init_toast_signin_failed_error({
							reason: signInResult.error.message ?? "unknown error",
						}),
					);
				}

				try {
					await client.user.setActiveOrganization({
						organizationId: initResult.data.organizationId,
					});
				} catch {
					// If this fails, /app redirects to organization selection as a fallback.
				}

				return initResult;
			},
			onSuccess: () => {
				trackEvent("app-init");
				refetchSession();
				navigate({
					to: "/app",
					replace: true,
				});
			},
		}),
		messages: {
			loading: m.auth_init_toast_loading(),
			success: m.auth_init_toast_success(),
			error: m.auth_init_toast_error(),
		},
	});
};
