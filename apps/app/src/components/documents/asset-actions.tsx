import type { Asset, AssetWithCapabilities } from "@orcai/schema";
import {
	EditIcon,
	KeyRoundIcon,
	LibraryIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	useAddAssetToLibraryMutation,
	useDeleteAssetsMutation,
	useReprocessAssetMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

type ActionAsset = Pick<
	Asset,
	"id" | "title" | "origin" | "processingStatus"
> & {
	capabilities?: AssetWithCapabilities["capabilities"];
};

/** An asset's own actions, each present as far as its capabilities and state allow. */
const assetActions = (
	asset: Omit<ActionAsset, "title">,
	{
		onAccess,
		onAddToLibrary,
		onReprocess,
		onDelete,
	}: {
		onAccess: () => void;
		onAddToLibrary: () => void;
		onReprocess: () => void;
		onDelete: () => void;
	},
): Record<
	"edit" | "access" | "addToLibrary" | "reprocess" | "delete",
	HeaderAction | false
> => {
	const canEdit = hasCapability(asset.capabilities, "edit");
	const processing =
		asset.processingStatus === "pending" || asset.processingStatus === "active";

	return {
		edit: canEdit && {
			key: "edit",
			label: m.assets_edit_action(),
			icon: EditIcon,
			linkProps: {
				to: "/app/library/assets/$assetId/edit",
				params: {
					assetId: asset.id,
				},
			},
		},
		access: hasCapability(asset.capabilities, "manage_access") && {
			key: "access",
			label: m.assets_access_action(),
			icon: KeyRoundIcon,
			onClick: onAccess,
		},
		addToLibrary: canEdit &&
			asset.origin === "chat" && {
				key: "add-to-library",
				label: m.assets_add_to_library_action(),
				icon: LibraryIcon,
				overflow: true,
				onClick: onAddToLibrary,
			},
		reprocess: canEdit &&
			!processing && {
				key: "reprocess",
				label: m.assets_reprocess_action(),
				icon: RefreshCwIcon,
				overflow: true,
				onClick: onReprocess,
			},
		delete: hasCapability(asset.capabilities, "delete") && {
			key: "delete",
			label: m.assets_delete_action(),
			icon: Trash2Icon,
			destructive: true,
			onClick: onDelete,
		},
	};
};

/** The asset's actions for its tile and its page, with the dialog they open. */
const useAssetActions = (
	asset: ActionAsset,
	{
		onDeleted,
	}: {
		onDeleted?: () => Promise<void>;
	} = {},
) => {
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: addToLibrary } = useAddAssetToLibraryMutation();
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
	const { mutate: deleteAssets } = useDeleteAssetsMutation(
		{
			onSuccess: onDeleted,
		},
		{
			names: [
				asset.title,
			],
		},
	);

	return {
		actions: assetActions(asset, {
			onAccess: () => setIsAccessOpen(true),
			onAddToLibrary: () =>
				addToLibrary({
					id: asset.id,
				}),
			onReprocess: () =>
				reprocessAsset({
					id: asset.id,
				}),
			onDelete: () =>
				deleteAssets({
					refs: [
						{
							id: asset.id,
						},
					],
				}),
		}),
		dialog: hasCapability(asset.capabilities, "manage_access") ? (
			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "asset",
					id: asset.id,
				}}
				resourceName={asset.title}
			/>
		) : null,
	};
};

export { assetActions, useAssetActions };
