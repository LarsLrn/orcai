import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Content } from "@tiptap/react";
import {
	BookOpenIcon,
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FileTextIcon,
	LockKeyholeIcon,
	RocketIcon,
	SparklesIcon,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { AccessManagerContent } from "@/components/access/access-manager-content";
import {
	createDefaultDatabaseBlock,
	DatabaseBlockEditor,
} from "@/components/authoring/database-block-editor";
import { ExistingBlockPickerDialog } from "@/components/authoring/existing-block-picker-dialog";
import {
	createDefaultTemplateBlock,
	TemplateBlockEditor,
} from "@/components/authoring/template-block-editor";
import { BlockEditor } from "@/components/editor/block-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	useResourceGrants,
	useResourceVisibility,
} from "@/hooks/authz/use-resource-access";
import {
	usePublishBotMutation,
	useSaveBotMutation,
} from "@/hooks/mutations/use-bot-mutations";
import { orpc } from "@/lib/orpc/orpc";
import {
	type DatabaseBlock,
	isDatabaseBlock,
	isTemplateBlock,
} from "@/lib/orpc/schemas/block";
import type {
	BotEditorSave,
	BotEditorSelect,
} from "@/lib/orpc/schemas/bot-editor";
import type { ResourceRef } from "@/lib/orpc/schemas/resource";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

type EditorState = Omit<BotEditorSave, "templateBlock" | "databaseBlocks"> & {
	templateBlock: BotEditorSelect["templateBlock"];
	databaseBlocks: BotEditorSelect["databaseBlocks"];
};

const WIZARD_STEPS = [
	{
		key: "basics",
		title: "Bot Basics",
		description: "Name the bot and describe its purpose.",
		icon: FileTextIcon,
	},
	{
		key: "behavior",
		title: "AI Behavior",
		description: "Choose the model and define response rules.",
		icon: SparklesIcon,
	},
	{
		key: "documents",
		title: "Content",
		description: "Attach content collections and source material.",
		icon: BookOpenIcon,
	},
	{
		key: "sharing",
		title: "Sharing & Access",
		description: "Control who can use and edit the bot.",
		icon: LockKeyholeIcon,
	},
	{
		key: "review",
		title: "Review & Launch",
		description: "Check the setup and publish the bot.",
		icon: CheckCircle2Icon,
	},
] as const;

const createDefaultEditorState = (): EditorState => ({
	name: "",
	description: "",
	contentJson: {},
	contentHtml: "",
	status: "draft",
	templateBlock: createDefaultTemplateBlock(),
	databaseBlocks: [],
});

const getPublishIssues = (editor: EditorState) => {
	const issues: string[] = [];

	if (!editor.templateBlock) {
		issues.push("Add an AI behavior before launching the bot.");
	} else {
		if (!editor.templateBlock.config.provider) {
			issues.push("Choose a provider for the AI behavior.");
		}
		if (!editor.templateBlock.config.model) {
			issues.push("Choose a text model for the AI behavior.");
		}
	}

	for (const databaseBlock of editor.databaseBlocks) {
		if (!databaseBlock.config.provider) {
			issues.push(`Choose a provider for "${databaseBlock.name}".`);
		}
		if (!databaseBlock.config.embeddingModel) {
			issues.push(`Choose an embedding model for "${databaseBlock.name}".`);
		}
		if (databaseBlock.assetIds.length === 0) {
			issues.push(
				`Attach at least one content item to "${databaseBlock.name}".`,
			);
		}
	}

	return issues;
};

const toDatabaseBlockEditorValue = (params: {
	block: DatabaseBlock;
	assetIds: string[];
	assets: BotEditorSelect["databaseBlocks"][number]["assets"];
}): BotEditorSelect["databaseBlocks"][number] => ({
	id: params.block.id,
	name: params.block.name,
	type: "database",
	status: params.block.status,
	config: params.block.config,
	assetIds: params.assetIds,
	assets: params.assets,
});

const toEditorState = (editor: BotEditorSelect): EditorState => ({
	id: editor.id,
	name: editor.name,
	description: editor.description,
	contentJson: editor.contentJson,
	contentHtml: editor.contentHtml,
	status: editor.status,
	templateBlock: editor.templateBlock,
	databaseBlocks: editor.databaseBlocks,
});

