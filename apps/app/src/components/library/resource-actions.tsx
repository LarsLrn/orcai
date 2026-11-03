import {
	type Asset,
	type Block,
	type BotWithCapabilities,
	type CatalogueEntryRef,
	canPrepareAgain,
	type EntityCapabilities,
	type HomeOrganization,
	type ResourceIdentity,
	type ResourceRef,
} from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import {
	EditIcon,
	HandshakeIcon,
	KeyRoundIcon,
	LibraryIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { useListingAction } from "@/components/access/listing-action";
import { useAddBlocksAction } from "@/components/catalogue/add-blocks-action";
import {
	type CatalogueAdder,
	removeAction,
	useCatalogueAdder,
} from "@/components/catalogue/catalogue-adder";
import { HandOverDialog } from "@/components/ownership/hand-over-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	useAddAssetToLibraryMutation,
	useDeleteAssetsMutation,
	usePrepareAssetAgainMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { useDeleteBotsMutation } from "@/hooks/mutations/use-bot-mutations";
import { useCatalogueRemoveMutation } from "@/hooks/mutations/use-catalogue-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { blockPaths } from "@/lib/navigation/block-paths";
import { m } from "@/paraglide/messages";

/** A bot, block or asset as its actions read it. */
type ActionItem = {
	ref: ResourceRef;
	capabilities: EntityCapabilities<ResourceRef["type"]> | undefined;
	/** Set where the active organisation added the item from the catalogue. */
	homeOrganization: HomeOrganization | null;
	editLink: LinkProps;
};

const labels = {
	bot: {
		edit: m.bots_edit_action,
		access: m.bots_access_action,
		delete: m.bots_delete_action,
	},
	block: {
		edit: m.blocks_edit_action,
		access: m.blocks_access_action,
		delete: m.blocks_delete_action,
	},
	asset: {
		edit: m.assets_edit_action,
		access: m.assets_access_action,
		delete: m.assets_delete_action,
	},
} satisfies Record<ResourceRef["type"], Record<string, () => string>>;

/**
 * An item's own actions, each present as far as its capabilities allow. Its
 * home edits, shares and deletes it, and hands it over where the server says
 * so; where it was added from the catalogue, the `adder` shares it for use
 * and removes it.
 */
const resourceActions = (
	item: ActionItem,
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
	adder?: CatalogueAdder,
): Record<
	"edit" | "access" | "handOver" | "delete" | "remove",
	HeaderAction | false
> => {
	const label = labels[item.ref.type];
	const added = item.homeOrganization !== null;
	const home = added ? undefined : item.capabilities;
	return {
		edit: hasCapability(home, "edit") && {
			key: "edit",
			label: label.edit(),
			icon: EditIcon,
			linkProps: item.editLink,
		},
		access: (added
			? adder !== undefined
			: hasCapability(home, "manage_access")) && {
			key: "access",
			label: label.access(),
			icon: KeyRoundIcon,
			onClick: onAccess,
		},
		handOver: hasCapability(home, "hand_over") && {
			key: "hand-over",
			label: m.ownership_hand_over_action(),
			icon: HandshakeIcon,
			overflow: true,
			onClick: onHandOver,
		},
		delete: hasCapability(home, "delete") && {
			key: "delete",
			label: label.delete(),
			icon: Trash2Icon,
			destructive: true,
			onClick: onDelete,
		},
		remove: added && adder !== undefined && removeAction(adder, onRemove),
	};
};

const identityOf = (ref: ResourceRef): ResourceIdentity => {
	switch (ref.type) {
		case "bot":
			return {
				resourceType: "bot",
				resourceId: ref.id,
			};
		case "block":
			return {
				resourceType: "block",
				resourceId: ref.id,
			};
		case "asset":
			return {
				resourceType: "asset",
				resourceId: ref.id,
			};
	}
};

type Outcome = Promise<{
	status: "success" | "error" | "cancelled";
}>;

type ResourceActionsOptions = {
	/** After deleting the item, or removing it from the organisation. */
	onDeleted?: () => Promise<void>;
	/** On the item's page: offers listing in the catalogue, reading its listing. */
	listing?: boolean;
};

/** An item's actions with the dialogs they open, given how it is deleted and removed. */
const useResourceActions = (
	item: ActionItem & {
		name: string;
	},
	{
		onDeleted,
		listing = false,
		deleteItem,
		catalogue,
	}: ResourceActionsOptions & {
		deleteItem: () => Outcome;
		catalogue?: {
			adder: CatalogueAdder | undefined;
			remove: () => Outcome;
		};
	},
) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const [isHandOverOpen, setIsHandOverOpen] = useState(false);
	const listingAction = useListingAction(item.ref, {
		enabled:
			listing &&
			item.homeOrganization === null &&
			hasCapability(item.capabilities, "manage_access"),
	});
	const afterwards = async (outcome: Outcome) => {
		if ((await outcome).status === "success") await onDeleted?.();
	};

	const actions = resourceActions(
		item,
		{
			onAccess: () => setIsAccessOpen(true),
			onHandOver: () => setIsHandOverOpen(true),
			onDelete: () => void afterwards(deleteItem()),
			onRemove: () => {
				if (catalogue) void afterwards(catalogue.remove());
			},
		},
		catalogue?.adder,
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
						resourceRef={item.ref}
						resourceName={item.name}
						homeOrganization={item.homeOrganization}
					/>
				) : null}
				{actions.handOver ? (
					<HandOverDialog
						open={isHandOverOpen}
						onOpenChange={setIsHandOverOpen}
						resource={identityOf(item.ref)}
						name={item.name}
					/>
				) : null}
			</>
		),
	};
};

