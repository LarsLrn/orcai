import type { TemplateBlock } from "@orcai/schema";
import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";

const createDefaultTemplateBlock = (params?: { botName: string }) => ({
	name: params?.botName
		? m.authoring_template_block_default_name_named({
				botName: params.botName,
			})
		: m.authoring_template_block_default_name(),
	description: "",
	contentHtml: "",
	contentJson: null,
	type: "template" as const,
	status: "draft" as TemplateBlock["status"],
	config: {
		systemPrompt: "",
	},
});

const TemplateBlockEditor = ({
	nameField,
	systemPromptField,
	descriptionField,
	contentField,
}: {
	nameField: ReactNode;
	systemPromptField: ReactNode;
	descriptionField: ReactNode;
	contentField: ReactNode;
}) => {
	return (
		<div className="grid min-w-0 grid-cols-1 gap-5">
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<SparklesIcon className="h-5 w-5" />
						{m.authoring_template_block_title()}
					</CardTitle>
					<CardDescription>
						{m.authoring_template_block_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{nameField}
					{systemPromptField}
					{descriptionField}
					{contentField}
				</CardContent>
			</Card>
		</div>
	);
};

export { createDefaultTemplateBlock, TemplateBlockEditor };