const BotEditorShell = ({
	botId,
	stepIndex,
	onStepChange,
}: {
	botId?: string;
	stepIndex?: number;
	onStepChange?: (step: number) => void;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [internalStepIndex, setInternalStepIndex] = useState(0);
	const [editor, setEditor] = useState<EditorState>(createDefaultEditorState());
	const [isTemplateBlockLibraryOpen, setIsTemplateBlockLibraryOpen] =
		useState(false);
	const [isDatabaseBlockLibraryOpen, setIsDatabaseBlockLibraryOpen] =
		useState(false);
	const activeStepIndex = stepIndex ?? internalStepIndex;
	const publishIssues = getPublishIssues(editor);

	const editorQuery = useQuery(
		orpc.bot.findEditor.queryOptions({
			input: botId
				? {
						id: botId,
					}
				: skipToken,
			enabled: !!botId,
		}),
	);

	useEffect(() => {
		if (editorQuery.data?.data) {
			setEditor(toEditorState(editorQuery.data.data));
		}
	}, [
		editorQuery.data?.data,
	]);

	useEffect(() => {
		if (typeof stepIndex === "number") {
			setInternalStepIndex(stepIndex);
		}
	}, [
		stepIndex,
	]);

	const { mutateAsync: saveBot, isPending: isSaving } = useSaveBotMutation();
	const { mutateAsync: publishBot, isPending: isPublishing } =
		usePublishBotMutation();

	const resourceRef: ResourceRef | null = editor.id
		? {
				type: "bot",
				id: editor.id,
			}
		: null;

	const visibility = useResourceVisibility(
		resourceRef ?? {
			type: "bot",
			id: "",
		},
		{
			enabled: !!resourceRef,
		},
	);
	const grants = useResourceGrants(
		resourceRef ?? {
			type: "bot",
			id: "",
		},
		{
			enabled: !!resourceRef,
		},
	);

	const setStep = (nextStep: number) => {
		onStepChange?.(nextStep);
		if (typeof stepIndex !== "number") {
			setInternalStepIndex(nextStep);
		}
	};

	const handleSelectExistingTemplateBlock = (
		block: BotEditorSelect["templateBlock"],
	) => {
		if (!block) {
			return;
		}

		setEditor((current) => ({
			...current,
			templateBlock: block,
		}));
	};

	const handleAddExistingDatabaseBlock = async (blockId: string) => {
		const block = await queryClient.fetchQuery(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
			}),
		);

		if (!isDatabaseBlock(block.data)) {
			return;
		}

		const databaseBlock = block.data as DatabaseBlock;

		setEditor((current) => ({
			...current,
			databaseBlocks: [
				...current.databaseBlocks,
				toDatabaseBlockEditorValue({
					block: databaseBlock,
					assetIds: block.assets?.map((entry) => entry.id) ?? [],
					assets: block.assets ?? [],
				}),
			],
		}));
	};

	const handleSave = async ({
		nextStepOnCreate,
	}: {
		nextStepOnCreate?: number;
	} = {}) => {
		const result = await saveBot(editor);
		if (result.status !== "success") {
			return null;
		}

		const nextEditor = toEditorState(result.data.data);
		setEditor(nextEditor);

		if (!botId && nextEditor.id) {
			await navigate({
				to: "/app/hub/bots/$botId/setup",
				params: {
					botId: nextEditor.id,
				},
				search: {
					step: nextStepOnCreate ?? 0,
				},
				replace: true,
			});
		}

		return nextEditor;
	};

	const handleWizardNext = async () => {
		const nextStep = Math.min(activeStepIndex + 1, WIZARD_STEPS.length - 1);
		const savedEditor = await handleSave({
			nextStepOnCreate: nextStep,
		});
		if (!savedEditor) {
			return;
		}

		if (savedEditor.id === botId) {
			setStep(nextStep);
		}
	};

	const handleWizardBack = async () => {
		if (activeStepIndex > 0 && editor.id) {
			await handleSave();
		}

		setStep(Math.max(activeStepIndex - 1, 0));
	};

	const handlePublish = async () => {
		const savedEditor = editor.id ? editor : await handleSave();
		if (!savedEditor?.id) {
			return;
		}

		const result = await publishBot({
			id: savedEditor.id,
		});

		if (result.status === "success") {
			setEditor(toEditorState(result.data.data));
		}
	};

	if (botId && editorQuery.isPending) {
		return (
			<Card>
				<CardContent className="p-6 text-muted-foreground">
					Loading bot editor...
				</CardContent>
			</Card>
		);
	}

	const currentStep = WIZARD_STEPS[activeStepIndex];

	return (
		<div className="space-y-6">
			<div className="grid gap-3 md:grid-cols-5">
				{WIZARD_STEPS.map((step, index) => {
					const Icon = step.icon;
					const isLocked = !editor.id && index > 0;
					const isActive = index === activeStepIndex;
					const isComplete = index < activeStepIndex;
					return (
						<button
							type="button"
							key={step.key}
							className={cn(
								"rounded-[24px] border p-4 text-left transition-all",
								isActive &&
									"border-orange-300 bg-background shadow-md ring-1 ring-orange-200/70",
								isComplete && "border-emerald-300 bg-emerald-50/60 shadow-sm",
								isLocked &&
									"cursor-not-allowed border-border/60 border-dashed bg-transparent opacity-55 shadow-none",
								!isActive && !isComplete && !isLocked && "bg-muted/20",
							)}
							onClick={() => {
								if (!isLocked) {
									setStep(index);
								}
							}}
							disabled={isLocked}
						>
							<div className="mb-3 flex items-center justify-between">
								<Icon className="h-4 w-4" />
								<Badge
									variant={isActive ? "default" : "outline"}
									className={cn(isLocked && "border-dashed")}
								>
									{index + 1}
								</Badge>
							</div>
							<div className="font-medium text-sm">{step.title}</div>
							<div className="mt-1 text-muted-foreground text-xs">
								{step.description}
							</div>
						</button>
					);
				})}
			</div>

			<div className="rounded-[32px] border bg-muted/25 p-6 shadow-inner">
				<div className="mb-6">
					<h2 className="font-semibold text-2xl">{currentStep.title}</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground">
						{currentStep.description}
					</p>
				</div>
				<div className="space-y-6">
					{activeStepIndex === 0 ? (
						<BotBasicsSection editor={editor} onChange={setEditor} />
					) : null}
					{activeStepIndex === 1 ? (
						<div className="space-y-4">
							<div className="flex flex-wrap justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => setIsTemplateBlockLibraryOpen(true)}
								>
									Use Existing AI Behavior
								</Button>
							</div>
							<TemplateBlockEditor
								value={editor.templateBlock}
								onChange={(templateBlock) =>
									setEditor((current) => ({
										...current,
										templateBlock,
									}))
								}
							/>
							<ExistingBlockPickerDialog
								open={isTemplateBlockLibraryOpen}
								onOpenChange={setIsTemplateBlockLibraryOpen}
								type="template"
								selectedIds={
									editor.templateBlock?.id
										? [
												editor.templateBlock.id,
											]
										: []
								}
								onSelect={(block) => {
									if (!isTemplateBlock(block)) {
										return;
									}

									handleSelectExistingTemplateBlock({
										id: block.id,
										name: block.name,
										type: "template",
										status: block.status,
										config: block.config,
									});
								}}
							/>
						</div>
					) : null}
					{activeStepIndex === 2 ? (
						<DocumentsSection
							editor={editor}
							onChange={setEditor}
							onAddExistingDatabaseBlock={handleAddExistingDatabaseBlock}
							onOpenExistingDatabaseBlockLibrary={() =>
								setIsDatabaseBlockLibraryOpen(true)
							}
							isDatabaseBlockLibraryOpen={isDatabaseBlockLibraryOpen}
							onDatabaseBlockLibraryOpenChange={setIsDatabaseBlockLibraryOpen}
						/>
					) : null}
					{activeStepIndex === 3 ? <SharingSection editor={editor} /> : null}
					{activeStepIndex === 4 ? (
						<ReviewSection
							editor={editor}
							visibility={visibility.data?.data.visibility}
							grantCount={grants.data?.data.length ?? 0}
							issues={publishIssues}
						/>
					) : null}

					<div className="flex items-center justify-between gap-3 rounded-[24px] border bg-background/80 p-4 shadow-sm backdrop-blur">
						<Button
							variant="outline"
							onClick={handleWizardBack}
							disabled={activeStepIndex === 0 || isSaving || isPublishing}
						>
							<ChevronLeftIcon className="mr-2 h-4 w-4" />
							Back
						</Button>

						{activeStepIndex === WIZARD_STEPS.length - 1 ? (
							<Button
								onClick={handlePublish}
								disabled={publishIssues.length > 0 || isSaving || isPublishing}
							>
								<RocketIcon className="mr-2 h-4 w-4" />
								Launch Bot
							</Button>
						) : (
							<Button
								onClick={handleWizardNext}
								disabled={isSaving || isPublishing}
							>
								Next
								<ChevronRightIcon className="ml-2 h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

const BotBasicsSection = ({
	editor,
	onChange,
}: {
	editor: EditorState;
	onChange: Dispatch<SetStateAction<EditorState>>;
}) => (
	<div className="space-y-6">
		<Card className="border-border/70 bg-background shadow-sm">
			<CardHeader>
				<CardTitle>Identity</CardTitle>
				<CardDescription>
					These details help people understand what the bot is for.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="bot-name">Bot Name</Label>
					<Input
						id="bot-name"
						value={editor.name}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								name: event.target.value,
							}))
						}
						placeholder="Intro to Sociology Tutor"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="bot-description">Short Description</Label>
					<Textarea
						id="bot-description"
						value={editor.description}
						onChange={(event) =>
							onChange((current) => ({
								...current,
								description: event.target.value,
							}))
						}
						placeholder="Provides a user group with access to a focused AI workflow and cites approved source material."
						rows={4}
					/>
				</div>
			</CardContent>
		</Card>

		<Card className="border-border/70 bg-background shadow-sm">
			<CardHeader>
				<CardTitle>Bot Description</CardTitle>
				<CardDescription>
					A richer overview for teammates who configure and maintain the bot.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<BlockEditor
					content={editor.contentJson as Content}
					onUpdate={(blockEditor) =>
						onChange((current) => ({
							...current,
							contentJson:
								blockEditor.getJSON() as BotEditorSave["contentJson"],
							contentHtml: blockEditor.getHTML(),
						}))
					}
				/>
			</CardContent>
		</Card>
	</div>
);

