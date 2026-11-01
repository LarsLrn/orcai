import type { RetrievedAssetPoint } from "@orcai/schema";
import { Markdown } from "@/components/app/markdown";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatPageRange } from "@/lib/ai/tools/rag/format-page-range";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { DisplayPointImage } from "./display-point-image";

const formatScore = (score: number) =>
	new Intl.NumberFormat(getLocale(), {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	}).format(score);

const DisplayPoint = ({
	point,
	showScore = false,
}: {
	point: RetrievedAssetPoint;
	/** For a search hit; browsed points carry no score. */
	showScore?: boolean;
}) => {
	const { id, payload, score } = point;
	const hasScore = showScore && Number.isFinite(score);
	const imageObjectKey =
		payload.source === "image" ? payload.file_reference : undefined;
	const pageRange = formatPageRange({
		chunkPageStart: payload.chunkPageStart,
		chunkPageEnd: payload.chunkPageEnd,
		documentTotalPages: payload.documentTotalPages,
	});

	return (
		<Card className="h-full">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<CardTitle className="wrap-break-word text-lg leading-tight">
							{point.title || payload.source || id}
						</CardTitle>
						<CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
							{payload.source && (
								<span className="font-medium text-foreground">
									{payload.source}
								</span>
							)}
							{payload.createdAt && (
								<>
									{payload.source && (
										<span className="text-muted-foreground">•</span>
									)}
									<span>{payload.createdAt}</span>
								</>
							)}
						</CardDescription>
					</div>
					{hasScore && (
						<Badge variant="secondary" className="mt-1 font-mono text-xs">
							{m.assets_point_score_badge({
								score: formatScore(score),
							})}
						</Badge>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<Badge variant="outline" className="font-mono">
						{m.assets_point_id_badge({
							id,
						})}
					</Badge>
					{payload.block_id && (
						<Badge variant="outline" className="font-mono">
							{m.assets_point_block_badge({
								id: payload.block_id,
							})}
						</Badge>
					)}
					{payload.asset_id && (
						<Badge variant="outline" className="font-mono">
							{m.assets_point_asset_badge({
								id: payload.asset_id,
							})}
						</Badge>
					)}
					<HoverCard>
						<HoverCardTrigger
							render={
								<Badge
									variant="outline"
									className="cursor-pointer border border-dashed text-muted-foreground"
								>
									{m.assets_point_details_badge()}
								</Badge>
							}
						/>
						<HoverCardContent className="space-y-2">
							{typeof payload.depth === "number" && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>{m.assets_point_depth_label()}</span>
									<span className="font-medium text-foreground">
										{payload.depth}
									</span>
								</div>
							)}
							{typeof payload.chunk_index === "number" &&
								payload.chunkCount != null && (
									<div className="flex items-center justify-between text-muted-foreground text-sm">
										<span>{m.assets_point_passage_label()}</span>
										<span className="font-medium text-foreground">
											{payload.chunk_index + 1} / {payload.chunkCount}
										</span>
									</div>
								)}
							{typeof payload.tokens === "number" && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>{m.assets_point_tokens_label()}</span>
									<span className="font-medium text-foreground">
										{payload.tokens}
									</span>
								</div>
							)}
							{pageRange && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>{m.assets_point_pages_label()}</span>
									<span className="font-medium text-foreground">
										{pageRange}
									</span>
								</div>
							)}
						</HoverCardContent>
					</HoverCard>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<div
					className={cn(
						"rounded-xl bg-background/60 p-4",
						imageObjectKey && "grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]",
					)}
				>
					<Markdown className="prose prose-sm dark:prose-invert max-w-none">
						{payload.text ?? ""}
					</Markdown>
					{imageObjectKey && (
						<DisplayPointImage
							assetId={payload.asset_id}
							objectKey={imageObjectKey}
						/>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export { DisplayPoint };
