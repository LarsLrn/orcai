import { useNavigate } from "@tanstack/react-router";
import type { InitSchemaType } from "@/db/zod/init";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";
import { client } from "@/lib/orpc/orpc";

export const useInitSubmission = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const { refetch: refetchSession } = authClient.useSession();

	return useFormSubmission({
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
		}),
		messages: {
			loading: "Initializing application...",
			success: "Initialization completed successfully!",
			error: "Initialization failed",
		},
		onSuccess: () => {
			trackEvent("auth-init");
			refetchSession();
			navigate({ to: "/app", replace: true });
		},
	});
};