/** Removing an item the active organisation added from the catalogue. */
const useCatalogueRemoval = (entry: CatalogueEntryRef, name: string) => {
	const adder = useCatalogueAdder();
	const { mutateAsync } = useCatalogueRemoveMutation({
		kind: entry.resourceType,
		name,
		organisation: adder?.organisation ?? "",
	});
	return {
		adder,
		remove: () =>
			mutateAsync({
				entry,
			}),
	};
};

type ActionBot = Pick<BotWithCapabilities, "id" | "name" | "capabilities"> & {
	homeOrganization: HomeOrganization | null;
};

/**
 * The bot's actions for its tile and its page. With `listing`, its page also
 * adds the blocks of a bot added without them.
 */
const useBotActions = (
	bot: ActionBot,
	options: ResourceActionsOptions = {},
) => {
	const { mutateAsync: deleteBots } = useDeleteBotsMutation({
		names: [
			bot.name,
		],
	});
	const catalogue = useCatalogueRemoval(
		{
			resourceType: "bot",
			resourceId: bot.id,
		},
		bot.name,
	);
	const addBlocks = useAddBlocksAction(
		{
			resourceType: "bot",
			resourceId: bot.id,
		},
		bot.name,
		{
			enabled: options.listing === true && bot.homeOrganization !== null,
			overflow: true,
		},
	);
	const { actions, dialog } = useResourceActions(
		{
			ref: {
				type: "bot",
				id: bot.id,
			},
			name: bot.name,
			capabilities: bot.capabilities,
			homeOrganization: bot.homeOrganization,
			editLink: {
				to: "/app/library/bots/$botId/setup",
				params: {
					botId: bot.id,
				},
			},
		},
		{
			...options,
			deleteItem: () =>
				deleteBots({
					refs: [
						{
							id: bot.id,
						},
					],
				}),
			catalogue,
		},
	);

	return {
		actions: {
			...actions,
			addBlocks,
		},
		dialog,
	};
};

type ActionBlock = Pick<Block, "id" | "type" | "name"> & {
	capabilities?: EntityCapabilities<"block">;
	homeOrganization: HomeOrganization | null;
};