const DocumentsSection = ({
	editor,
	onChange,
	onAddExistingDatabaseBlock,
	onOpenExistingDatabaseBlockLibrary,
	isDatabaseBlockLibraryOpen,
	onDatabaseBlockLibraryOpenChange,
}: {
	editor: EditorState;
	onChange: Dispatch<SetStateAction<EditorState>>;
	onAddExistingDatabaseBlock: (blockId: string) => Promise<void>;
	onOpenExistingDatabaseBlockLibrary: () => void;
	isDatabaseBlockLibraryOpen: boolean;
	onDatabaseBlockLibraryOpenChange: (open: boolean) => void;
}) => (
	<div className="space-y-4">
		<div className="space-y-2">
			<h3 className="font-semibold text-xl">Content & Collections</h3>
			<p className="max-w-3xl text-muted-foreground text-sm">
				Add reusable content collections the AI can retrieve from when answering
				questions.
			</p>
		</div>
		{editor.databaseBlocks.length === 0 ? (
			<div className="rounded-[28px] border border-dashed bg-background/70 p-6 shadow-sm">
				<div className="font-medium">Do you want to add content?</div>
				<div className="mt-2 text-muted-foreground text-sm">
					Content gives the AI grounded context and citations. You can add one
					or more content collections, and each one can include existing or
					newly uploaded items from the content library.
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button
						onClick={() =>
							onChange((current) => ({
								...current,
								databaseBlocks: [
									createDefaultDatabaseBlock(),
								],
							}))
						}
					>
						Create Content Collection
					</Button>
					<Button
						variant="outline"
						onClick={onOpenExistingDatabaseBlockLibrary}
					>
						Use Existing Content Collection
					</Button>
				</div>
			</div>
		) : (
			<div className="space-y-4">
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						variant="outline"
						onClick={onOpenExistingDatabaseBlockLibrary}
					>
						Add Existing Content Collection
					</Button>
				</div>

				{editor.databaseBlocks.map((databaseBlock, index) => (
					<DatabaseBlockEditor
						key={databaseBlock.id ?? `database-block-${index}`}
						value={databaseBlock}
						onChange={(nextValue) =>
							onChange((current) => ({
								...current,
								databaseBlocks: current.databaseBlocks.map(
									(existing, existingIndex) =>
										existingIndex === index ? nextValue : existing,
								),
							}))
						}
						onRemove={() =>
							onChange((current) => ({
								...current,
								databaseBlocks: current.databaseBlocks.filter(
									(_, existingIndex) => existingIndex !== index,
								),
							}))
						}
					/>
				))}

				<Button
					variant="outline"
					onClick={() =>
						onChange((current) => ({
							...current,
							databaseBlocks: [
								...current.databaseBlocks,
								createDefaultDatabaseBlock(),
							],
						}))
					}
				>
					Add Another Content Collection
				</Button>
			</div>
		)}

		<ExistingBlockPickerDialog
			open={isDatabaseBlockLibraryOpen}
			onOpenChange={onDatabaseBlockLibraryOpenChange}
			type="database"
			selectedIds={editor.databaseBlocks.flatMap((databaseBlock) =>
				databaseBlock.id
					? [
							databaseBlock.id,
						]
					: [],
			)}
			onSelect={async (block) => {
				await onAddExistingDatabaseBlock(block.id);
			}}
		/>
	</div>
);

