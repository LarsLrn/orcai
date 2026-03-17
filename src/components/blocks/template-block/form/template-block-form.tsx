import type { Content } from "@tiptap/react";
import { useState } from "react";
import {
	createDefaultTemplateBlock,
	TemplateBlockEditor,
} from "@/components/authoring/template-block-editor";
import { BlockEditor } from "@/components/editor/block-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

type TemplateBlockFormValue = {
	id?: TemplateBlock["id"];
	name: TemplateBlock["name"];
	description: TemplateBlock["description"];
	contentJson: TemplateBlock["contentJson"];
	contentHtml: TemplateBlock["contentHtml"];
	type: "template";
	status: TemplateBlock["status"];
	config: TemplateBlock["config"];
};

const TemplateBlockForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: TemplateBlock;
}) => {
	const { mutate: createBlock, isPending: isCreating } =
		useCreateBlockMutation();
	const { mutate: updateBlock, isPending: isUpdating } =
		useUpdateBlockMutation();
	const [value, setValue] = useState<TemplateBlockFormValue>(
		block
			? {
					id: block.id,
					name: block.name,
					description: block.description,
					contentJson: block.contentJson,
					contentHtml: block.contentHtml,
					type: "template" as const,
					status: block.status,
					config: block.config,
				}
			: {
					...createDefaultTemplateBlock(),
				},
	);

	return (
		<div className="space-y-4">
			<TemplateBlockEditor
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
					<Label htmlFor="template-block-description">Short Description</Label>
					<Textarea
						id="template-block-description"
						value={value.description ?? ""}
						onChange={(event) =>
							setValue((current) => ({
								...current,
								description: event.target.value || null,
							}))
						}
						placeholder="Define the purpose of this block."
						rows={4}
					/>
				</CardContent>

				<CardContent className="space-y-2">
					<Label>
						Optional rich text context describing the modeled AI behaviour in
						detail.
					</Label>
					<BlockEditor
						content={
							value.contentJson ? (value.contentJson as Content) : undefined
						}
						onUpdate={(blockEditor) =>
							setValue((current) => ({
								...current,
								contentJson:
									blockEditor.getJSON() as TemplateBlock["contentJson"],
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
								type: "template",
								status: value.status,
								config: value.config,
							});
							return;
						}

						createBlock({
							name: value.name,
							description: value.description,
							contentJson: value.contentJson,
							contentHtml: value.contentHtml,
							type: "template",
							status: value.status,
							config: value.config,
						});
					}}
					disabled={isCreating || isUpdating}
				>
					{action === "create" ? "Save AI Behavior" : "Update AI Behavior"}
				</Button>
			</div>
		</div>
	);
};

export { TemplateBlockForm };
