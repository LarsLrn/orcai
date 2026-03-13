import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc/orpc";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";

type TemplateBlockValue = NonNullable<BotEditorSelect["templateBlock"]>;

const createDefaultTemplateBlock = (): TemplateBlockValue => ({
	name: "AI Behavior",
	type: "template",
	status: "draft",
	config: {
		provider: "",
		model: "",
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
	const { auth } = useRouteContext({
		from: "/app",
	});

	const templateBlock = value ?? createDefaultTemplateBlock();

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {
				organizationId: auth.session.activeOrganizationId,
			},
		}),
	);

	const { data: models } = useQuery(
		orpc.model.list.queryOptions({
			input: templateBlock.config.provider
				? {
						filters: {
							providerId: templateBlock.config.provider,
							capabilities: [
								"text",
							],
						},
					}
				: skipToken,
		}),
	);

	const providerOptions = providers.data;
	const selectedProvider = providerOptions.find(
		(provider) => provider.id === templateBlock.config.provider,
	);
	const modelOptions = models?.data ?? [];
	const selectedModel = modelOptions.find(
		(model) => model.id === templateBlock.config.model,
	);
	const providerItems =
		templateBlock.config.provider && !selectedProvider
			? [
					...providerOptions,
					{
						id: templateBlock.config.provider,
						name: templateBlock.config.provider,
					},
				]
			: providerOptions;
	const modelItems =
		templateBlock.config.model && !selectedModel
			? [
					...modelOptions,
					{
						id: templateBlock.config.model,
						name: templateBlock.config.model,
					},
				]
			: modelOptions;

	return (
		<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
			<Card className="border-border/70 bg-background shadow-sm">
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

			<Card className="h-fit border-border/70 bg-muted/15 shadow-sm">
				<CardHeader>
					<CardTitle>Model Settings</CardTitle>
					<CardDescription>
						Choose the provider and text model used for bot responses.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="template-block-provider">Provider</Label>
						<Select
							id="template-block-provider"
							value={templateBlock.config.provider || undefined}
							onValueChange={(provider) =>
								onChange({
									...templateBlock,
									config: {
										...templateBlock.config,
										provider: provider ?? "",
										model: "",
									},
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Choose a provider">
									{templateBlock.config.provider}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{providerItems.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="template-block-model">Text Model</Label>
						<Select
							id="template-block-model"
							value={templateBlock.config.model || undefined}
							onValueChange={(model) =>
								onChange({
									...templateBlock,
									config: {
										...templateBlock.config,
										model: model ?? "",
									},
								})
							}
							disabled={!templateBlock.config.provider}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Choose a model" />
							</SelectTrigger>
							<SelectContent>
								{modelItems.map((model) => (
									<SelectItem key={model.id} value={model.id}>
										{model.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export {
	TemplateBlockEditor,
	createDefaultTemplateBlock,
	type TemplateBlockValue,
};
