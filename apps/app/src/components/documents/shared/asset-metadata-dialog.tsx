import type { Asset } from "@orcai/schema";
import { useState } from "react";
import {
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSaveAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import { m } from "@/paraglide/messages";

type EditableAsset = Pick<Asset, "id" | "title" | "metadata">;

const MetadataForm = ({
	asset,
	onSaved,
}: {
	asset: EditableAsset;
	onSaved: (asset: Asset) => void;
}) => {
	const [draft, setDraft] = useState({
		title: asset.title,
		metadata: asset.metadata ?? createDefaultAssetMetadata(),
	});
	const { mutateAsync: saveAsset, isPending } = useSaveAssetMutation();

	return (
		<>
			<ScrollArea className="max-h-[calc(88vh-14rem)]">
				<AssetMetadataEditor value={draft} onChange={setDraft} />
			</ScrollArea>

			<DialogFooter>
				<Button
					loading={isPending}
					onClick={async () => {
						const result = await saveAsset({
							id: asset.id,
							title: draft.title,
							metadata: draft.metadata,
						});

						if (result.status === "success") {
							onSaved(result.data.data);
						}
					}}
				>
					{m.assets_metadata_save_button()}
				</Button>
			</DialogFooter>
		</>
	);
};

/** Edits an asset's title and source details; Save writes them at once. */
const AssetMetadataDialog = ({
	asset,
	open,
	onOpenChange,
	onSaved,
}: {
	/** Left out while it loads. */
	asset: EditableAsset | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: (asset: Asset) => void;
}) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent className="max-h-[88vh] sm:max-w-3xl">
			<DialogHeader>
				<DialogTitle>{m.assets_selected_list_dialog_title()}</DialogTitle>
				<DialogDescription>
					{m.assets_selected_list_dialog_description()}
				</DialogDescription>
			</DialogHeader>

			{asset ? (
				<MetadataForm
					key={asset.id}
					asset={asset}
					onSaved={(saved) => {
						onSaved?.(saved);
						onOpenChange(false);
					}}
				/>
			) : null}
		</DialogContent>
	</Dialog>
);

export { AssetMetadataDialog };
