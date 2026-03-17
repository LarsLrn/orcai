import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRoundIcon, MoreVerticalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { MetadataCard } from "@/components/app/metadata-card";
import { DatabaseBlockConfigCard } from "@/components/blocks/database-block/database-config";
import { TemplateBlockConfigCard } from "@/components/blocks/template-block/template-config";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Page,
	PageAction,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/blocks/$blockId/")({
	component: RouteComponent,
});

const TYPE_LABELS: Record<string, string> = {
	template: "Template",
	database: "Database",
	imageGeneration: "Image Generation",
};

function RouteComponent() {
	const { blockId } = Route.useParams();
	const navigate = useNavigate();
	const [isAccessOpen, setIsAccessOpen] = useState(false);

	const { data: block } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: {
				id: blockId,
			},
		}),
	);
	const { data: visibility } = useSuspenseQuery(
		orpc.resource.getVisibility.queryOptions({
			input: {
				resourceType: "block",
				resourceId: blockId,
			},
		}),
	);

	const { mutate: deleteBlocks } = useDeleteBlocksMutation({
		onMutate: async () => {
			await navigate({
				to: "/app/hub/blocks",
			});
		},
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>{block.data.name}</PageTitle>
				<PageDescription>
					{TYPE_LABELS[block.data.type] ?? block.data.type} Block
				</PageDescription>
				<PageAction>
					<Button
						onClick={() =>
							navigate({
								to: "/app/hub/blocks/$blockId/edit",
								params: {
									blockId: block.data.id,
								},
							})
						}
					>
						Edit Block
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon">
									<MoreVerticalIcon className="size-4" />
									<span className="sr-only">More options</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setIsAccessOpen(true)}>
								<KeyRoundIcon className="size-4" />
								Access & Groups
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() =>
									deleteBlocks({
										refs: [
											{
												id: block.data.id,
											},
										],
									})
								}
							>
								<Trash2Icon />
								Delete Block
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</PageAction>
			</PageHeader>

			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{block.data.type === "template" && (
						<TemplateBlockConfigCard config={block.data.config} />
					)}
					{block.data.type === "database" && block.assets && (
						<DatabaseBlockConfigCard
							blockId={block.data.id}
							config={block.data.config}
							assets={block.assets}
						/>
					)}
				</div>

				<div className="space-y-6">
					<MetadataCard
						createdAt={block.data.createdAt}
						updatedAt={block.data.updatedAt}
						visibility={visibility.data.visibility}
						version={block.data.version}
						id={block.data.id}
					/>
				</div>
			</PageContent>

			<AccessDialog
				open={isAccessOpen}
				onOpenChange={setIsAccessOpen}
				resourceRef={{
					type: "block",
					id: block.data.id,
				}}
				resourceName={block.data.name}
			/>
		</Page>
	);
}
