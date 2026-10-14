import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { m } from "@/paraglide/messages";

export const useSignOut = () => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const signOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async (_ctx) => {
					trackEvent("auth-signout");

					toast.message(m.auth_sign_out_toast_success());
					await navigate({
						to: "/",
					});
					queryClient.clear();
				},
			},
		});
	};

	return {
		signOut,
	};
};
