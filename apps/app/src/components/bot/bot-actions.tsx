import type { BotWithCapabilities, SourceOrganization } from "@orcai/schema";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { useListingAction } from "@/components/access/listing-action";
import {
	type Installer,
	removeAction,
	useInstaller,
} from "@/components/catalogue/installer";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { useUninstallMutation } from "@/hooks/mutations/use-catalogue-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

type ActionBot = Pick<BotWithCapabilities, "id" | "name" | "capabilities"> & {
	installedFrom: SourceOrganization | null;
};

/**
 * A bot's own actions, each present as far as its capabilities allow. Its
 * home edits, shares and deletes it; where it was added from the catalogue,
 * the `installer` shares it for use and removes it.
 */
const botActions = (
	bot: Pick<ActionBot, "id" | "capabilities" | "installedFrom">,
	{
		onAccess,
		onDelete,
		onRemove,
	}: {
		onAccess: () => void;
		onDelete: () => void;
		onRemove: () => void;
	},
	installer?: Installer,
): Record<"edit" | "access" | "delete" | "remove", HeaderAction | false> => {
	const installed = bot.installedFrom !== null;
	const home = installed ? undefined : bot.capabilities;
	return {
		edit: hasCapability(home, "edit") && {
			key: "edit",
			label: m.bots_edit_action(),
			icon: EditIcon,
			linkProps: {
				to: "/app/library/bots/$botId/setup",
				params: {
					botId: bot.id,
				},
			},
		},
		access: (installed
			? installer !== undefined
			: hasCapability(home, "manage_access")) && {
			key: "access",
			label: m.bots_access_action(),
			icon: KeyRoundIcon,
			onClick: onAccess,
		},
		delete: hasCapability(home, "delete") && {
			key: "delete",
			label: m.bots_delete_action(),
			icon: Trash2Icon,
			destructive: true,
			onClick: onDelete,
		},
		remove:
			installed && installer !== undefined && removeAction(installer, onRemove),
	};
};

/** The bot's actions for its tile and its page, with the dialog they open. */
const useBotActions = (
	bot: ActionBot,
	{
		onDeleted,
		listing = false,
	}: {
		/** After deleting the bot, or removing it from the organisation. */
		onDeleted?: () => Promise<void>;
		/** Offers listing in the catalogue, reading the bot's listing. */
		listing?: boolean;
	} = {},
) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const installer = useInstaller();
	const listingAction = useListingAction(
		{
			type: "bot",
			id: bot.id,
		},
		{
			enabled:
				listing &&
				bot.installedFrom === null &&
				hasCapability(bot.capabilities, "manage_access"),
		},
	);
	const { mutate: uninstall } = useUninstallMutation(
		{
			name: bot.name,
			organisation: installer?.organisation ?? "",
		},
		{
			onSuccess: onDeleted,
		},
	);
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

	const actions = botActions(
		bot,
		{
			onAccess: () => setIsAccessOpen(true),
			onDelete: () =>
				deleteBots({
					refs: [
						{
							id: bot.id,
						},
					],
				}),
			onRemove: () =>
				uninstall({
					entry: {
						resourceType: "bot",
						resourceId: bot.id,
					},
				}),
		},
		installer,
	);

	return {
		actions: {
			...actions,
			listing: listingAction,
		},
		dialog: actions.access ? (
			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "bot",
					id: bot.id,
				}}
				resourceName={bot.name}
				installedFrom={bot.installedFrom}
			/>
		) : null,
	};
};

export { botActions, useBotActions };
