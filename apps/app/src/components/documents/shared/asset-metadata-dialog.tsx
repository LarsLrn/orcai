import type { Asset } from "@orcai/schema";
import { useState } from "react";
import { changedAssetFields } from "@/components/documents/shared/asset-metadata-changes";
import {
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
import { MetadataGeneration } from "@/components/documents/shared/metadata-generation";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useSaveAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import { m } from "@/paraglide/messages";

const MetadataForm = ({
	asset,
	onSaved,
}: {
	asset: Asset;
	onSaved: (asset: Asset) => void;
}) => {
	const [initial] = useState(() => ({
		title: asset.title,
		metadata: asset.metadata ?? createDefaultAssetMetadata(),
	}));
	const [draft, setDraft] = useState(initial);
	const [metadataGeneration, setMetadataGeneration] = useState<number>();
	const { mutateAsync: saveAsset, isPending } = useSaveAssetMutation();

	return (
		<>
			<DialogBody>
				<AssetMetadataEditor
					value={draft}
					onChange={setDraft}
					generation={
						<MetadataGeneration
							asset={asset}
							value={draft}
							onApply={(next, generation) => {
								setDraft(next);
								setMetadataGeneration(generation);
							}}
						/>
					}
				/>
			</DialogBody>

			<DialogFooter>
				<Button
					loading={isPending}
					onClick={async () => {
						const result = await saveAsset({
							id: asset.id,
							...changedAssetFields(initial, draft),
							metadataGeneration,
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
	asset: Asset | undefined;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: (asset: Asset) => void;
}) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent className="flex max-h-[88vh] flex-col sm:max-w-3xl">
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
