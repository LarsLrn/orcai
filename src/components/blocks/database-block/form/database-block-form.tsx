import { useState } from "react";
import {
	createDefaultDatabaseBlock,
	DatabaseBlockEditor,
} from "@/components/authoring/database-block-editor";
import { Button } from "@/components/ui/button";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";

type DatabaseBlockValue = BotEditorSelect["databaseBlocks"][number];

const DatabaseBlockForm = ({
	action,
	block,
	assets,
}: {
	action: "create" | "update";
	block?: DatabaseBlock;
	assets?: DatabaseBlockValue["attachments"];
}) => {
	const { mutate: createBlock, isPending: isCreating } =
		useCreateBlockMutation();
	const { mutate: updateBlock, isPending: isUpdating } =
		useUpdateBlockMutation();
	const [value, setValue] = useState<DatabaseBlockValue>(
		block
			? {
					id: block.id,
					name: block.name,
					type: "database",
					status: block.status,
					config: {
						...block.config,
						retrievalMode: block.config.retrievalMode ?? "hybrid",
						scoreThreshold: block.config.scoreThreshold ?? 0.2,
						candidateLimit: block.config.candidateLimit ?? 40,
						maxPerAsset: block.config.maxPerAsset ?? 6,
					},
					assetIds: assets?.map((entry) => entry.asset.id) ?? [],
					attachments: assets ?? [],
				}
			: createDefaultDatabaseBlock(),
	);

	return (
		<div className="space-y-4">
			<DatabaseBlockEditor value={value} onChange={setValue} />
			<div className="flex justify-end">
				<Button
					onClick={() => {
						if (action === "update" && block) {
							updateBlock({
								id: block.id,
								name: value.name,
								type: "database",
								status: value.status,
								config: value.config,
								assets: value.assetIds,
							});
							return;
						}

						createBlock({
							name: value.name,
							type: "database",
							status: value.status,
							config: value.config,
							assets: value.assetIds,
						});
					}}
					disabled={isCreating || isUpdating}
				>
					{action === "create"
						? "Save Knowledge Source"
						: "Update Knowledge Source"}
				</Button>
			</div>
		</div>
	);
};

export { DatabaseBlockForm };
