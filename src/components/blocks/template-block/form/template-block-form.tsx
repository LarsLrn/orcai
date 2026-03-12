import { useState } from "react";
import {
	createDefaultTemplateBlock,
	TemplateBlockEditor,
} from "@/components/authoring/template-block-editor";
import { Button } from "@/components/ui/button";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

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
	const [value, setValue] = useState(
		block
			? {
					id: block.id,
					name: block.name,
					type: "template" as const,
					status: block.status,
					config: block.config,
				}
			: createDefaultTemplateBlock(),
	);

	return (
		<div className="space-y-4">
			<TemplateBlockEditor value={value} onChange={setValue} />
			<div className="flex justify-end">
				<Button
					onClick={() => {
						if (action === "update" && block) {
							updateBlock({
								id: block.id,
								name: value.name,
								type: "template",
								status: value.status,
								config: value.config,
							});
							return;
						}

						createBlock({
							name: value.name,
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
