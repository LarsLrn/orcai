import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

export const SignOutButton = ({ ...props }: ButtonPrimitive.Props) => {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async (_ctx) => {
					trackEvent("auth-signout");

					toast.message("Goodbye!");
					await navigate({ to: "/" });
					queryClient.clear();
				},
			},
		});
	};

	return <Button onClick={handleSignOut} {...props} />;
};
