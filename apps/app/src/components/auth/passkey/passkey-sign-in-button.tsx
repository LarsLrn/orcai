import { KeyRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePasskeySignInMutation } from "@/hooks/mutations/use-passkey-mutations";
import { m } from "@/paraglide/messages";

export const PasskeySignInButton = () => {
	const { mutate: signIn, isPending } = usePasskeySignInMutation();

	return (
		<Button
			type="button"
			variant="outline"
			className="w-full"
			disabled={isPending}
			onClick={() => signIn(undefined)}
		>
			<KeyRoundIcon />
			{m.auth_signin_passkey_button()}
		</Button>
	);
};
