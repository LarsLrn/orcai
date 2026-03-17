import type { Content } from "@tiptap/react";
import { useState } from "react";
import {
	createDefaultDatabaseBlock,
	DatabaseBlockEditor,
} from "@/components/authoring/database-block-editor";
import { PublicationStatusField } from "@/components/blocks/form/publication-status-field";
import { BlockEditor } from "@/components/editor/block-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
	assets?: DatabaseBlockValue["assets"];
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
					description: block.description,
					contentJson: block.contentJson,
					contentHtml: block.contentHtml,
					type: "database",
					status: block.status,
					config: {
						...block.config,
						retrievalMode: block.config.retrievalMode ?? "hybrid",
						scoreThreshold: block.config.scoreThreshold ?? 0.2,
						candidateLimit: block.config.candidateLimit ?? 40,
						maxPerAsset: block.config.maxPerAsset ?? 6,
					},
					assetIds: assets?.map((entry) => entry.id) ?? [],
					assets: assets ?? [],
				}
			: {
					...createDefaultDatabaseBlock(),
				},
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardContent>
					<PublicationStatusField
						value={value.status}
						onChange={(status) =>
							setValue((current) => ({
								...current,
								status,
							}))
						}
					/>
				</CardContent>
			</Card>
			<DatabaseBlockEditor
				value={value}
				onChange={(nextValue) =>
					setValue((current) => ({
						...current,
						...nextValue,
					}))
				}
			/>

			<Card>
				<CardContent className="space-y-2">
					<Label htmlFor="database-block-description">Short Description</Label>
					<Textarea
						id="database-block-description"
						value={value.description ?? ""}
						onChange={(event) =>
							setValue((current) => ({
								...current,
								description: event.target.value || null,
							}))
						}
						placeholder="Describe what this content collection is used for."
						rows={4}
					/>
				</CardContent>

				<CardContent className="space-y-2">
					<Label>
						Optional rich text about this content collection, what it includes,
						how to use it, or any other relevant information.
					</Label>
					<BlockEditor
						content={
							value.contentJson ? (value.contentJson as Content) : undefined
						}
						onUpdate={(blockEditor) =>
							setValue((current) => ({
								...current,
								contentJson:
									blockEditor.getJSON() as DatabaseBlock["contentJson"],
								contentHtml: blockEditor.getHTML(),
							}))
						}
					/>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={() => {
						if (action === "update" && block) {
							updateBlock({
								id: block.id,
								name: value.name,
								description: value.description,
								contentJson: value.contentJson,
								contentHtml: value.contentHtml,
								type: "database",
								status: value.status,
								config: value.config,
								assets: value.assetIds,
							});
							return;
						}

						createBlock({
							name: value.name,
							description: value.description,
							contentJson: value.contentJson,
							contentHtml: value.contentHtml,
							type: "database",
							status: value.status,
							config: value.config,
							assets: value.assetIds,
						});
					}}
					disabled={isCreating || isUpdating}
				>
					{action === "create"
						? "Save Content Collection"
						: "Update Content Collection"}
				</Button>
			</div>
		</div>
	);
};

export { DatabaseBlockForm };
