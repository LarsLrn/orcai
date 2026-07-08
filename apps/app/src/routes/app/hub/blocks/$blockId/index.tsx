import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	EditIcon,
	KeyRoundIcon,
	MoreVerticalIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { MetadataCard } from "@/components/app/metadata-card";
import { DatabaseBlockConfigCard } from "@/components/blocks/database-block/database-config";
import { TemplateBlockConfigCard } from "@/components/blocks/template-block/template-config";
import { Badge } from "@/components/ui/badge";
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
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/blocks/$blockId/")({
	component: RouteComponent,
});

const TYPE_LABELS: Record<string, string> = {
	template: "AI Behaviour",
	database: "Content Collection",
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
				to:
					block.data.type === "database"
						? "/app/hub/repositories"
						: "/app/hub/behaviour",
			});
		},
	});
	const canEdit = hasCapability(block.data.capabilities, "edit");
	const canDelete = hasCapability(block.data.capabilities, "delete");
	const canManageAccess = hasCapability(
		block.data.capabilities,
		"manage_access",
	);
	const hasMenuActions = canManageAccess || canEdit || canDelete;

	return (
		<Page>
			<PageHeader>
				<PageTitle>{block.data.name}</PageTitle>
				<PageDescription>
					{TYPE_LABELS[block.data.type] ?? block.data.type}
				</PageDescription>
				{block.data.status === "draft" ? (
					<div>
						<Badge variant="destructive">Draft</Badge>
					</div>
				) : null}
				<PageAction>
					{hasMenuActions ? (
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
								{canManageAccess ? (
									<DropdownMenuItem onClick={() => setIsAccessOpen(true)}>
										<KeyRoundIcon className="size-4" />
										Access & Groups
									</DropdownMenuItem>
								) : null}
								{canEdit ? (
									<DropdownMenuItem
										onClick={() =>
											navigate({
												to: "/app/hub/blocks/$blockId/edit",
												params: {
													blockId: block.data.id,
												},
											})
										}
									>
										<EditIcon />
										Edit Block
									</DropdownMenuItem>
								) : null}
								{canDelete ? <DropdownMenuSeparator /> : null}
								{canDelete ? (
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
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					) : null}
				</PageAction>
			</PageHeader>

			<PageContent className="grid gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{block.data.type === "template" && (
						<TemplateBlockConfigCard
							config={block.data.config}
							description={block.data.description}
							contentJson={block.data.contentJson}
						/>
					)}
					{block.data.type === "database" && block.assets && (
						<DatabaseBlockConfigCard
							blockId={block.data.id}
							config={block.data.config}
							description={block.data.description}
							contentJson={block.data.contentJson}
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

			{canManageAccess ? (
				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "block",
						id: block.data.id,
					}}
					resourceName={block.data.name}
				/>
			) : null}
		</Page>
	);
}
