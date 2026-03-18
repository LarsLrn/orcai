import { BotIcon } from "lucide-react";
import { Markdown } from "@/components/app/markdown";
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
					AI Behaviour
				</CardTitle>
				<CardDescription>
					Define system-level instructions for chats that use this block
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{config.systemPrompt && (
					<div className="space-y-2">
						<div className="font-medium text-sm">System Prompt</div>
						<div className="rounded-md border bg-muted/30 p-4">
							<Markdown>{config.systemPrompt}</Markdown>
						</div>
					</div>
				)}
				{!config.systemPrompt && (
					<p className="text-muted-foreground text-sm">
						No system prompt configured.
					</p>
				)}
			</CardContent>
		</Card>
	);
};

export { TemplateBlockConfigCard };