/** The behaviour's or repository's actions for its tile and its page. */
const useBlockActions = (
	block: ActionBlock,
	options: ResourceActionsOptions = {},
) => {
	const { mutateAsync: deleteBlocks } = useDeleteBlocksMutation({
		names: [
			block.name,
		],
		kind: block.type,
	});
	const catalogue = useCatalogueRemoval(
		{
			resourceType: "block",
			resourceId: block.id,
		},
		block.name,
	);
	return useResourceActions(
		{
			ref: {
				type: "block",
				id: block.id,
			},
			name: block.name,
			capabilities: block.capabilities,
			homeOrganization: block.homeOrganization,
			editLink: {
				to: blockPaths(block.type).edit,
				params: {
					blockId: block.id,
				},
			},
		},
		{
			...options,
			deleteItem: () =>
				deleteBlocks({
					refs: [
						{
							id: block.id,
						},
					],
				}),
			catalogue,
		},
	);
};

type ActionAsset = Pick<
	Asset,
	| "id"
	| "title"
	| "keptIn"
	| "processingStatus"
	| "processingFailure"
	| "fileType"
> & {
	capabilities?: EntityCapabilities<"asset">;
};

/** The actions an asset's own state offers: keeping a chat upload, preparing it again. */
const assetStateActions = (
	asset: Omit<ActionAsset, "id" | "title">,
	{
		onAddToLibrary,
		onPrepareAgain,
	}: {
		onAddToLibrary: () => void;
		onPrepareAgain: () => void;
	},
): Record<"addToLibrary" | "prepareAgain", HeaderAction | false> => {
	const canEdit = hasCapability(asset.capabilities, "edit");
	const processing =
		asset.processingStatus === "pending" || asset.processingStatus === "active";
	const failedForGood =
		asset.processingStatus === "failed" &&
		!canPrepareAgain(asset.processingFailure ?? "other", asset.fileType);

	return {
		addToLibrary: canEdit &&
			asset.keptIn === "chat" && {
				key: "add-to-library",
				label: m.assets_add_to_library_action(),
				icon: LibraryIcon,
				overflow: true,
				onClick: onAddToLibrary,
			},
		prepareAgain: canEdit &&
			!processing &&
			!failedForGood && {
				key: "prepareAgain",
				label: m.assets_prepare_again_action(),
				icon: RefreshCwIcon,
				overflow: true,
				onClick: onPrepareAgain,
			},
	};
};

/** The asset's actions for its tile and its page. */
const useAssetActions = (
	asset: ActionAsset,
	options: ResourceActionsOptions = {},
) => {
	const { mutate: addToLibrary } = useAddAssetToLibraryMutation();
	const { mutate: prepareAssetAgain } = usePrepareAssetAgainMutation();
	const { mutateAsync: deleteAssets } = useDeleteAssetsMutation({
		names: [
			asset.title,
		],
	});
	const { actions, dialog } = useResourceActions(
		{
			ref: {
				type: "asset",
				id: asset.id,
			},
			name: asset.title,
			capabilities: asset.capabilities,
			homeOrganization: null,
			editLink: {
				to: "/app/library/assets/$assetId/edit",
				params: {
					assetId: asset.id,
				},
			},
		},
		{
			...options,
			deleteItem: () =>
				deleteAssets({
					refs: [
						{
							id: asset.id,
						},
					],
				}),
		},
	);

	return {
		actions: {
			...actions,
			...assetStateActions(asset, {
				onAddToLibrary: () =>
					addToLibrary({
						id: asset.id,
					}),
				onPrepareAgain: () =>
					prepareAssetAgain({
						id: asset.id,
					}),
			}),
		},
		dialog,
	};
};

export {
	assetStateActions,
	resourceActions,
	useAssetActions,
	useBlockActions,
	useBotActions,
};