const SharingSection = ({ editor }: { editor: EditorState }) => {
	if (!editor.id) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Sharing & Access</CardTitle>
					<CardDescription>
						Access controls are available once the draft bot has been saved.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Sharing & Access</CardTitle>
				<CardDescription>
					Use groups for cohort access whenever possible, then add direct grants
					only when needed.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<AccessManagerContent
					resourceRef={{
						type: "bot",
						id: editor.id,
					}}
					resourceName={editor.name}
				/>
			</CardContent>
		</Card>
	);
};

const ReviewSection = ({
	editor,
	visibility,
	grantCount,
	issues,
}: {
	editor: EditorState;
	visibility?: "private" | "public";
	grantCount: number;
	issues: string[];
}) => (
	<Card className="border-border/70 bg-background shadow-sm">
		<CardHeader>
			<CardTitle>Review</CardTitle>
			<CardDescription>
				Check the authored bot before launching it.
			</CardDescription>
		</CardHeader>
		<CardContent className="space-y-6">
			<div>
				<div className="font-medium text-sm">Bot</div>
				<div className="mt-2 rounded-xl border p-4">
					<div className="font-medium">{editor.name || "Untitled bot"}</div>
					<div className="mt-1 text-muted-foreground text-sm">
						{editor.description || "No short description yet."}
					</div>
				</div>
			</div>

			<Separator />

			<div>
				<div className="font-medium text-sm">AI Behavior</div>
				<div className="mt-2 rounded-xl border p-4 text-sm">
					{editor.templateBlock ? (
						<>
							<div className="font-medium">{editor.templateBlock.name}</div>
							<div className="mt-1 text-muted-foreground">
								Provider:{" "}
								{editor.templateBlock.config.provider || "Not selected"}. Model:{" "}
								{editor.templateBlock.config.model || "Not selected"}.
							</div>
						</>
					) : (
						<div className="text-muted-foreground">
							No AI behavior configured yet.
						</div>
					)}
				</div>
			</div>

			<Separator />

			<div>
				<div className="font-medium text-sm">Content Collections</div>
				<div className="mt-2 space-y-3">
					{editor.databaseBlocks.length === 0 ? (
						<div className="rounded-xl border p-4 text-muted-foreground text-sm">
							No content attached.
						</div>
					) : (
						editor.databaseBlocks.map((databaseBlock, index) => (
							<div
								key={databaseBlock.id ?? `review-database-block-${index}`}
								className="rounded-xl border p-4"
							>
								<div className="font-medium">{databaseBlock.name}</div>
								<div className="mt-1 text-muted-foreground text-sm">
									{databaseBlock.assets.length} content items attached
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{databaseBlock.assets.map((asset) => (
										<Badge key={asset.id} variant="outline">
											{asset.title}:{" "}
											{getProcessingStatusLabel(asset.processingStatus)}
										</Badge>
									))}
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<Separator />

			<div>
				<div className="font-medium text-sm">Sharing</div>
				<div className="mt-2 rounded-xl border p-4 text-sm">
					<div>Visibility: {visibility ?? "private"}</div>
					<div className="mt-1 text-muted-foreground">
						Direct grants configured: {grantCount}
					</div>
					<div className="mt-1 text-muted-foreground">
						Use groups to grant access to cohorts, classes, or teams.
					</div>
				</div>
			</div>

			{issues.length > 0 ? (
				<>
					<Separator />
					<div>
						<div className="font-medium text-sm">Fix Before Launch</div>
						<div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-sm">
							<ul className="space-y-2">
								{issues.map((issue) => (
									<li key={issue}>{issue}</li>
								))}
							</ul>
						</div>
					</div>
				</>
			) : null}
		</CardContent>
	</Card>
);

export { BotEditorShell };
