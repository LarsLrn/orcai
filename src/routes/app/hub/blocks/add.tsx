import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DatabaseBlockForm } from "@/components/blocks/database-block/form/database-block-form";
import { ImageGenerationBlockForm } from "@/components/blocks/image-generation-block/form/image-generation-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block/form/template-block-form";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { BLOCK_TYPES } from "@/lib/orpc/schemas/block";

export const Route = createFileRoute("/app/hub/blocks/add")({
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
	const [type, setType] = useState<string | null>();

	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Block</PageTitle>
			</PageHeader>
			<PageContent>
				<Select
					value={type ?? undefined}
					onValueChange={(value) => setType(value)}
				>
					<SelectTrigger className="w-50">
						<SelectValue>
							{(value) =>
								BLOCK_TYPES.find((blockType) => blockType.value === value)
									?.label || "Select block type"
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Type</SelectLabel>
							{BLOCK_TYPES.map((blockType) => (
								<SelectItem key={blockType.value} value={blockType.value}>
									{blockType.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				{type === "template" && <TemplateBlockForm action="create" />}
				{type === "database" && <DatabaseBlockForm action="create" />}
				{type === "imageGeneration" && (
					<ImageGenerationBlockForm action="create" />
				)}
			</PageContent>
		</Page>
	);
}
