import type { BotEditor, PublicationStatus, SaveBotInput } from "@orcai/schema";
import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessManagerContent } from "@/components/access/access-manager-content";
import {
	type BotEditorFormValues,
	botEditorFormOptions,
	createDefaultBuilderDatabaseBlock,
	createDefaultBuilderTemplateBlock,
	toBotEditorFormValues,
} from "@/components/authoring/bot-editor-form-options";
import { TemplateBlockEditor } from "@/components/authoring/template-block-editor";
import { BlockSelectorDialog } from "@/components/blocks/block-selector-dialog";
import {
	createDatabaseBlockBuilderFieldMap,
	DatabaseBlockFieldGroup,
} from "@/components/blocks/database-block/form/database-block-field-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	useResourceGrants,
	useResourceVisibility,
} from "@/hooks/authz/use-resource-access";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockInlineMutation,
	useSetBlockStatusMutation,
	useUpdateBlockInlineMutation,
} from "@/hooks/mutations/use-block-mutations";
import {
	usePublishBotMutation,
	useSaveBotMutation,
} from "@/hooks/mutations/use-bot-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
	{
		key: "basics",
		title: "Bot Basics",
		description: "Name the bot and describe its purpose.",
		icon: FileTextIcon,
	},
	{
		key: "behavior",
		title: "AI Behaviour",
		description: "Define the bot's response rules.",
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

const getPublishIssues = (editor: BotEditorFormValues) => {
	const issues: string[] = [];

	if (!editor.templateBlock) {
		issues.push("Add an AI behaviour before launching the bot.");
	}
	if (editor.templateBlock && editor.templateBlock.status !== "ready") {
		issues.push(
			'Set the AI behaviour block status to "Ready" before launching.',
		);
	}

	for (const databaseBlock of editor.databaseBlocks) {
		if (databaseBlock.status !== "ready") {
			issues.push(
				`Set "${databaseBlock.name}" block status to "Ready" before launching.`,
			);
		}
		if (databaseBlock.assetIds.length === 0) {
			issues.push(
				`Attach at least one content item to "${databaseBlock.name}".`,
			);
		}
	}

	return issues;
};

const toTemplateBlockInput = (
	block: NonNullable<BotEditorFormValues["templateBlock"]>,
) => ({
	name: block.name,
	description: block.description.trim() ? block.description : null,
	contentJson: block.contentJson ?? null,
	contentHtml: block.contentHtml ? block.contentHtml : null,
	type: "template" as const,
	status: block.status,
	config: block.config,
});

const toDatabaseBlockInput = (
	block: BotEditorFormValues["databaseBlocks"][number],
) => ({
	name: block.name,
	description: block.description.trim() ? block.description : null,
	contentJson: block.contentJson ?? null,
	contentHtml: block.contentHtml ? block.contentHtml : null,
	type: "database" as const,
	status: block.status,
	config: block.config,
	assets: block.assetIds ?? [],
});

const BotEditorShell = ({
	editorData,
	stepIndex,
	onStepChange,
}: {
	editorData?: BotEditor;
	stepIndex?: number;
	onStepChange?: (step: number) => void;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [internalStepIndex, setInternalStepIndex] = useState(0);
	const [isTemplateBlockLibraryOpen, setIsTemplateBlockLibraryOpen] =
		useState(false);
	const [isDatabaseBlockLibraryOpen, setIsDatabaseBlockLibraryOpen] =
		useState(false);
	const activeStepIndex = stepIndex ?? internalStepIndex;
	const zedTokenRef = useRef<string | undefined>(undefined);
	const form = useAppForm({
		...botEditorFormOptions(editorData),
		onSubmit: () => undefined,
	});
	const editor = useStore(
		form.store,
		(state) => state.values,
	) as BotEditorFormValues;
	const publishIssues = useMemo(
		() => getPublishIssues(editor),
		[
			editor,
		],
	);

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
	const { mutateAsync: createBlock, isPending: isCreatingBlock } =
		useCreateBlockInlineMutation();
	const { mutateAsync: updateBlock, isPending: isUpdatingBlock } =
		useUpdateBlockInlineMutation();
	const { mutateAsync: setBlockStatus, isPending: isSettingBlockStatus } =
		useSetBlockStatusMutation();
	const botResourceRef = editor.id
		? {
				type: "bot" as const,
				id: editor.id,
			}
		: undefined;

	const visibility = useResourceVisibility(botResourceRef, {
		enabled: !!editor.id,
	});
	const grants = useResourceGrants(botResourceRef, {
		enabled: !!editor.id,
	});

	const isWorking =
		isSaving ||
		isPublishing ||
		isCreatingBlock ||
		isUpdatingBlock ||
		isSettingBlockStatus;

	const setStep = (nextStep: number) => {
		onStepChange?.(nextStep);
		if (typeof stepIndex !== "number") {
			setInternalStepIndex(nextStep);
		}
	};

	const handleSelectExistingTemplateBlock = async (blockId: string) => {
		const block = await queryClient.fetchQuery(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
			}),
		);

		if (block.data.type !== "template") {
			return;
		}

		const templateBlock: NonNullable<BotEditorFormValues["templateBlock"]> = {
			id: block.data.id,
			canEdit: block.data.canEdit ?? false,
			name: block.data.name,
			description: block.data.description ?? "",
			contentJson: block.data.contentJson,
			contentHtml: block.data.contentHtml ?? "",
			type: "template",
			status: block.data.status,
			config: block.data.config,
		};
		form.setFieldValue("templateBlock", templateBlock);
	};

	const handleAddExistingDatabaseBlock = async (blockId: string) => {
		const block = await queryClient.fetchQuery(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
			}),
		);

		if (block.data.type !== "database") {
			return;
		}

		const alreadyLinked = editor.databaseBlocks.some(
			(databaseBlock) => databaseBlock.id === block.data.id,
		);
		if (alreadyLinked) {
			return;
		}

		const linkedBlock: BotEditorFormValues["databaseBlocks"][number] = {
			id: block.data.id,
			canEdit: block.data.canEdit ?? false,
			name: block.data.name,
			type: "database",
			description: block.data.description ?? "",
			contentJson: block.data.contentJson,
			contentHtml: block.data.contentHtml ?? "",
			status: block.data.status,
			config: block.data.config,
			assetIds: block.assets?.map((asset) => asset.id) ?? [],
			assets: block.assets ?? [],
		};

		form.setFieldValue("databaseBlocks", [
			...editor.databaseBlocks,
			linkedBlock,
		]);
	};

	const persistLinkedBlocks = async () => {
		let nextTemplateBlock = editor.templateBlock;
		const nextDatabaseBlocks: BotEditorFormValues["databaseBlocks"] = [];

		if (editor.templateBlock) {
			if (editor.templateBlock.id) {
				if (editor.templateBlock.canEdit) {
					const result = await updateBlock({
						id: editor.templateBlock.id,
						...toTemplateBlockInput(editor.templateBlock),
					});
					if (result.status !== "success") {
						return null;
					}
				}
			} else {
				const result = await createBlock(
					toTemplateBlockInput(editor.templateBlock),
				);
				if (result.status !== "success") {
					return null;
				}
				zedTokenRef.current = result.data.meta?.zedToken ?? zedTokenRef.current;
				nextTemplateBlock = {
					...editor.templateBlock,
					id: result.data.data.id,
					canEdit: true,
				};
			}
		}

		for (const databaseBlock of editor.databaseBlocks) {
			let nextBlock = databaseBlock;
			if (databaseBlock.id) {
				if (databaseBlock.canEdit) {
					const result = await updateBlock({
						id: databaseBlock.id,
						...toDatabaseBlockInput(databaseBlock),
					});
					if (result.status !== "success") {
						return null;
					}
				}
			} else {
				const result = await createBlock(toDatabaseBlockInput(databaseBlock));
				if (result.status !== "success") {
					return null;
				}
				zedTokenRef.current = result.data.meta?.zedToken ?? zedTokenRef.current;
				nextBlock = {
					...databaseBlock,
					id: result.data.data.id,
					canEdit: true,
				};
			}

			nextDatabaseBlocks.push(nextBlock);
		}

		form.setFieldValue("templateBlock", nextTemplateBlock);
		form.setFieldValue("databaseBlocks", nextDatabaseBlocks);

		return {
			templateBlockId: nextTemplateBlock?.id ?? null,
			databaseBlockIds: nextDatabaseBlocks.flatMap((databaseBlock) =>
				databaseBlock.id
					? [
							databaseBlock.id,
						]
					: [],
			),
		};
	};

	const handleSave = async ({
		nextStepOnCreate,
		status,
	}: {
		nextStepOnCreate?: number;
		status?: PublicationStatus;
	} = {}) => {
		const linkedBlocks = await persistLinkedBlocks();
		if (!linkedBlocks) {
			return null;
		}

		const payload: SaveBotInput = {
			zedToken: zedTokenRef.current,
			id: editor.id,
			name: editor.name,
			description: editor.description,
			contentJson: editor.contentJson as SaveBotInput["contentJson"],
			contentHtml: editor.contentHtml,
			status: status ?? editor.status,
			templateBlockId: linkedBlocks.templateBlockId,
			databaseBlockIds: linkedBlocks.databaseBlockIds,
		};

		const result = await saveBot(payload);
		if (result.status !== "success") {
			return null;
		}
		zedTokenRef.current = result.data.meta?.zedToken ?? zedTokenRef.current;

		const nextEditor = toBotEditorFormValues(result.data.data);
		form.reset(nextEditor);

		if (!editorData?.id && nextEditor.id) {
			await navigate({
				to: "/app/hub/bots/$botId/setup",
				params: {
					botId: nextEditor.id,
				},
				search: {
					step: nextStepOnCreate ?? 0,
					zedToken: zedTokenRef.current,
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

		if (editorData?.id && savedEditor.id === editorData.id) {
			setStep(nextStep);
		}
	};

	const handleWizardBack = async () => {
		if (activeStepIndex > 0 && editor.id) {
			await handleSave();
		}

		setStep(Math.max(activeStepIndex - 1, 0));
	};

	const handleSetReady = async () => {
		const savedEditor = editor.id
			? editor
			: await handleSave({
					status: "draft",
				});
		if (!savedEditor?.id) {
			return;
		}

		await publishBot({
			id: savedEditor.id,
		});
	};

	const handleSetDraft = async () => {
		await handleSave({
			status: "draft",
		});
	};

	const handleTemplateBlockStatusChange = async (status: PublicationStatus) => {
		const templateBlock = editor.templateBlock;
		if (!templateBlock || templateBlock.status === status) {
			return;
		}

		if (!templateBlock.id) {
			form.setFieldValue("templateBlock", {
				...templateBlock,
				status,
			});
			return;
		}

		if (!templateBlock.canEdit) {
			return;
		}

		const result = await setBlockStatus({
			id: templateBlock.id,
			...toTemplateBlockInput({
				...templateBlock,
				status,
			}),
		});
		if (result.status !== "success") {
			return;
		}

		form.setFieldValue("templateBlock", {
			...templateBlock,
			status,
		});
	};

	const handleDatabaseBlockStatusChange = async (params: {
		blockId?: string;
		blockIndex: number;
		status: PublicationStatus;
	}) => {
		const databaseBlock = editor.databaseBlocks[params.blockIndex];
		if (!databaseBlock || databaseBlock.status === params.status) {
			return;
		}

		if (!databaseBlock.id) {
			form.setFieldValue(
				"databaseBlocks",
				editor.databaseBlocks.map((block, index) =>
					index === params.blockIndex
						? {
								...block,
								status: params.status,
							}
						: block,
				),
			);
			return;
		}

		if (!databaseBlock.canEdit) {
			return;
		}

		const result = await setBlockStatus({
			id: databaseBlock.id,
			...toDatabaseBlockInput({
				...databaseBlock,
				status: params.status,
			}),
		});
		if (result.status !== "success") {
			return;
		}

		form.setFieldValue(
			"databaseBlocks",
			editor.databaseBlocks.map((block) =>
				block.id === params.blockId
					? {
							...block,
							status: params.status,
						}
					: block,
			),
		);
	};

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
									"bg-primary text-primary-foreground shadow-md ring-2 ring-primary",
								isComplete && "border-secondary bg-secondary/5 shadow-sm",
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
									variant="outline"
									className={cn(
										isLocked && "border-dashed",
										isActive && "text-primary-foreground",
									)}
								>
									{index + 1}
								</Badge>
							</div>
							<div className="font-medium text-xs">{step.title}</div>
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
						<div className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Identity</CardTitle>
									<CardDescription>
										These details help people understand what the bot is for.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<form.AppField
										name="name"
										children={(field) => (
											<field.TextField
												label="Bot Name"
												placeholder="Intro to Sociology Tutor"
											/>
										)}
									/>
									<form.AppField
										name="description"
										children={(field) => (
											<field.TextareaField
												label="Short Description"
												placeholder="Provides a user group with access to a focused AI workflow and cites approved source material."
												rows={4}
											/>
										)}
									/>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Bot Description</CardTitle>
									<CardDescription>
										A richer overview for teammates who configure and maintain
										the bot.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<form.AppField
										name="contentJson"
										children={(field) => (
											<field.BlockEditorField
												label="Bot Description"
												htmlFieldName="contentHtml"
											/>
										)}
									/>
								</CardContent>
							</Card>
						</div>
					) : null}

					{activeStepIndex === 1 ? (
						<div className="space-y-4">
							{editor.templateBlock ? (
								<div className="flex flex-wrap justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setIsTemplateBlockLibraryOpen(true)}
									>
										Use Existing AI Behaviour
									</Button>
								</div>
							) : null}

							{editor.templateBlock ? (
								editor.templateBlock.canEdit || !editor.templateBlock.id ? (
									<TemplateBlockEditor
										nameField={
											<form.AppField
												name="templateBlock.name"
												children={(field) => (
													<field.TextField
														label="Name"
														placeholder="AI Behaviour"
													/>
												)}
											/>
										}
										systemPromptField={
											<form.AppField
												name="templateBlock.config.systemPrompt"
												children={(field) => (
													<field.TextareaField
														label="System Prompt"
														placeholder="Explain the bot's role, response style, and constraints."
														rows={12}
													/>
												)}
											/>
										}
										descriptionField={
											<form.AppField
												name="templateBlock.description"
												children={(field) => (
													<field.TextareaField
														label="Short Description"
														placeholder="Define the purpose of this block."
														rows={4}
													/>
												)}
											/>
										}
										contentField={
											<form.AppField
												name="templateBlock.contentJson"
												children={(field) => (
													<field.BlockEditorField
														label="Detailed Description"
														htmlFieldName="templateBlock.contentHtml"
													/>
												)}
											/>
										}
									/>
								) : (
									<ReadOnlyTemplateCard block={editor.templateBlock} />
								)
							) : (
								<Card>
									<CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
										<div>
											<div className="font-medium">
												No AI behaviour linked yet
											</div>
											<div className="text-muted-foreground text-sm">
												Create a new behaviour or attach one from the library.
											</div>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												onClick={() =>
													form.setFieldValue(
														"templateBlock",
														createDefaultBuilderTemplateBlock(),
													)
												}
											>
												Create AI Behaviour
											</Button>
											<Button
												variant="outline"
												onClick={() => setIsTemplateBlockLibraryOpen(true)}
											>
												Use Existing AI Behaviour
											</Button>
										</div>
									</CardContent>
								</Card>
							)}

							<BlockSelectorDialog
								open={isTemplateBlockLibraryOpen}
								onOpenChange={setIsTemplateBlockLibraryOpen}
								type="template"
								includeDrafts
								selectedIds={
									editor.templateBlock?.id
										? [
												editor.templateBlock.id,
											]
										: []
								}
								onSelect={(block) =>
									handleSelectExistingTemplateBlock(block.id)
								}
								title="Use Existing AI Behaviour"
								description="Attach a reusable AI behaviour block instead of creating a new one."
								searchPlaceholder="Search AI behaviour blocks..."
							/>
						</div>
					) : null}

					{activeStepIndex === 2 ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<h3 className="font-semibold text-xl">Content & Collections</h3>
								<p className="max-w-3xl text-muted-foreground text-sm">
									Add reusable content collections the AI can retrieve from when
									answering questions.
								</p>
							</div>

							{editor.databaseBlocks.length === 0 ? (
								<div className="rounded-[28px] border border-dashed bg-background/70 p-6 shadow-sm">
									<div className="font-medium">Do you want to add content?</div>
									<div className="mt-2 text-muted-foreground text-sm">
										Content gives the AI grounded context and citations. You can
										add one or more content collections, and each one can
										include existing or newly uploaded items from the content
										library.
									</div>
									<div className="mt-4 flex flex-wrap gap-2">
										<Button
											onClick={() =>
												form.setFieldValue("databaseBlocks", [
													...editor.databaseBlocks,
													createDefaultBuilderDatabaseBlock({
														botName: editor.name,
													}),
												])
											}
										>
											Create Content Collection
										</Button>
										<Button
											variant="outline"
											onClick={() => setIsDatabaseBlockLibraryOpen(true)}
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
											onClick={() => setIsDatabaseBlockLibraryOpen(true)}
										>
											Add Existing Content Collection
										</Button>
									</div>

									{editor.databaseBlocks.map((databaseBlock, index) =>
										databaseBlock.canEdit || !databaseBlock.id ? (
											<DatabaseBlockFieldGroup
												key={databaseBlock.id ?? `database-block-${index}`}
												form={form}
												fields={createDatabaseBlockBuilderFieldMap(index)}
												assetIds={databaseBlock.assetIds}
												onAssetIdsChange={(ids) => {
													form.setFieldValue(
														`databaseBlocks[${index}].assetIds`,
														ids,
													);
												}}
												assets={databaseBlock.assets}
												onAssetsChange={(assets) => {
													form.setFieldValue(
														`databaseBlocks[${index}].assets`,
														assets,
													);
												}}
												onRemove={() =>
													form.setFieldValue(
														"databaseBlocks",
														editor.databaseBlocks.filter(
															(_, existingIndex) => existingIndex !== index,
														),
													)
												}
											/>
										) : (
											<ReadOnlyDatabaseCard
												key={databaseBlock.id}
												block={databaseBlock}
												onDetach={() =>
													form.setFieldValue(
														"databaseBlocks",
														editor.databaseBlocks.filter(
															(_, existingIndex) => existingIndex !== index,
														),
													)
												}
											/>
										),
									)}

									<Button
										variant="outline"
										onClick={() =>
											form.setFieldValue("databaseBlocks", [
												...editor.databaseBlocks,
												createDefaultBuilderDatabaseBlock({
													botName: editor.name,
												}),
											])
										}
									>
										Add Another Content Collection
									</Button>
								</div>
							)}

							<BlockSelectorDialog
								open={isDatabaseBlockLibraryOpen}
								onOpenChange={setIsDatabaseBlockLibraryOpen}
								type="database"
								includeDrafts
								selectedIds={editor.databaseBlocks.flatMap((databaseBlock) =>
									databaseBlock.id
										? [
												databaseBlock.id,
											]
										: [],
								)}
								onSelect={async (block) => {
									await handleAddExistingDatabaseBlock(block.id);
								}}
								title="Use Existing Content Collection"
								description="Attach a reusable content collection block instead of creating a new one."
								searchPlaceholder="Search content collection blocks..."
							/>
						</div>
					) : null}

					{activeStepIndex === 3 ? (
						<SharingSection editorId={editor.id} editorName={editor.name} />
					) : null}

					{activeStepIndex === 4 ? (
						<ReviewSection
							editor={editor}
							visibility={visibility.data?.data.visibility}
							grantCount={grants.data?.data.length ?? 0}
							issues={publishIssues}
							onStatusChange={(status) => form.setFieldValue("status", status)}
							onTemplateBlockStatusChange={handleTemplateBlockStatusChange}
							onDatabaseBlockStatusChange={handleDatabaseBlockStatusChange}
							isSettingBlockStatus={isSettingBlockStatus}
						/>
					) : null}

					<Card>
						<CardContent className="flex flex-row items-center justify-between gap-3">
							<Button
								variant="outline"
								onClick={handleWizardBack}
								disabled={activeStepIndex === 0 || isWorking}
							>
								<ChevronLeftIcon />
								Back
							</Button>

							{activeStepIndex === WIZARD_STEPS.length - 1 ? (
								editor.status === "ready" ? (
									<Button
										onClick={handleSetReady}
										disabled={publishIssues.length > 0 || isWorking}
									>
										<RocketIcon />
										Launch Bot
									</Button>
								) : (
									<Button onClick={handleSetDraft} disabled={isWorking}>
										Save as Draft
									</Button>
								)
							) : (
								<Button onClick={handleWizardNext} disabled={isWorking}>
									Next
									<ChevronRightIcon />
								</Button>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

const SharingSection = ({
	editorId,
	editorName,
}: {
	editorId?: BotEditorFormValues["id"];
	editorName: string;
}) => {
	if (!editorId) {
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
						id: editorId,
					}}
					resourceName={editorName}
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
	onStatusChange,
	onTemplateBlockStatusChange,
	onDatabaseBlockStatusChange,
	isSettingBlockStatus,
}: {
	editor: BotEditorFormValues;
	visibility?: "private" | "public";
	grantCount: number;
	issues: string[];
	onStatusChange: (status: PublicationStatus) => void;
	onTemplateBlockStatusChange: (status: PublicationStatus) => void;
	onDatabaseBlockStatusChange: (params: {
		blockId?: string;
		blockIndex: number;
		status: PublicationStatus;
	}) => void;
	isSettingBlockStatus: boolean;
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
				<div className="font-medium text-sm">Publication Status</div>
				<div className="mt-2 rounded-xl border p-4">
					<div className="max-w-sm space-y-2">
						<Label htmlFor="bot-publication-status">Target status</Label>
						<Select
							value={editor.status}
							onValueChange={(status) =>
								onStatusChange(status as PublicationStatus)
							}
						>
							<SelectTrigger id="bot-publication-status">
								<SelectValue placeholder="Select status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="draft">Draft</SelectItem>
								<SelectItem value="ready">Ready</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Set to Ready to publish with strict checks, or keep as Draft while
							you iterate.
						</p>
					</div>
				</div>
			</div>

			<Separator />

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
				<div className="font-medium text-sm">AI Behaviour</div>
				<div className="mt-2 rounded-xl border p-4 text-sm">
					{editor.templateBlock ? (
						<>
							<div className="font-medium">{editor.templateBlock.name}</div>
							<div className="mt-1 text-muted-foreground">
								System prompt and response behaviour are configured on this
								template block.
							</div>
							<div className="mt-3 max-w-sm space-y-2">
								<Label htmlFor="review-template-status">Block status</Label>
								<Select
									value={editor.templateBlock.status}
									onValueChange={(status) =>
										onTemplateBlockStatusChange(status as PublicationStatus)
									}
									disabled={
										(editor.templateBlock.id &&
											!editor.templateBlock.canEdit) ||
										isSettingBlockStatus
									}
								>
									<SelectTrigger id="review-template-status">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="draft">Draft</SelectItem>
										<SelectItem value="ready">Ready</SelectItem>
									</SelectContent>
								</Select>
								{editor.templateBlock.id && !editor.templateBlock.canEdit ? (
									<p className="text-muted-foreground text-xs">
										You can use this shared block but cannot change its status.
									</p>
								) : null}
							</div>
						</>
					) : (
						<div className="text-muted-foreground">
							No AI behaviour configured yet.
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
							No content collections added.
						</div>
					) : (
						editor.databaseBlocks.map((databaseBlock, index) => (
							<div
								key={databaseBlock.id ?? `review-db-${index}`}
								className="rounded-xl border p-4"
							>
								<div className="font-medium">{databaseBlock.name}</div>
								<div className="mt-1 text-muted-foreground text-sm">
									{databaseBlock.assetIds.length} content item
									{databaseBlock.assetIds.length === 1 ? "" : "s"} attached
								</div>
								<div className="mt-3 max-w-sm space-y-2">
									<Label htmlFor={`review-db-status-${index}`}>
										Block status
									</Label>
									<Select
										value={databaseBlock.status}
										onValueChange={(status) => {
											onDatabaseBlockStatusChange({
												blockId: databaseBlock.id,
												blockIndex: index,
												status: status as PublicationStatus,
											});
										}}
										disabled={
											(databaseBlock.id && !databaseBlock.canEdit) ||
											isSettingBlockStatus
										}
									>
										<SelectTrigger id={`review-db-status-${index}`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="draft">Draft</SelectItem>
											<SelectItem value="ready">Ready</SelectItem>
										</SelectContent>
									</Select>
									{databaseBlock.id && !databaseBlock.canEdit ? (
										<p className="text-muted-foreground text-xs">
											You can use this shared block but cannot change its
											status.
										</p>
									) : null}
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<Separator />

			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border p-4">
					<div className="font-medium text-sm">Visibility</div>
					<div className="mt-1 text-muted-foreground text-sm">
						{visibility === "public"
							? "Public to authenticated users"
							: "Private access only"}
					</div>
				</div>
				<div className="rounded-xl border p-4">
					<div className="font-medium text-sm">Direct Grants</div>
					<div className="mt-1 text-muted-foreground text-sm">
						{grantCount} principal{grantCount === 1 ? "" : "s"} with direct
						access
					</div>
				</div>
			</div>

			{issues.length > 0 ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
					<div className="font-medium text-destructive text-sm">
						Resolve before launch
					</div>
					<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
						{issues.map((issue) => (
							<li key={issue}>{issue}</li>
						))}
					</ul>
				</div>
			) : null}
		</CardContent>
	</Card>
);

const ReadOnlyTemplateCard = ({
	block,
}: {
	block: NonNullable<BotEditorFormValues["templateBlock"]>;
}) => {
	const navigate = useNavigate();

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Behaviour</CardTitle>
				<CardDescription>
					This behaviour block is linked as read-only in this setup flow since
					you do not have permission to edit it directly.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="font-medium">{block.name}</div>
				{block.description ? (
					<div className="text-muted-foreground text-sm">
						{block.description}
					</div>
				) : null}
				{block.id ? (
					<Button
						variant="outline"
						onClick={() =>
							block.id
								? navigate({
										to: "/app/hub/blocks/$blockId",
										params: {
											blockId: block.id,
										},
									})
								: undefined
						}
					>
						Open Block
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

const ReadOnlyDatabaseCard = ({
	block,
	onDetach,
}: {
	block: BotEditorFormValues["databaseBlocks"][number];
	onDetach: () => void;
}) => {
	const navigate = useNavigate();

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div>
					<CardTitle className="text-base">{block.name}</CardTitle>
					<CardDescription>
						This content collection is linked as read-only in this setup flow.
					</CardDescription>
				</div>
				<Button variant="outline" size="sm" onClick={onDetach}>
					Detach
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="text-muted-foreground text-sm">
					{block.assetIds.length} item{block.assetIds.length === 1 ? "" : "s"}{" "}
					attached
				</div>
				{block.assets.length > 0 ? (
					<ul className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
						{block.assets.map((asset) => (
							<li
								key={asset.id}
								className="flex items-center justify-between gap-2"
							>
								<span className="truncate">{asset.title}</span>
								<Badge variant="secondary">
									{getProcessingStatusLabel(asset.processingStatus)}
								</Badge>
							</li>
						))}
					</ul>
				) : null}
				{block.id ? (
					<Button
						variant="outline"
						onClick={() =>
							block.id
								? navigate({
										to: "/app/hub/blocks/$blockId",
										params: {
											blockId: block.id,
										},
									})
								: undefined
						}
					>
						Open Block
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

export { BotEditorShell };
