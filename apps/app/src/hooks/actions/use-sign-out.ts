import { useQueryClient } from "@tanstack/react-query";
import { type NavigateOptions, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { m } from "@/paraglide/messages";

export const useSignOut = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const signOut = async (
		destination: NavigateOptions = {
			to: "/",
		},
	) => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async (_ctx) => {
					trackEvent("auth-signout");

					toast.message(m.auth_sign_out_toast_success());
					await navigate(destination);
					queryClient.clear();
				},
			},
		});
	};

	return {
		signOut,
	};
};
