import type {
	BotWithCapabilities,
	HomeOrganization,
	ResourceOwner,
} from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import {
	EditIcon,
	HandshakeIcon,
	KeyRoundIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { useListingAction } from "@/components/access/listing-action";
import { useAddBlocksAction } from "@/components/catalogue/add-blocks-action";
import {
	type Installer,
	removeAction,
	useInstaller,
} from "@/components/catalogue/installer";
import { HandOverDialog } from "@/components/ownership/hand-over-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { useUninstallMutation } from "@/hooks/mutations/use-catalogue-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

type ActionBot = Pick<BotWithCapabilities, "id" | "name" | "capabilities"> & {
	owner: Pick<ResourceOwner, "id">;
	homeOrganization: HomeOrganization | null;
};

/**
 * A bot's own actions, each present as far as its capabilities allow. Its
 * home edits, shares and deletes it, and its owner, the `viewerId`, hands it
 * over; where it was added from the catalogue, the `installer` shares it for
 * use and removes it.
 */
const botActions = (
	bot: Pick<ActionBot, "id" | "capabilities" | "owner" | "homeOrganization">,
	{
		onAccess,
		onHandOver,
		onDelete,
		onRemove,
	}: {
		onAccess: () => void;
		onHandOver: () => void;
		onDelete: () => void;
		onRemove: () => void;
	},
	{
		viewerId,
		installer,
	}: {
		viewerId: string;
		installer?: Installer;
	},
): Record<
	"edit" | "access" | "handOver" | "delete" | "remove",
	HeaderAction | false
> => {
	const installed = bot.homeOrganization !== null;
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
		handOver: !installed &&
			bot.owner.id === viewerId && {
				key: "hand-over",
				label: m.ownership_hand_over_action(),
				icon: HandshakeIcon,
				overflow: true,
				onClick: onHandOver,
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
		/**
		 * On the bot's page: offers listing in the catalogue, reading the
		 * bot's listing, and adding the blocks of a bot added without them.
		 */
		listing?: boolean;
	} = {},
) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const [isHandOverOpen, setIsHandOverOpen] = useState(false);
	const installer = useInstaller();
	const listingAction = useListingAction(
		{
			type: "bot",
			id: bot.id,
		},
		{
			enabled:
				listing &&
				bot.homeOrganization === null &&
				hasCapability(bot.capabilities, "manage_access"),
		},
	);
	const addBlocks = useAddBlocksAction(
		{
			resourceType: "bot",
			resourceId: bot.id,
		},
		bot.name,
		{
			enabled: listing && bot.homeOrganization !== null,
			overflow: true,
		},
	);
	const { mutate: uninstall } = useUninstallMutation(
		{
			kind: "bot",
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
			onHandOver: () => setIsHandOverOpen(true),
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
		{
			viewerId: auth.user.id,
			installer,
		},
	);

	return {
		actions: {
			...actions,
			listing: listingAction,
			addBlocks,
		},
		dialog: (
			<>
				{actions.access ? (
					<AccessDialog
						open={isAccessOpen}
						onOpenChange={setIsAccessOpen}
						resourceRef={{
							type: "bot",
							id: bot.id,
						}}
						resourceName={bot.name}
						homeOrganization={bot.homeOrganization}
					/>
				) : null}
				{actions.handOver ? (
					<HandOverDialog
						open={isHandOverOpen}
						onOpenChange={setIsHandOverOpen}
						resource={{
							resourceType: "bot",
							resourceId: bot.id,
						}}
						name={bot.name}
					/>
				) : null}
			</>
		),
	};
};

export { botActions, useBotActions };
