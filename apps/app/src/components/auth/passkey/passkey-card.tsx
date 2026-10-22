import { KeyRoundIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useAddPasskeyMutation,
	useDeletePasskeyMutation,
} from "@/hooks/mutations/use-passkey-mutations";
import { authClient } from "@/lib/auth/auth-client";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

/** The signed-in user's passkeys: add one, or delete one. */
export const PasskeyCard = () => {
	const { data: passkeys, isPending } = authClient.useListPasskeys();
	const { mutate: addPasskey, isPending: isAdding } = useAddPasskeyMutation();
	const { mutate: deletePasskey } = useDeletePasskeyMutation();

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.passkey_card_title()}</CardTitle>
				<CardDescription>{m.passkey_card_description()}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{isPending ? (
					<Skeleton className="h-10 w-full" />
				) : passkeys && passkeys.length > 0 ? (
					<ul
						aria-label={m.passkey_list_label()}
						className="flex flex-col divide-y rounded-lg border"
					>
						{passkeys.map((passkey) => {
							const name = passkey.name || m.passkey_default_name();
							return (
								<li
									key={passkey.id}
									className="flex items-center justify-between gap-2 px-4 py-2"
								>
									<div className="flex items-center gap-3">
										<KeyRoundIcon className="size-4 text-muted-foreground" />
										<div className="flex flex-col">
											<span className="font-medium text-sm">{name}</span>
											{passkey.createdAt && (
												<span className="text-muted-foreground text-xs">
													{m.passkey_added_at({
														date: formatDisplayDate(passkey.createdAt),
													})}
												</span>
											)}
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										aria-label={m.passkey_delete_button({
											name,
										})}
										onClick={() =>
											deletePasskey({
												id: passkey.id,
											})
										}
									>
										<TrashIcon />
									</Button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">
						{m.passkey_list_empty()}
					</p>
				)}
				<Button
					variant="outline"
					className="self-start"
					disabled={isAdding}
					onClick={() => addPasskey(undefined)}
				>
					{m.passkey_add_button()}
				</Button>
			</CardContent>
		</Card>
	);
};
