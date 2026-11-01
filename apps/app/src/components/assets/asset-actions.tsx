import type {
	Asset,
	AssetWithCapabilities,
	ResourceOwner,
} from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
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
import { HandOverDialog } from "@/components/ownership/hand-over-dialog";
import type { HeaderAction } from "@/components/ui/shell/actions";
import {
	useAddAssetToLibraryMutation,
	useDeleteAssetsMutation,
	usePrepareAssetAgainMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

type ActionAsset = Pick<
	Asset,
	"id" | "title" | "origin" | "processingStatus"
> & {
	owner: Pick<ResourceOwner, "id">;
	capabilities?: AssetWithCapabilities["capabilities"];
	/**
	 * The asset's home organisation, as its page reads it (null when the reader
	 * cannot read it); left out on Library tiles, which list only the active
	 * organisation's own assets.
	 */
	organizationId?: string | null;
};

type Viewer = {
	id: string;
	activeOrganizationId: string | undefined;
};

/**
 * An asset's own actions, each present as far as its capabilities and state
 * allow. Its owner, the `viewer`, hands a Library asset over from its home
 * organisation.
 */
const assetActions = (
	asset: Omit<ActionAsset, "title">,
	{
		onAccess,
		onHandOver,
		onAddToLibrary,
		onPrepareAgain,
		onDelete,
	}: {
		onAccess: () => void;
		onHandOver: () => void;
		onAddToLibrary: () => void;
		onPrepareAgain: () => void;
		onDelete: () => void;
	},
	viewer: Viewer,
): Record<
	"edit" | "access" | "handOver" | "addToLibrary" | "prepareAgain" | "delete",
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
		handOver: asset.origin === "library" &&
			asset.owner.id === viewer.id &&
			(asset.organizationId === undefined ||
				asset.organizationId === viewer.activeOrganizationId) && {
				key: "hand-over",
				label: m.ownership_hand_over_action(),
				icon: HandshakeIcon,
				overflow: true,
				onClick: onHandOver,
			},
		addToLibrary: canEdit &&
			asset.origin === "chat" && {
				key: "add-to-library",
				label: m.assets_add_to_library_action(),
				icon: LibraryIcon,
				overflow: true,
				onClick: onAddToLibrary,
			},
		prepareAgain: canEdit &&
			!processing && {
				key: "prepareAgain",
				label: m.assets_prepare_again_action(),
				icon: RefreshCwIcon,
				overflow: true,
				onClick: onPrepareAgain,
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
		listing = false,
	}: {
		onDeleted?: () => Promise<void>;
		/** Offers listing in the catalogue, reading the asset's listing. */
		listing?: boolean;
	} = {},
) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const [isHandOverOpen, setIsHandOverOpen] = useState(false);
	const listingAction = useListingAction(
		{
			type: "asset",
			id: asset.id,
		},
		{
			enabled: listing && hasCapability(asset.capabilities, "manage_access"),
		},
	);
	const { mutate: addToLibrary } = useAddAssetToLibraryMutation();
	const { mutate: prepareAssetAgain } = usePrepareAssetAgainMutation();
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

	const actions = assetActions(
		asset,
		{
			onAccess: () => setIsAccessOpen(true),
			onHandOver: () => setIsHandOverOpen(true),
			onAddToLibrary: () =>
				addToLibrary({
					id: asset.id,
				}),
			onPrepareAgain: () =>
				prepareAssetAgain({
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
		},
		{
			id: auth.user.id,
			activeOrganizationId: auth.session.activeOrganizationId ?? undefined,
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
							type: "asset",
							id: asset.id,
						}}
						resourceName={asset.title}
					/>
				) : null}
				{actions.handOver ? (
					<HandOverDialog
						open={isHandOverOpen}
						onOpenChange={setIsHandOverOpen}
						resource={{
							resourceType: "asset",
							resourceId: asset.id,
						}}
						name={asset.title}
					/>
				) : null}
			</>
		),
	};
};

export { assetActions, useAssetActions };
