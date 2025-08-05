import { BotIcon, BuildingIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

const TemplateBlockConfigCard = ({
	config,
}: {
	config: TemplateBlock["config"];
}) => {
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
							<BuildingIcon className="h-4 w-4 text-muted-foreground" />
							<Badge variant="secondary" className="capitalize">
								{config.provider}
							</Badge>
						</div>
					</div>
					<div className="space-y-2">
						<div className="font-medium text-sm">Model</div>
						<div className="flex items-center gap-2">
							<BotIcon className="h-4 w-4 text-muted-foreground" />
							<Badge variant="default">{config.model}</Badge>
						</div>
					</div>
				</div>

				{config.systemPrompt && (
					<div className="space-y-2">
						<div className="font-medium text-sm">System Prompt</div>
						<div className="rounded-md border bg-muted/50 p-4">
							<pre className="whitespace-pre-wrap text-muted-foreground text-sm">
								{config.systemPrompt}
							</pre>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};

export { TemplateBlockConfigCard };
