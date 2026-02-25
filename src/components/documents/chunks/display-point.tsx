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
import type { QdrantPoint } from "@/types/qdrant";

const DisplayPoint = ({ point }: { point: QdrantPoint }) => {
	const { id, payload, score } = point;
	const hasScore = typeof score === "number" && Number.isFinite(score);

	return (
		<Card className="h-full">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<CardTitle className="wrap-break-word text-lg leading-tight">
							{payload.title || payload.source || id}
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
							Score {score.toFixed(3)}
						</Badge>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<Badge variant="outline" className="font-mono">
						Point {id}
					</Badge>
					{payload.block_id && (
						<Badge variant="outline" className="font-mono">
							Block {payload.block_id}
						</Badge>
					)}
					{payload.asset_id && (
						<Badge variant="outline" className="font-mono">
							Asset {payload.asset_id}
						</Badge>
					)}
					<HoverCard>
						<HoverCardTrigger
							render={
								<Badge
									variant="outline"
									className="cursor-pointer border border-dashed text-muted-foreground"
								>
									Details
								</Badge>
							}
						/>
						<HoverCardContent className="space-y-2">
							{typeof payload.depth === "number" && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>Depth</span>
									<span className="font-medium text-foreground">
										{payload.depth}
									</span>
								</div>
							)}
							{typeof payload.chunk_index === "number" &&
								payload.chunkCount != null && (
									<div className="flex items-center justify-between text-muted-foreground text-sm">
										<span>Chunk</span>
										<span className="font-medium text-foreground">
											{payload.chunk_index + 1} / {payload.chunkCount}
										</span>
									</div>
								)}
							{typeof payload.tokens === "number" && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>Tokens</span>
									<span className="font-medium text-foreground">
										{payload.tokens}
									</span>
								</div>
							)}
							{typeof payload.page === "number" && (
								<div className="flex items-center justify-between text-muted-foreground text-sm">
									<span>Page</span>
									<span className="font-medium text-foreground">
										{payload.page + 1}
									</span>
								</div>
							)}
						</HoverCardContent>
					</HoverCard>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="rounded-lg bg-background/60 p-4">
					<Markdown className="prose prose-sm dark:prose-invert max-w-none">
						{payload.text ?? ""}
					</Markdown>
				</div>
			</CardContent>
		</Card>
	);
};

export { DisplayPoint };
