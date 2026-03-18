import { SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";

const createDefaultTemplateBlock = (params?: { botName: string }) => ({
	name: `AI Behaviour${params?.botName ? ` for '${params.botName}'` : ""}`,
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
		<div className="grid gap-5">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<SparklesIcon className="h-5 w-5" />
						AI Behaviour
					</CardTitle>
					<CardDescription>
						Define how the bot should respond, what tone it should use, and what
						rules it should follow.
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
