import type { Asset } from "@orcai/schema";
import { useState } from "react";
import { changedAssetFields } from "@/components/assets/shared/asset-metadata-changes";
import {
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/assets/shared/asset-metadata-editor";
import { MetadataGeneration } from "@/components/assets/shared/metadata-generation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSaveAssetMutation } from "@/hooks/mutations/use-asset-mutations";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import { formatFileSize } from "@/lib/presentation/format-file-size";
import { m } from "@/paraglide/messages";

const AssetForm = ({ asset }: { asset: Asset }) => {
	const { mutateAsync: saveAsset, isPending } = useSaveAssetMutation();
	const [initial, setInitial] = useState(() => ({
		title: asset.title,
		metadata: asset.metadata ?? createDefaultAssetMetadata(),
	}));
	const [value, setValue] = useState(initial);
	const [metadataGeneration, setMetadataGeneration] = useState<number>();

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>{asset.title}</CardTitle>
					<CardDescription>{m.assets_form_description()}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">
							{getFileTypeLabel(asset.fileType)}
						</Badge>
						<Badge variant="outline">{formatFileSize(asset.size)}</Badge>
					</div>

					<AssetMetadataEditor
						value={value}
						onChange={setValue}
						generation={
							<MetadataGeneration
								asset={asset}
								value={value}
								onApply={(next, generation) => {
									setValue(next);
									setMetadataGeneration(generation);
								}}
							/>
						}
					/>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={async () => {
						const sent = value;
						const result = await saveAsset({
							id: asset.id,
							...changedAssetFields(initial, sent),
							metadataGeneration,
						});

						if (result.status === "success") {
							const saved = {
								title: result.data.data.title,
								metadata: result.data.data.metadata,
							};
							setInitial(saved);
							// Edits typed while saving stay, to be saved next.
							setValue((current) => (current === sent ? saved : current));
						}
					}}
					loading={isPending}
				>
					{m.assets_form_submit_button()}
				</Button>
			</div>
		</div>
	);
};

export { AssetForm };
