import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BotIcon, Move3dIcon, ServerIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
import { taskQueryOptions } from "@/lib/query-options/task";

const DatabaseBlockConfigCard = ({
	blockId,
	config,
	assetIds,
}: {
	blockId: DatabaseBlock["id"];
	config: DatabaseBlock["config"];
	assetIds: Asset["id"][];
}) => {
	const queryClient = useQueryClient();
	const { mutateAsync: createDatabaseBlockVectorStore } = useMutation(
		taskQueryOptions.createDatabaseBlockVectorStore(queryClient),
	);

	const handleCreateVectorStore = () => {
		toast.promise(
			createDatabaseBlockVectorStore({
				taskType: "extract",
				blockId,
			}),
			{
				success: "Vector store created successfully",
				loading: "Creating vector store...",
				error: "Failed to create vector store",
			},
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<BotIcon className="h-5 w-5" />
					AI Configuration
				</CardTitle>
				<CardDescription>
					Configure the AI model and settings for this block
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="space-y-2">
						<div className="font-medium text-sm">Provider</div>
						<div className="flex items-center gap-2">
							<ServerIcon className="h-4 w-4 text-muted-foreground" />
							<Badge variant="secondary" className="capitalize">
								{config.provider}
							</Badge>
						</div>
					</div>
					<div className="space-y-2">
						<div className="font-medium text-sm">Embedding Model</div>
						<div className="flex items-center gap-2">
							<Move3dIcon className="h-4 w-4 text-muted-foreground" />
							<Badge variant="default">{config.embeddingModel}</Badge>
						</div>
					</div>
				</div>

				<div className="space-y-3">
					<div className="font-medium text-sm">Reference Configuration</div>
					<div className="flex items-center gap-4">
						<div className="flex flex-col items-center gap-1">
							<div className="text-muted-foreground text-xs">Minimum</div>
							<Badge variant="outline">{config.minReferences}</Badge>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="text-muted-foreground text-xs">Default</div>
							<Badge variant="outline">{config.defaultReferences}</Badge>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="text-muted-foreground text-xs">Maximum</div>
							<Badge variant="outline">{config.maxReferences}</Badge>
						</div>
					</div>
				</div>

				<div>Assets: {assetIds.join(", ")}</div>
				<CardAction>
					<Button variant="outline" onClick={handleCreateVectorStore}>
						Create Vector Store
					</Button>
				</CardAction>
			</CardContent>
		</Card>
	);
};

export { DatabaseBlockConfigCard };
