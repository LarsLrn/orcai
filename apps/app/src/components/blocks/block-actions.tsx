import type { Block, BlockWithCapabilities } from "@orcai/schema";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { useListingAction } from "@/components/access/listing-action";
import type { HeaderAction } from "@/components/ui/shell/actions";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { blockPaths } from "@/lib/navigation/block-paths";
import { blockKind } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

type ActionBlock = Pick<Block, "id" | "type" | "name"> & {
	capabilities?: BlockWithCapabilities["capabilities"];
};

/** A behaviour's or repository's own actions, each present as far as its capabilities allow. */
const blockActions = (
	block: Pick<ActionBlock, "id" | "type" | "capabilities">,
	{
		onAccess,
		onDelete,
	}: {
		onAccess: () => void;
		onDelete: () => void;
	},
): Record<"edit" | "access" | "delete", HeaderAction | false> => ({
	edit: hasCapability(block.capabilities, "edit") && {
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
	access: hasCapability(block.capabilities, "manage_access") && {
		key: "access",
		label: m.blocks_access_action(),
		icon: KeyRoundIcon,
		onClick: onAccess,
	},
	delete: hasCapability(block.capabilities, "delete") && {
		key: "delete",
		label: m.blocks_delete_action(),
		icon: Trash2Icon,
		destructive: true,
		onClick: onDelete,
	},
});

/** The block's actions for its tile and its page, with the dialog they open. */
const useBlockActions = (
	block: ActionBlock,
	{
		onDeleted,
		listing = false,
	}: {
		onDeleted?: () => Promise<void>;
		/** Offers listing in the catalogue, reading the block's listing. */
		listing?: boolean;
	} = {},
) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const listingAction = useListingAction(
		{
			type: "block",
			id: block.id,
		},
		{
			enabled: listing && hasCapability(block.capabilities, "manage_access"),
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

	return {
		actions: {
			...blockActions(block, {
				onAccess: () => setIsAccessOpen(true),
				onDelete: () =>
					deleteBlocks({
						refs: [
							{
								id: block.id,
							},
						],
					}),
			}),
			listing: listingAction,
		},
		dialog: hasCapability(block.capabilities, "manage_access") ? (
			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "block",
					id: block.id,
				}}
				resourceName={block.name}
			/>
		) : null,
	};
};

export { blockActions, useBlockActions };
