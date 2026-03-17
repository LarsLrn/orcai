import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectEmpty,
	DialogSelectFilter,
	DialogSelectFilters,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectPagination,
	DialogSelectSearch,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc/orpc";
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

	const PAGE_SIZE = 10;

	const [modelDialogOpen, setModelDialogOpen] = useState(false);
	const [providerFilter, setProviderFilter] = useState(
		templateBlock.config.provider,
	);

	// Sync filter when the saved provider loads asynchronously
	useEffect(() => {
		if (templateBlock.config.provider) {
			setProviderFilter(templateBlock.config.provider);
		}
	}, [
		templateBlock.config.provider,
	]);
	const [modelSearch, setModelSearch] = useState("");
	const [modelPage, setModelPage] = useState(0);

	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions({
			input: {
				organizationId: auth.session.activeOrganizationId,
				pageSize: 50,
			},
		}),
	);

	const { data: models, isLoading: modelsLoading } = useQuery(
		orpc.model.list.queryOptions({
			input: providerFilter
				? {
						filters: {
							providerId: providerFilter,
							capabilities: [
								"text",
							],
							search: modelSearch || undefined,
						},
						pageSize: PAGE_SIZE,
						pageIndex: modelPage,
					}
				: skipToken,
		}),
	);

	const { data: selectedModelData } = useQuery(
		orpc.model.find.queryOptions({
			input: templateBlock.config.model
				? {
						id: templateBlock.config.model,
					}
				: skipToken,
		}),
	);

	const pageCount = Math.ceil((models?.rowCount ?? 0) / PAGE_SIZE);
	const providerFilterOptions = providers.data.map((p) => ({
		value: p.id,
		label: p.name,
	}));

	return (
		<div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
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

			<Card className="h-fit">
				<CardHeader>
					<CardTitle>Model Settings</CardTitle>
					<CardDescription>
						Choose the AI model used for bot responses.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<DialogSelect
						value={templateBlock.config.model || null}
						onValueChange={(model) =>
							onChange({
								...templateBlock,
								config: {
									...templateBlock.config,
									model: model ?? "",
									provider: providerFilter,
								},
							})
						}
						open={modelDialogOpen}
						onOpenChange={setModelDialogOpen}
					>
						<DialogSelectTrigger
							className="w-full"
							placeholder="Choose a model..."
						>
							{selectedModelData?.data?.name}
						</DialogSelectTrigger>
						<DialogSelectContent title="Choose a text model">
							<DialogSelectSearch
								value={modelSearch}
								onValueChange={(v) => {
									setModelSearch(v);
									setModelPage(0);
								}}
								placeholder="Search models..."
							/>
							<DialogSelectFilters>
								<DialogSelectFilter
									value={providerFilter}
									onValueChange={(p) => {
										setProviderFilter(p);
										setModelSearch("");
										setModelPage(0);
									}}
									placeholder="Select a provider"
									options={providerFilterOptions}
								/>
							</DialogSelectFilters>
							<DialogSelectList loading={modelsLoading}>
								{(models?.data ?? []).map((model) => (
									<DialogSelectItem
										key={model.id}
										value={model.id}
										title={model.name}
										description={model.description || undefined}
									/>
								))}
								{!modelsLoading && (models?.data ?? []).length === 0 && (
									<DialogSelectEmpty>
										{providerFilter
											? "No models found."
											: "Select a provider to view models."}
									</DialogSelectEmpty>
								)}
							</DialogSelectList>
							<DialogSelectPagination
								page={modelPage}
								pageCount={pageCount}
								onPageChange={setModelPage}
							/>
						</DialogSelectContent>
					</DialogSelect>
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
