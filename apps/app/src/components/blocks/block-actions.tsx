import type {
	Block,
	BlockWithCapabilities,
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
import {
	type Installer,
	removeAction,
	useInstaller,
} from "@/components/catalogue/installer";
import { HandOverDialog } from "@/components/ownership/hand-over-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { useUninstallMutation } from "@/hooks/mutations/use-catalogue-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { blockPaths } from "@/lib/navigation/block-paths";
import { blockKind } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

type ActionBlock = Pick<Block, "id" | "type" | "name"> & {
	capabilities?: BlockWithCapabilities["capabilities"];
	owner: Pick<ResourceOwner, "id">;
	homeOrganization: HomeOrganization | null;
};

/**
 * A behaviour's or repository's own actions, each present as far as its
 * capabilities allow. Its home edits, shares and deletes it, and its owner,
 * the `viewerId`, hands it over; where it was added from the catalogue, the
 * `installer` shares it for use and removes it.
 */
const blockActions = (
	block: Pick<
		ActionBlock,
		"id" | "type" | "capabilities" | "owner" | "homeOrganization"
	>,
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
	const installed = block.homeOrganization !== null;
	const home = installed ? undefined : block.capabilities;
	return {
		edit: hasCapability(home, "edit") && {
			key: "edit",
			label: m.blocks_edit_action(),
			icon: EditIcon,
			linkProps: {
				to: blockPaths(block.type).edit,
				params: {
					blockId: block.id,
				},
			},
		},
		access: (installed
			? installer !== undefined
			: hasCapability(home, "manage_access")) && {
			key: "access",
			label: m.blocks_access_action(),
			icon: KeyRoundIcon,
			onClick: onAccess,
		},
		handOver: !installed &&
			block.owner.id === viewerId && {
				key: "hand-over",
				label: m.ownership_hand_over_action(),
				icon: HandshakeIcon,
				overflow: true,
				onClick: onHandOver,
			},
		delete: hasCapability(home, "delete") && {
			key: "delete",
			label: m.blocks_delete_action(),
			icon: Trash2Icon,
			destructive: true,
			onClick: onDelete,
		},
		remove:
			installed && installer !== undefined && removeAction(installer, onRemove),
	};
};

/** The block's actions for its tile and its page, with the dialog they open. */
const useBlockActions = (
	block: ActionBlock,
	{
		onDeleted,
		listing = false,
	}: {
		/** After deleting the block, or removing it from the organisation. */
		onDeleted?: () => Promise<void>;
		/** Offers listing in the catalogue, reading the block's listing. */
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
			type: "block",
			id: block.id,
		},
		{
			enabled:
				listing &&
				block.homeOrganization === null &&
				hasCapability(block.capabilities, "manage_access"),
		},
	);
	const { mutate: uninstall } = useUninstallMutation(
		{
			kind: "block",
			name: block.name,
			organisation: installer?.organisation ?? "",
		},
		{
			onSuccess: onDeleted,
		},
	);
	const { mutate: deleteBlocks } = useDeleteBlocksMutation(
		{
			onSuccess: onDeleted,
		},
		{
			names: [
				block.name,
			],
			kind: blockKind(block.type),
		},
	);

	const actions = blockActions(
		block,
		{
			onAccess: () => setIsAccessOpen(true),
			onHandOver: () => setIsHandOverOpen(true),
			onDelete: () =>
				deleteBlocks({
					refs: [
						{
							id: block.id,
						},
					],
				}),
			onRemove: () =>
				uninstall({
					entry: {
						resourceType: "block",
						resourceId: block.id,
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
		},
		dialog: (
			<>
				{actions.access ? (
					<AccessDialog
						open={isAccessOpen}
						onOpenChange={setIsAccessOpen}
						resourceRef={{
							type: "block",
							id: block.id,
						}}
						resourceName={block.name}
						homeOrganization={block.homeOrganization}
					/>
				) : null}
				{actions.handOver ? (
					<HandOverDialog
						open={isHandOverOpen}
						onOpenChange={setIsHandOverOpen}
						resource={{
							resourceType: "block",
							resourceId: block.id,
						}}
						name={block.name}
					/>
				) : null}
			</>
		),
	};
};

export { blockActions, useBlockActions };
