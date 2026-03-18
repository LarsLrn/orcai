import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/app/markdown";
import { ContentRenderer } from "@/components/editor/content-renderer";
import { Card, CardContent } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

const TemplateBlockConfigCard = ({
	config,
	description,
	contentHtml,
}: {
	config: TemplateBlock["config"];
	description: TemplateBlock["description"];
	contentHtml: TemplateBlock["contentHtml"];
}) => {
	const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);

	return (
		<Card>
			<CardContent className="space-y-6">
				{description && (
					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">{description}</p>
						<Separator className="my-4" />
					</div>
				)}

				{contentHtml && (
					<div className="space-y-2">
						<div className="prose prose-sm max-w-none">
							<ContentRenderer html={contentHtml} />
						</div>
					</div>
				)}

				{config.systemPrompt && (
					<div className="space-y-2">
						<Collapsible
							open={isSystemPromptOpen}
							onOpenChange={setIsSystemPromptOpen}
						>
							<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-4 py-3 text-left">
								<span className="font-medium text-sm">
									Show full system prompt
								</span>
								<ChevronDownIcon
									className={`size-4 text-muted-foreground transition-transform ${isSystemPromptOpen ? "rotate-180" : ""}`}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-2">
								<div className="rounded-md border bg-muted/30 p-4">
									<Markdown>{config.systemPrompt}</Markdown>
								</div>
							</CollapsibleContent>
						</Collapsible>
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
