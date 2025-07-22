import { Slot } from "@radix-ui/react-slot";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

export const SignOutButton = ({
	asChild = false,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean;
}) => {
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

	const Comp = asChild ? Slot : "button";

	return <Comp onClick={handleSignOut} data-slot="button" {...props} />;
};
