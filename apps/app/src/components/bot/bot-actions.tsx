import type { BotWithCapabilities } from "@orcai/schema";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

type ActionBot = Pick<BotWithCapabilities, "id" | "name" | "capabilities">;

/** A bot's own actions, each present as far as its capabilities allow. */
const botActions = (
	bot: Pick<ActionBot, "id" | "capabilities">,
	{
		onAccess,
		onDelete,
	}: {
		onAccess: () => void;
		onDelete: () => void;
	},
): Record<"edit" | "access" | "delete", HeaderAction | false> => ({
	edit: hasCapability(bot.capabilities, "edit") && {
		key: "edit",
		label: m.bots_edit_action(),
		icon: EditIcon,
		linkProps: {
			to: "/app/hub/bots/$botId/setup",
			params: {
				botId: bot.id,
			},
		},
	},
	access: hasCapability(bot.capabilities, "manage_access") && {
		key: "access",
		label: m.bots_access_action(),
		icon: KeyRoundIcon,
		onClick: onAccess,
	},
	delete: hasCapability(bot.capabilities, "delete") && {
		key: "delete",
		label: m.bots_delete_action(),
		icon: Trash2Icon,
		destructive: true,
		onClick: onDelete,
	},
});

/** The bot's actions for its tile and its page, with the dialog they open. */
const useBotActions = (
	bot: ActionBot,
	{
		onDeleted,
	}: {
		onDeleted?: () => Promise<void>;
	} = {},
) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: deleteBots } = useDeleteBotsMutation(
		{
			onSuccess: onDeleted,
		},
		{
			names: [
				bot.name,
			],
		},
	);

	return {
		actions: botActions(bot, {
			onAccess: () => setIsAccessOpen(true),
			onDelete: () =>
				deleteBots({
					refs: [
						{
							id: bot.id,
						},
					],
				}),
		}),
		dialog: hasCapability(bot.capabilities, "manage_access") ? (
			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "bot",
					id: bot.id,
				}}
				resourceName={bot.name}
			/>
		) : null,
	};
};

export { botActions, useBotActions };
