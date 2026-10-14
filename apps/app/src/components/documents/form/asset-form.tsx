import type { Asset } from "@orcai/schema";
import { useState } from "react";
import {
	AssetMetadataEditor,
	createDefaultAssetMetadata,
} from "@/components/documents/shared/asset-metadata-editor";
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
	const { mutate: saveAsset, isPending } = useSaveAssetMutation();
	const [value, setValue] = useState({
		title: asset.title,
		metadata: asset.metadata ?? createDefaultAssetMetadata(),
	});

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

					<AssetMetadataEditor value={value} onChange={setValue} />
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={() =>
						saveAsset({
							id: asset.id,
							title: value.title,
							metadata: value.metadata,
						})
					}
					disabled={isPending}
				>
					{m.assets_form_submit_button()}
				</Button>
			</div>
		</div>
	);
};

export { AssetForm };
