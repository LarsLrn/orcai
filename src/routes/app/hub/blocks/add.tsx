import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon, ImageIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { DatabaseBlockForm } from "@/components/blocks/database-block/form/database-block-form";
import { ImageGenerationBlockForm } from "@/components/blocks/image-generation-block/form/image-generation-block-form";
import { TemplateBlockForm } from "@/components/blocks/template-block/form/template-block-form";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/hub/blocks/add")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Add Capability",
			},
		],
	}),
});

function RouteComponent() {
	const [type, setType] = useState<"template" | "database" | "imageGeneration">(
		"template",
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Add Capability</PageTitle>
				<PageDescription>
					Create reusable AI behavior or knowledge-source blocks with the same
					editors used in the guided bot setup.
				</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<div className="grid gap-4 md:grid-cols-3">
					{[
						{
							type: "template" as const,
							title: "AI Behavior",
							description: "Define how the assistant should respond.",
							icon: SparklesIcon,
						},
						{
							type: "database" as const,
							title: "Knowledge Source",
							description: "Attach documents and retrieval settings.",
							icon: BookOpenIcon,
						},
						{
							type: "imageGeneration" as const,
							title: "Image Generation",
							description: "Configure image-generation behavior.",
							icon: ImageIcon,
						},
					].map((option) => {
						const Icon = option.icon;
						return (
							<button
								type="button"
								key={option.type}
								className={cn(
									"rounded-2xl border p-5 text-left transition-colors",
									type === option.type && "border-primary bg-primary/5",
								)}
								onClick={() => setType(option.type)}
							>
								<Icon className="mb-4 h-5 w-5" />
								<div className="font-medium">{option.title}</div>
								<div className="mt-1 text-muted-foreground text-sm">
									{option.description}
								</div>
							</button>
						);
					})}
				</div>

				<Card>
					<CardHeader>
						<CardTitle>
							{type === "template"
								? "AI Behavior"
								: type === "database"
									? "Knowledge Source"
									: "Image Generation"}
						</CardTitle>
						<CardDescription>
							{type === "template"
								? "Configure a reusable AI behavior block."
								: type === "database"
									? "Configure a reusable knowledge source block."
									: "Configure a reusable image-generation block."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{type === "template" ? <TemplateBlockForm action="create" /> : null}
						{type === "database" ? <DatabaseBlockForm action="create" /> : null}
						{type === "imageGeneration" ? (
							<ImageGenerationBlockForm action="create" />
						) : null}
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
