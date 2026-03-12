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
import type { Asset } from "@/lib/orpc/schemas/asset";

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
					<CardDescription>
						Edit the reusable metadata shown when this document is cited in AI
						answers.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">{asset.fileType}</Badge>
						<Badge variant="outline">{asset.size} bytes</Badge>
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
					Save Asset
				</Button>
			</div>
		</div>
	);
};

export { AssetForm };
