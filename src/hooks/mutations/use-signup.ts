import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SignupSchemaType } from "@/db/zod/signup";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";

const sleep = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

export const useSignup = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const { mutateAsync: respondToInvitation } = useMutation(
		orpc.organizationInvitation.respond.mutationOptions(),
	);

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: SignupSchemaType) => {
				// TODO: Consider adding a check that accounts can only be created if the email and invitation match
				const result = await authClient.signUp.email({
					name: values.name ?? "User",
					email: values.email,
					password: values.password,
				});

				if (result.error) {
					throw new Error(result.error.message);
				}

				let hasSession = false;

				for (let attempt = 0; attempt < 3; attempt++) {
					const sessionResult = await authClient.getSession();
					if (sessionResult.data?.session && sessionResult.data?.user) {
						hasSession = true;
						break;
					}

					if (attempt === 0) {
						const signInResult = await authClient.signIn.email({
							email: values.email,
							password: values.password,
						});

						if (signInResult.error) {
							throw new Error(signInResult.error.message);
						}
					}

					await sleep(150 * (attempt + 1));
				}

				if (!hasSession) {
					throw new Error(
						"Account created, but no authenticated session is available yet. Please sign in and try again.",
					);
				}

				try {
					await respondToInvitation({
						id: values.invitationId,
						response: "accept",
					});
				} catch {
					throw new Error(
						"Account created, but joining the organization failed. Sign in and accept the invitation from the organization selector.",
					);
				}

				return result;
			},
			onSuccess: (result) => {
				trackEvent("auth-register", {
					email: result.data?.user?.email,
				});
				navigate({ to: "/", replace: true });
			},
		}),
		messages: {
			loading: "Creating your account...",
			success: "Account successfully created!",
			error: "Account creation failed",
		},
	});
};
