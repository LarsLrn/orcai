import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EditIcon, KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { MetadataCard } from "@/components/app/metadata-card";
import { DatabaseBlockConfigCard } from "@/components/blocks/database-block/database-config";
import { TemplateBlockConfigCard } from "@/components/blocks/template-block/template-config";
import { Badge } from "@/components/ui/badge";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { useDeleteBlocksMutation } from "@/hooks/mutations/use-block-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import {
	getPublicationStatusLabel,
	getPublicationStatusVariant,
} from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/blocks/$blockId/")({
	component: RouteComponent,
});

const getBlockTypeLabel = (type: string) => {
	switch (type) {
		case "template":
			return m.blocks_detail_type_template();
		case "database":
			return m.blocks_detail_type_database();
		default:
			return type;
	}
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

	const isRepository = block.data.type === "database";
	const { mutate: deleteBlocks } = useDeleteBlocksMutation(
		{
			onSuccess: async () => {
				await navigate({
					to: isRepository ? "/app/hub/repositories" : "/app/hub/behaviour",
				});
			},
		},
		{
			names: [
				block.data.name,
			],
			kind: isRepository ? "repository" : "block",
		},
	);
	const canEdit = hasCapability(block.data.capabilities, "edit");
	const canDelete = hasCapability(block.data.capabilities, "delete");
	const canManageAccess = hasCapability(
		block.data.capabilities,
		"manage_access",
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{block.data.name}</PageTitle>
				<PageDescription>{getBlockTypeLabel(block.data.type)}</PageDescription>
				{block.data.status === "draft" ? (
					<div>
						<Badge variant={getPublicationStatusVariant(block.data.status)}>
							{getPublicationStatusLabel(block.data.status)}
						</Badge>
					</div>
				) : null}
				<HeaderActions
					actions={[
						canEdit && {
							key: "edit",
							label: m.blocks_detail_edit_action(),
							icon: EditIcon,
							variant: "default",
							linkProps: {
								to: "/app/hub/blocks/$blockId/edit",
								params: {
									blockId: block.data.id,
								},
							},
						},
						canManageAccess && {
							key: "access",
							label: m.blocks_detail_access_action(),
							icon: KeyRoundIcon,
							onClick: () => setIsAccessOpen(true),
						},
						canDelete && {
							key: "delete",
							label: m.blocks_detail_delete_action(),
							icon: Trash2Icon,
							destructive: true,
							onClick: () =>
								deleteBlocks({
									refs: [
										{
											id: block.data.id,
										},
									],
								}),
						},
					]}
				/>
			</PageHeader>

			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
							explorable={block.data.status === "ready"}
						/>
					)}
				</div>

				<div className="space-y-6">
					<MetadataCard
						createdAt={block.data.createdAt}
						updatedAt={block.data.updatedAt}
						visibility={visibility.data.visibility}
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
