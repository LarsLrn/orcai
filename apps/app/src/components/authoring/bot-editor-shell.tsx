import type {
	BotEditor,
	PublicationStatus,
	ResourceGrant,
	SaveBotInput,
} from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
	BookOpenIcon,
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FileTextIcon,
	LockKeyholeIcon,
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
import {
	describeAllMembersAccess,
	PublishSummary,
} from "@/components/authoring/publish-summary";
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
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
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
import { emptyCapabilities, hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
	{
		key: "basics",
		title: "Bot basics",
		description: "Name the bot and describe its purpose.",
		icon: FileTextIcon,
	},
	{
		key: "behavior",
		title: "AI behaviour",
		description:
			"The system prompt sets the bot's role, tone and limits. There is no default, so write one here or reuse a behaviour you have already defined.",
		icon: SparklesIcon,
	},
	{
		key: "documents",
		title: "Repositories",
		description:
			"A repository holds the material the bot answers from, so it can quote and cite your own documents. Attach as many as the bot needs, or none at all.",
		icon: BookOpenIcon,
	},
	{
		key: "sharing",
		title: "Sharing and access",
		description: "Control who can use and edit the bot.",
		icon: LockKeyholeIcon,
	},
	{
		key: "review",
		title: "Review and publish",
		description: "Check the setup and publish the bot.",
		icon: CheckCircle2Icon,
	},
] as const;

const EXAMPLE_SYSTEM_PROMPT = `You are the course assistant for this module.

Answer only from the repositories attached to you, and name the document each answer came from. If the material does not cover the question, say so and point the person to the course team.

Keep answers short and plain. Use British English.

Refuse anything outside the course material: do not grade work, do not predict marks, and do not give personal, legal or medical advice.`;

const UNSHARED_ACCESS_COPY =
	"Until you share it, only you can use this bot. Publishing does not change that: it makes the bot usable by the groups and people named here, and by nobody else.";

const canEditBlock = (block: {
	capabilities?: Partial<Record<"edit", boolean>>;
}) => hasCapability(block.capabilities, "edit");

const editableBlockCapabilities = () => ({
	...emptyCapabilities("block"),
	read: true,
	use: true,
	edit: true,
});

