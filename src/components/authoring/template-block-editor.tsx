import { SparklesIcon } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";

type TemplateBlockValue = NonNullable<BotEditorSelect["templateBlock"]>;

const createDefaultTemplateBlock = (params?: {
	botName: string;
}): TemplateBlockValue => ({
	name: `AI Behavior${params?.botName ? ` for '${params.botName}'` : ""}`,
	description: null,
	contentHtml: null,
	contentJson: null,
	type: "template",
	status: "draft",
	config: {
		systemPrompt: "",
	},
});

const TemplateBlockEditor = ({
	value,
	onChange,
}: {
	value?: TemplateBlockValue | null;
	onChange: (value: TemplateBlockValue) => void;
}) => {
	const templateBlock = value ?? createDefaultTemplateBlock();

	return (
		<div className="grid gap-5">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<SparklesIcon className="h-5 w-5" />
						AI Behavior
					</CardTitle>
					<CardDescription>
						Define how the bot should respond, what tone it should use, and what
						rules it should follow.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="template-block-name">Name</Label>
						<Input
							id="template-block-name"
							value={templateBlock.name}
							onChange={(event) =>
								onChange({
									...templateBlock,
									name: event.target.value,
								})
							}
							placeholder="AI Behavior"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="template-block-prompt">System Prompt</Label>
						<Textarea
							id="template-block-prompt"
							value={templateBlock.config.systemPrompt}
							onChange={(event) =>
								onChange({
									...templateBlock,
									config: {
										...templateBlock.config,
										systemPrompt: event.target.value,
									},
								})
							}
							placeholder="Explain the bot's role, response style, and constraints."
							rows={12}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export {
	createDefaultTemplateBlock,
	TemplateBlockEditor,
	type TemplateBlockValue,
};
