import { blockTypeSchema } from "@orcai/schema";
import {
	createFileRoute,
	stripSearchParams,
	useNavigate,
} from "@tanstack/react-router";
import { BookOpenIcon, ImageIcon, SparklesIcon } from "lucide-react";
import { z } from "zod/v4";
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
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { blockSection } from "@/lib/navigation/block-section";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/blocks/add")({
	validateSearch: z.object({
		type: blockTypeSchema.catch("template").default("template"),
	}),
	search: {
		middlewares: [
			stripSearchParams({
				type: "template",
			}),
		],
	},
	loaderDeps: ({ search: { type } }) => ({
		type,
	}),
	loader: async ({ context: { queryClient }, deps: { type } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "create_block",
			redirectTo: blockSection(type).to,
		});
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_add_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const { type } = Route.useSearch();

	return (
		<Page>
			<PageHeader>
				<PageTitle>{m.blocks_add_page_title()}</PageTitle>
				<PageDescription>{m.blocks_add_page_description()}</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<div className="grid gap-4 md:grid-cols-3">
					{[
						{
							type: "template" as const,
							title: m.blocks_add_template_option_title(),
							description: m.blocks_add_template_option_description(),
							icon: SparklesIcon,
						},
						{
							type: "database" as const,
							title: m.blocks_add_database_option_title(),
							description: m.blocks_add_database_option_description(),
							icon: BookOpenIcon,
						},
						{
							type: "imageGeneration" as const,
							title: m.blocks_add_image_generation_option_title(),
							description: m.blocks_add_image_generation_option_description(),
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
								onClick={() =>
									void navigate({
										search: {
											type: option.type,
										},
										replace: true,
									})
								}
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
								? m.blocks_add_template_option_title()
								: type === "database"
									? m.blocks_add_database_option_title()
									: m.blocks_add_image_generation_option_title()}
						</CardTitle>
						<CardDescription>
							{type === "template"
								? m.blocks_add_template_form_description()
								: type === "database"
									? m.blocks_add_database_form_description()
									: m.blocks_add_image_generation_form_description()}
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
