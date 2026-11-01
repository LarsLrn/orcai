import type { BlockId } from "@orcai/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MetadataCard } from "@/components/app/metadata-card";
import { BehaviourConfigCard } from "@/components/blocks/behaviour/behaviour-config";
import { useBlockActions } from "@/components/blocks/block-actions";
import { RepositoryConfigCard } from "@/components/blocks/repository/repository-config";
import { ResourceProvenance } from "@/components/catalogue/resource-provenance";
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
import { blockPaths } from "@/lib/navigation/block-paths";
import { orpc } from "@/lib/orpc/orpc";
import { getPublicationStatusLabel } from "@/lib/presentation/publication-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { cn } from "@/lib/utils";

export const BlockDetailPage = ({ blockId }: { blockId: BlockId }) => {
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

	const kind = block.data.type;
	const { actions, dialog } = useBlockActions(block.data, {
		listing: true,
		onDeleted: async () => {
			await navigate({
				to: blockPaths(block.data.type).list,
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
						<ResourceProvenance
							owner={block.data.owner}
							homeOrganization={block.data.homeOrganization}
						/>
					</DetailHeaderMeta>
					<HeaderActions
						actions={[
							actions.edit && {
								...actions.edit,
								variant: "default",
							},
							actions.access,
							actions.handOver,
							actions.listing,
							actions.delete,
							actions.remove,
						]}
					/>
				</DetailHeaderHeading>
			</DetailHeader>

			<PageContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					{block.data.type === "behaviour" && (
						<BehaviourConfigCard
							config={block.data.config}
							description={block.data.description}
							contentJson={block.data.contentJson}
						/>
					)}
					{block.data.type === "repository" && block.assets && (
						<RepositoryConfigCard
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
};
