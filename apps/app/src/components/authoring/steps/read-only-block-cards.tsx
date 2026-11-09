import type { AssetState } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useRepositoryReadiness } from "@/components/assets/readiness/use-repository-readiness";
import type {
	BotEditorBehaviour,
	BotEditorRepository,
} from "@/components/authoring/bot-editor-form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useEmbeddingsConfigured } from "@/hooks/use-embeddings-configured";
import { assetStateBadge } from "@/lib/labels/asset-state";
import { m } from "@/paraglide/messages";

const ReadOnlyBehaviourCard = ({ block }: { block: BotEditorBehaviour }) => {
	const navigate = useNavigate();

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>{m.authoring_readonly_behaviour_title()}</CardTitle>
				<CardDescription>
					{m.authoring_readonly_behaviour_description()}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="font-medium">{block.name}</div>
				{block.description ? (
					<div className="text-muted-foreground text-sm">
						{block.description}
					</div>
				) : null}
				{block.id ? (
					<Button
						variant="outline"
						onClick={() =>
							block.id
								? navigate({
										to: "/app/library/$kind/$blockId",
										params: {
											kind: "behaviour",
											blockId: block.id,
										},
									})
								: undefined
						}
					>
						{m.authoring_readonly_open_block_action()}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

/** An asset's state in the repository; nothing once it is ready. */
const AssetStateBadge = ({ state }: { state: AssetState | undefined }) => {
	const embeddingsConfigured = useEmbeddingsConfigured();
	if (!state || state === "ready") return null;
	const { label, variant } = assetStateBadge(state, embeddingsConfigured);
	return <Badge variant={variant}>{label}</Badge>;
};

const ReadOnlyRepositoryCard = ({
	block,
	onDetach,
}: {
	block: BotEditorRepository;
	onDetach: () => void;
}) => {
	const navigate = useNavigate();
	const { data: readiness } = useRepositoryReadiness(
		block.id
			? [
					block.id,
				]
			: [],
	);
	const stateById = new Map(
		readiness?.data[0]?.assets.map((asset) => [
			asset.assetId,
			asset.state,
		]),
	);

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div className="min-w-0">
					<CardTitle className="text-base">{block.name}</CardTitle>
					<CardDescription>
						{m.authoring_readonly_repository_description()}
					</CardDescription>
				</div>
				<Button variant="outline" size="sm" onClick={onDetach}>
					{m.authoring_readonly_detach_action()}
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="text-muted-foreground text-sm">
					{m.authoring_attached_asset_count({
						count: block.assetIds.length,
					})}
				</div>
				{block.assets.length > 0 ? (
					<ul className="bg-muted/20 space-y-2 rounded-xl border p-3 text-sm">
						{block.assets.map((asset) => (
							<li
								key={asset.id}
								className="flex items-center justify-between gap-2"
							>
								<span className="truncate">{asset.title}</span>
								<AssetStateBadge state={stateById.get(asset.id)} />
							</li>
						))}
					</ul>
				) : null}
				{block.id ? (
					<Button
						variant="outline"
						onClick={() =>
							block.id
								? navigate({
										to: "/app/library/$kind/$blockId",
										params: {
											kind: "repository",
											blockId: block.id,
										},
									})
								: undefined
						}
					>
						{m.authoring_readonly_open_block_action()}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

export { ReadOnlyBehaviourCard, ReadOnlyRepositoryCard };