const getPublishIssues = (editor: BotEditorFormValues) => {
	const issues: string[] = [];

	if (!editor.templateBlock) {
		issues.push("Add an AI behaviour before publishing the bot.");
	}
	if (editor.templateBlock && editor.templateBlock.status !== "ready") {
		issues.push("Mark the AI behaviour as ready before publishing.");
	}

	for (const databaseBlock of editor.databaseBlocks) {
		if (databaseBlock.status !== "ready") {
			issues.push(`Mark "${databaseBlock.name}" as ready before publishing.`);
		}
		if (databaseBlock.assetIds.length === 0) {
			issues.push(`Attach at least one asset to "${databaseBlock.name}".`);
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
	const confirm = useConfirm();
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
	const editor = useSelector(
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

	const {
		mutateAsync: saveBot,
		isPending: isSaving,
		isSuccess: hasSaved,
	} = useSaveBotMutation();
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
		const block = await queryClient.query(
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
			capabilities: block.data.capabilities,
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
		const block = await queryClient.query(
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
			capabilities: block.data.capabilities,
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
				if (canEditBlock(editor.templateBlock)) {
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
					capabilities: editableBlockCapabilities(),
				};
			}
		}

		for (const databaseBlock of editor.databaseBlocks) {
			let nextBlock = databaseBlock;
			if (databaseBlock.id) {
				if (canEditBlock(databaseBlock)) {
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
					capabilities: editableBlockCapabilities(),
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

	const handlePublish = async () => {
		const confirmed = await confirm({
			title: "Publish this bot",
			description: `Publishing makes "${
				editor.name || "this bot"
			}" available to everyone the access rules below name.`,
			contentSlot: (
				<PublishSummary
					visibility={visibility.data?.data.visibility}
					grants={grants.data?.data ?? []}
					grantsAvailable={grants.isSuccess}
				/>
			),
			confirmText: "Publish",
			cancelText: "Cancel",
			confirmButton: {
				variant: "default",
			},
		});

		if (!confirmed) {
			return;
		}

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

		if (!canEditBlock(templateBlock)) {
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

		if (!canEditBlock(databaseBlock)) {
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
		<div className="grid min-w-0 grid-cols-1 gap-6">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
								"min-w-0 rounded-2xl border border-border bg-background p-4 text-left transition-colors",
								isActive && "border-primary bg-primary text-primary-foreground",
								isComplete && "border-secondary bg-secondary/5",
								isLocked &&
									"cursor-not-allowed border-border/60 border-dashed bg-transparent opacity-55",
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
							<div className="wrap-break-word font-medium text-xs">
								{step.title}
							</div>
						</button>
					);
				})}
			</div>

			<div className="min-w-0 rounded-4xl border bg-muted/25 p-6 shadow-inner">
				<div className="mb-6">
					<h2 className="font-semibold text-2xl">{currentStep.title}</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground">
						{currentStep.description}
					</p>
				</div>

				<div className="grid min-w-0 grid-cols-1 gap-6">
					{activeStepIndex === 0 ? (
						<div className="grid min-w-0 grid-cols-1 gap-6">
							<Card className="min-w-0 rounded-2xl">
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
												label="Bot name"
												placeholder="Travel expenses guide"
											/>
										)}
									/>
									<form.AppField
										name="description"
										children={(field) => (
											<field.TextareaField
												label="Short description"
												placeholder="Answers colleagues' questions about travel bookings and reimbursements from the approved guidance documents."
												rows={4}
											/>
										)}
									/>
								</CardContent>
							</Card>

							<Card className="min-w-0 rounded-2xl">
								<CardHeader>
									<CardTitle>Bot description</CardTitle>
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
												label="Bot description"
												htmlFieldName="contentHtml"
											/>
										)}
									/>
								</CardContent>
							</Card>
						</div>
					) : null}

					{activeStepIndex === 1 ? (
						<div className="grid min-w-0 grid-cols-1 gap-4">
							{editor.templateBlock ? (
								<div className="flex flex-wrap justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setIsTemplateBlockLibraryOpen(true)}
									>
										Use existing AI behaviour
									</Button>
								</div>
							) : null}

							{editor.templateBlock ? (
								canEditBlock(editor.templateBlock) ||
								!editor.templateBlock.id ? (
									<TemplateBlockEditor
										nameField={
											<form.AppField
												name="templateBlock.name"
												children={(field) => (
													<field.TextField
														label="Name"
														placeholder="AI behaviour"
													/>
												)}
											/>
										}
										systemPromptField={
											<div className="space-y-2">
												<form.AppField
													name="templateBlock.config.systemPrompt"
													children={(field) => (
														<field.TextareaField
															label="System prompt"
															placeholder={EXAMPLE_SYSTEM_PROMPT}
															rows={12}
														/>
													)}
												/>
												<div className="flex flex-wrap items-center gap-3">
													<Button
														variant="outline"
														size="sm"
														disabled={
															!!editor.templateBlock?.config.systemPrompt.trim()
														}
														onClick={() =>
															form.setFieldValue(
																"templateBlock.config.systemPrompt",
																EXAMPLE_SYSTEM_PROMPT,
															)
														}
													>
														Start from an example
													</Button>
													<span className="text-muted-foreground text-xs">
														Name the role, the sources to answer from, the tone
														to use, and what to refuse.
													</span>
												</div>
											</div>
										}
										descriptionField={
											<form.AppField
												name="templateBlock.description"
												children={(field) => (
													<field.TextareaField
														label="Short description"
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
														label="Detailed description"
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
								<Card className="min-w-0 rounded-2xl">
									<CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
										<div>
											<div className="font-medium">
												No AI behaviour linked yet
											</div>
											<div className="text-muted-foreground text-sm">
												Write a new behaviour, or reuse one you have already
												defined. You can start from an example.
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
												Create AI behaviour
											</Button>
											<Button
												variant="outline"
												onClick={() => setIsTemplateBlockLibraryOpen(true)}
											>
												Use existing AI behaviour
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
								title="Use existing AI behaviour"
								description="Reuse a behaviour you have already defined instead of writing a new one."
								searchPlaceholder="Search AI behaviours..."
							/>
						</div>
					) : null}

					{activeStepIndex === 2 ? (
						<div className="grid min-w-0 grid-cols-1 gap-4">
							{editor.databaseBlocks.length === 0 ? (
								<div className="min-w-0 rounded-2xl border border-dashed bg-background/70 p-6">
									<div className="font-medium">
										Do you want to add a repository?
									</div>
									<div className="mt-2 text-muted-foreground text-sm">
										A repository gives the bot grounded context and citations.
										You can add one or more, and each one can hold existing or
										newly uploaded assets from the Library.
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
											Create repository
										</Button>
										<Button
											variant="outline"
											onClick={() => setIsDatabaseBlockLibraryOpen(true)}
										>
											Use existing repository
										</Button>
									</div>
								</div>
							) : (
								<div className="grid min-w-0 grid-cols-1 gap-4">
									<div className="flex flex-wrap justify-end gap-2">
										<Button
											variant="outline"
											onClick={() => setIsDatabaseBlockLibraryOpen(true)}
										>
											Add existing repository
										</Button>
									</div>

									{editor.databaseBlocks.map((databaseBlock, index) =>
										canEditBlock(databaseBlock) || !databaseBlock.id ? (
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
										className="justify-self-start"
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
										Add another repository
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
								title="Use existing repository"
								description="Attach a repository that already exists instead of creating a new one."
								searchPlaceholder="Search repositories..."
							/>
						</div>
					) : null}

					{activeStepIndex === 3 ? (
						<SharingSection
							editor={editor}
							grants={grants.data?.data ?? []}
							grantsAvailable={grants.isSuccess}
						/>
					) : null}

					{activeStepIndex === 4 ? (
						<ReviewSection
							editor={editor}
							visibility={visibility.data?.data.visibility}
							grantCount={grants.data?.data.length ?? 0}
							issues={publishIssues}
							onTemplateBlockStatusChange={handleTemplateBlockStatusChange}
							onDatabaseBlockStatusChange={handleDatabaseBlockStatusChange}
							isSettingBlockStatus={isSettingBlockStatus}
						/>
					) : null}

					<div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4">
						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								onClick={handleWizardBack}
								disabled={activeStepIndex === 0 || isWorking}
							>
								<ChevronLeftIcon />
								Back
							</Button>
							<span
								className="text-muted-foreground text-xs"
								aria-live="polite"
							>
								{isSaving
									? "Saving..."
									: hasSaved
										? "Saved. Moving between steps saves your changes."
										: "Moving between steps saves your changes."}
							</span>
						</div>

						{activeStepIndex === WIZARD_STEPS.length - 1 ? (
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									onClick={handleSetDraft}
									disabled={isWorking}
								>
									Save draft
								</Button>
								<Button
									onClick={handlePublish}
									disabled={publishIssues.length > 0 || isWorking}
								>
									Publish bot
								</Button>
							</div>
						) : (
							<Button onClick={handleWizardNext} disabled={isWorking}>
								Next
								<ChevronRightIcon />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

const SharingSection = ({
	editor,
	grants,
	grantsAvailable,
}: {
	editor: BotEditorFormValues;
	grants: ResourceGrant[];
	grantsAvailable: boolean;
}) => {
	const memberAccess = grantsAvailable
		? describeAllMembersAccess(grants)
		: null;

	if (!editor.id) {
		return (
			<Card className="min-w-0 rounded-2xl">
				<CardHeader>
					<CardTitle>Sharing and access</CardTitle>
					<CardDescription>
						Access controls are available once the draft bot has been saved.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<p>{UNSHARED_ACCESS_COPY}</p>
					{memberAccess ? <p>{memberAccess}</p> : null}
				</CardContent>
			</Card>
		);
	}

	if (!hasCapability(editor.capabilities, "manage_access")) {
		return null;
	}

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>Sharing and access</CardTitle>
				<CardDescription>
					Use groups for cohort access whenever possible, then add direct grants
					only when needed.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{grants.length === 0 ? <p>{UNSHARED_ACCESS_COPY}</p> : null}
				{memberAccess ? <p>{memberAccess}</p> : null}
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
	onTemplateBlockStatusChange,
	onDatabaseBlockStatusChange,
	isSettingBlockStatus,
}: {
	editor: BotEditorFormValues;
	visibility?: "private" | "public";
	grantCount: number;
	issues: string[];
	onTemplateBlockStatusChange: (status: PublicationStatus) => void;
	onDatabaseBlockStatusChange: (params: {
		blockId?: string;
		blockIndex: number;
		status: PublicationStatus;
	}) => void;
	isSettingBlockStatus: boolean;
}) => (
	<Card className="min-w-0 rounded-2xl border-border/70 bg-background">
		<CardHeader>
			<CardTitle>Review</CardTitle>
			<CardDescription>Check the bot before publishing it.</CardDescription>
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
				<div className="font-medium text-sm">AI behaviour</div>
				<div className="mt-2 rounded-xl border p-4 text-sm">
					{editor.templateBlock ? (
						<>
							<div className="font-medium">{editor.templateBlock.name}</div>
							<div className="mt-1 text-muted-foreground">
								This behaviour carries the system prompt the bot answers with.
							</div>
							<div className="mt-3 max-w-sm space-y-2">
								<Label htmlFor="review-template-status">
									AI behaviour status
								</Label>
								<Select
									value={editor.templateBlock.status}
									onValueChange={(status) =>
										onTemplateBlockStatusChange(status as PublicationStatus)
									}
									disabled={
										(editor.templateBlock.id &&
											!canEditBlock(editor.templateBlock)) ||
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
								{editor.templateBlock.id &&
								!canEditBlock(editor.templateBlock) ? (
									<p className="text-muted-foreground text-xs">
										You can use this shared behaviour but cannot change its
										status.
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
				<div className="font-medium text-sm">Repositories</div>
				<div className="mt-2 space-y-3">
					{editor.databaseBlocks.length === 0 ? (
						<div className="rounded-xl border p-4 text-muted-foreground text-sm">
							No repositories added.
						</div>
					) : (
						editor.databaseBlocks.map((databaseBlock, index) => (
							<div
								key={databaseBlock.id ?? `review-db-${index}`}
								className="rounded-xl border p-4"
							>
								<div className="font-medium">{databaseBlock.name}</div>
								<div className="mt-1 text-muted-foreground text-sm">
									{databaseBlock.assetIds.length} asset
									{databaseBlock.assetIds.length === 1 ? "" : "s"} attached
								</div>
								<div className="mt-3 max-w-sm space-y-2">
									<Label htmlFor={`review-db-status-${index}`}>
										Repository status
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
											(databaseBlock.id && !canEditBlock(databaseBlock)) ||
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
									{databaseBlock.id && !canEditBlock(databaseBlock) ? (
										<p className="text-muted-foreground text-xs">
											You can use this shared repository but cannot change its
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
					<div className="font-medium text-sm">Direct grants</div>
					<div className="mt-1 text-muted-foreground text-sm">
						{grantCount === 1
							? "1 person or group with direct access"
							: `${grantCount} people and groups with direct access`}
					</div>
				</div>
			</div>

			{issues.length > 0 ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
					<div className="font-medium text-destructive text-sm">
						Resolve before publishing
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
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>AI behaviour</CardTitle>
				<CardDescription>
					This behaviour is attached as read-only, since you do not have
					permission to edit it.
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
						Open block
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
		<Card className="min-w-0 rounded-2xl">
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div className="min-w-0">
					<CardTitle className="text-base">{block.name}</CardTitle>
					<CardDescription>
						This repository is attached as read-only.
					</CardDescription>
				</div>
				<Button variant="outline" size="sm" onClick={onDetach}>
					Detach
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="text-muted-foreground text-sm">
					{block.assetIds.length} asset{block.assetIds.length === 1 ? "" : "s"}{" "}
					attached
				</div>
				{block.assets.length > 0 ? (
					<ul className="space-y-2 rounded-xl border bg-muted/20 p-3 text-sm">
						{block.assets.map((asset) => (
							<li
								key={asset.id}
								className="flex items-center justify-between gap-2"
							>
								<span className="truncate">{asset.title}</span>
								{asset.processingStatus === "completed" ? null : (
									<Badge variant="secondary">
										{getProcessingStatusLabel(asset.processingStatus)}
									</Badge>
								)}
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
						Open block
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

export { BotEditorShell };
