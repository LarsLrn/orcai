import { useNavigate } from "@tanstack/react-router";
import type { InitSchemaType } from "@/db/zod/init";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { client } from "@/lib/orpc/orpc";

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
						`Initialization completed, but automatic sign-in failed: ${signInResult.error.message}. Please sign in manually.`,
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
			loading: "Initializing application...",
			success: "Initialization completed successfully!",
			error: "Initialization failed",
		},
	});
};
