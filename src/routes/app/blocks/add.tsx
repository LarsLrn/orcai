import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BLOCK_TYPE_CONFIGS } from "@/components/blocks/builder/bot-builder-config";
import { DatabaseBlockForm } from "@/components/blocks/database-block-form";
import { ImageGenerationBlockForm } from "@/components/blocks/image-generation-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block-form";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/blocks/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add",
			},
		],
	}),
});

function RouteComponent() {
	const [type, setType] = useState<string | undefined>();

	return (
		<div className="space-y-4">
			<Select onValueChange={(value) => setType(value)}>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Select a block type" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Type</SelectLabel>
						{BLOCK_TYPE_CONFIGS.map((config) => (
							<SelectItem key={config.type} value={config.type}>
								{config.activeLabel}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
			{type === "template" && <TemplateBlockForm />}
			{type === "database" && <DatabaseBlockForm />}
			{type === "imageGeneration" && <ImageGenerationBlockForm />}
		</div>
	);
}
