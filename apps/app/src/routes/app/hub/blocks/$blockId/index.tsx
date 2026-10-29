import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { useBlockActions } from "@/components/blocks/block-actions";
import { DatabaseBlockConfigCard } from "@/components/blocks/database-block/database-config";
import { TemplateBlockConfigCard } from "@/components/blocks/template-block/template-config";
import { Badge } from "@/components/ui/badge";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	DetailHeader,
	DetailHeaderBand,
	DetailHeaderHeading,
	DetailHeaderIcon,
	DetailHeaderMeta,
	DetailHeaderTitle,
} from "@/components/ui/shell/detail-header";
import { Page, PageContent } from "@/components/ui/shell/page";
import { ResourceOwner } from "@/components/users/resource-owner";
import { orpc } from "@/lib/orpc/orpc";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { blockKind, RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/hub/blocks/$blockId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const navigate = useNavigate();

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

	const kind = blockKind(block.data.type);
	const { actions, dialog } = useBlockActions(block.data, {
		onDeleted: async () => {
			await navigate({
				to:
					kind === "repository"
						? "/app/hub/repositories"
						: "/app/hub/behaviour",
			});
		},
	});
	const { Icon, well, band, badge, label } = RESOURCE_KINDS[kind];
	const draft = block.data.status === "draft";

	return (
		<Page>
			<DetailHeader>
				<DetailHeaderBand className={cn(band, draft && "opacity-45 grayscale")}>
					<Icon />
				</DetailHeaderBand>
				<DetailHeaderIcon className={well}>
					<Icon />
				</DetailHeaderIcon>
				<DetailHeaderHeading>
					<DetailHeaderTitle>{block.data.name}</DetailHeaderTitle>
					<DetailHeaderMeta>
						<Badge variant={badge}>{label()}</Badge>
						{draft ? (
							<Badge variant="outline">
								{getPublicationStatusLabel("draft")}
							</Badge>
						) : null}
						<ResourceOwner owner={block.data.owner} />
					</DetailHeaderMeta>
					<HeaderActions
						actions={[
							actions.edit && {
								...actions.edit,
								variant: "default",
							},
							actions.access,
							actions.delete,
						]}
					/>
				</DetailHeaderHeading>
			</DetailHeader>

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

			{dialog}
		</Page>
	);
}
