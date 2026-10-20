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
import { toLinkedBlocks } from "@/components/access/block-edit-offer";
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
import { FeaturesSection } from "@/components/features/features-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import { Label } from "@/components/ui/label";
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
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { hasCapability, ownerCapabilities } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const WIZARD_STEPS = [
	{
		key: "basics",
		title: m.authoring_wizard_step_basics_title,
		description: m.authoring_wizard_step_basics_description,
		icon: FileTextIcon,
	},
	{
		key: "behavior",
		title: m.authoring_wizard_step_behaviour_title,
		description: m.authoring_wizard_step_behaviour_description,
		icon: SparklesIcon,
	},
	{
		key: "documents",
		title: m.authoring_wizard_step_repositories_title,
		description: m.authoring_wizard_step_repositories_description,
		icon: BookOpenIcon,
	},
	{
		key: "sharing",
		title: m.authoring_wizard_step_sharing_title,
		description: m.authoring_wizard_step_sharing_description,
		icon: LockKeyholeIcon,
	},
	{
		key: "review",
		title: m.authoring_wizard_step_review_title,
		description: m.authoring_wizard_step_review_description,
		icon: CheckCircle2Icon,
	},
] as const;

const EXAMPLE_SYSTEM_PROMPT = `You are the course assistant for this module.

Answer only from the repositories attached to you, and name the document each answer came from. If the material does not cover the question, say so and point the person to the course team.

Keep answers short and plain. Use British English.

Refuse anything outside the course material: do not grade work, do not predict marks, and do not give personal, legal or medical advice.`;

const canEditBlock = (block: {
	capabilities?: Partial<Record<"edit", boolean>>;
}) => hasCapability(block.capabilities, "edit");

const getPublishIssues = (editor: BotEditorFormValues) => {
	const issues: string[] = [];

	if (!editor.templateBlock) {
		issues.push(m.authoring_publish_issue_behaviour_missing());
	}
	if (editor.templateBlock && editor.templateBlock.status !== "ready") {
		issues.push(m.authoring_publish_issue_behaviour_not_ready());
	}

	for (const databaseBlock of editor.databaseBlocks) {
		if (databaseBlock.status !== "ready") {
			issues.push(
				m.authoring_publish_issue_repository_not_ready({
					name: databaseBlock.name,
				}),
			);
		}
		if (databaseBlock.assetIds.length === 0) {
			issues.push(
				m.authoring_publish_issue_repository_no_assets({
					name: databaseBlock.name,
				}),
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
	const confirm = useConfirm();
	const [internalStepIndex, setInternalStepIndex] = useState(0);
	const [isTemplateBlockLibraryOpen, setIsTemplateBlockLibraryOpen] =
		useState(false);
	const [isDatabaseBlockLibraryOpen, setIsDatabaseBlockLibraryOpen] =
		useState(false);
	const [wizardAction, setWizardAction] = useState<
		"back" | "next" | "draft" | "publish" | null
	>(null);
	const activeStepIndex = stepIndex ?? internalStepIndex;
	const zedTokenRef = useRef<string | undefined>(undefined);
	const form = useAppForm({
		...botEditorFormOptions(editorData),
		onSubmit: () => undefined,
	});
	useUnsavedChangesGuard(() => !form.state.isDefaultValue);

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

	const runWizardAction =
		(action: NonNullable<typeof wizardAction>, run: () => Promise<void>) =>
		async () => {
			setWizardAction(action);
			try {
				await run();
			} finally {
				setWizardAction(null);
			}
		};
	const isWizardActionPending = (action: typeof wizardAction) =>
		isWorking && wizardAction === action;

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
					capabilities: ownerCapabilities("block"),
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
					capabilities: ownerCapabilities("block"),
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
			features: editor.features,
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
				ignoreBlocker: true,
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
			title: m.authoring_publish_confirm_title(),
			description: editor.name
				? m.authoring_publish_confirm_description_named({
						name: editor.name,
					})
				: m.authoring_publish_confirm_description(),
			contentSlot: (
				<PublishSummary
					visibility={visibility.data?.data.visibility}
					grants={grants.data?.data ?? []}
					grantsAvailable={grants.isSuccess}
				/>
			),
			confirmText: m.authoring_publish_confirm_button(),
			cancelText: m.common_cancel_button(),
			confirmButton: {
				variant: "default",
			},
		});

		if (!confirmed) {
			return;
		}

		const savedEditor =
			editor.id && form.state.isDefaultValue
				? editor
				: await handleSave({
						status: editor.id ? undefined : "draft",
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
								{step.title()}
							</div>
						</button>
					);
				})}
			</div>

			<div className="min-w-0 rounded-4xl border bg-muted/25 p-6 shadow-inner">
				<div className="mb-6">
					<h2 className="font-semibold text-2xl">{currentStep.title()}</h2>
					<p className="mt-2 max-w-2xl text-muted-foreground">
						{currentStep.description()}
					</p>
				</div>

				<div className="grid min-w-0 grid-cols-1 gap-6">
					{activeStepIndex === 0 ? (
						<div className="grid min-w-0 grid-cols-1 gap-6">
							<Card className="min-w-0 rounded-2xl">
								<CardHeader>
									<CardTitle>{m.authoring_basics_identity_title()}</CardTitle>
									<CardDescription>
										{m.authoring_basics_identity_description()}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<form.AppField
										name="name"
										children={(field) => (
											<field.TextField
												label={m.authoring_basics_name_label()}
												placeholder={m.authoring_basics_name_placeholder()}
											/>
										)}
									/>
									<form.AppField
										name="description"
										children={(field) => (
											<field.TextareaField
												label={m.authoring_basics_description_label()}
												placeholder={m.authoring_basics_description_placeholder()}
												rows={4}
											/>
										)}
									/>
								</CardContent>
							</Card>

							<Card className="min-w-0 rounded-2xl">
								<CardHeader>
									<CardTitle>{m.authoring_basics_content_title()}</CardTitle>
									<CardDescription>
										{m.authoring_basics_content_description()}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<form.AppField
										name="contentJson"
										children={(field) => (
											<field.BlockEditorField
												label={m.authoring_basics_content_label()}
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
										{m.authoring_behaviour_use_existing_action()}
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
														label={m.common_name_label()}
														placeholder={m.authoring_behaviour_name_placeholder()}
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
															label={m.authoring_behaviour_system_prompt_label()}
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
														{m.authoring_behaviour_example_button()}
													</Button>
													<span className="text-muted-foreground text-xs">
														{m.authoring_behaviour_example_hint()}
													</span>
												</div>
											</div>
										}
										descriptionField={
											<form.AppField
												name="templateBlock.description"
												children={(field) => (
													<field.TextareaField
														label={m.authoring_behaviour_description_label()}
														placeholder={m.authoring_behaviour_description_placeholder()}
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
														label={m.authoring_behaviour_content_label()}
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
												{m.authoring_behaviour_empty_state_title()}
											</div>
											<div className="text-muted-foreground text-sm">
												{m.authoring_behaviour_empty_state_description()}
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
												{m.authoring_behaviour_create_action()}
											</Button>
											<Button
												variant="outline"
												onClick={() => setIsTemplateBlockLibraryOpen(true)}
											>
												{m.authoring_behaviour_use_existing_action()}
											</Button>
										</div>
									</CardContent>
								</Card>
							)}

							<Card className="min-w-0 rounded-2xl">
								<CardContent className="p-6">
									<form.Field
										name="features"
										children={(field) => (
											<FeaturesSection
												value={field.state.value}
												onChange={field.handleChange}
											/>
										)}
									/>
								</CardContent>
							</Card>

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
								title={m.authoring_behaviour_library_dialog_title()}
								description={m.authoring_behaviour_library_dialog_description()}
								searchPlaceholder={m.authoring_behaviour_library_search_placeholder()}
							/>
						</div>
					) : null}

					{activeStepIndex === 2 ? (
						<div className="grid min-w-0 grid-cols-1 gap-4">
							{editor.databaseBlocks.length === 0 ? (
								<div className="min-w-0 rounded-2xl border border-dashed bg-background/70 p-6">
									<div className="font-medium">
										{m.authoring_repositories_empty_state_title()}
									</div>
									<div className="mt-2 text-muted-foreground text-sm">
										{m.authoring_repositories_empty_state_description()}
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
											{m.authoring_repositories_create_action()}
										</Button>
										<Button
											variant="outline"
											onClick={() => setIsDatabaseBlockLibraryOpen(true)}
										>
											{m.authoring_repositories_use_existing_action()}
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
											{m.authoring_repositories_add_existing_action()}
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
										{m.authoring_repositories_add_another_action()}
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
								title={m.authoring_repositories_library_dialog_title()}
								description={m.authoring_repositories_library_dialog_description()}
								searchPlaceholder={m.authoring_repositories_library_search_placeholder()}
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
								onClick={runWizardAction("back", handleWizardBack)}
								loading={isWizardActionPending("back")}
								disabled={activeStepIndex === 0 || isWorking}
							>
								<ChevronLeftIcon />
								{m.common_back_button()}
							</Button>
							<span
								className="text-muted-foreground text-xs"
								aria-live="polite"
							>
								{isSaving
									? m.authoring_wizard_saving_status()
									: hasSaved
										? m.authoring_wizard_saved_status()
										: m.authoring_wizard_autosave_hint()}
							</span>
						</div>

						{activeStepIndex === WIZARD_STEPS.length - 1 ? (
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									onClick={runWizardAction("draft", handleSetDraft)}
									loading={isWizardActionPending("draft")}
									disabled={isWorking}
								>
									{m.authoring_wizard_save_draft_action()}
								</Button>
								<Button
									onClick={runWizardAction("publish", handlePublish)}
									loading={isWizardActionPending("publish")}
									disabled={publishIssues.length > 0 || isWorking}
								>
									{m.authoring_wizard_publish_action()}
								</Button>
							</div>
						) : (
							<Button
								onClick={runWizardAction("next", handleWizardNext)}
								loading={isWizardActionPending("next")}
								disabled={isWorking}
							>
								{m.common_next_button()}
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
					<CardTitle>{m.authoring_sharing_title()}</CardTitle>
					<CardDescription>
						{m.authoring_sharing_unsaved_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<p>{m.authoring_sharing_unshared_description()}</p>
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
				<CardTitle>{m.authoring_sharing_title()}</CardTitle>
				<CardDescription>{m.authoring_sharing_description()}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{grants.length === 0 ? (
					<p>{m.authoring_sharing_unshared_description()}</p>
				) : null}
				{memberAccess ? <p>{memberAccess}</p> : null}
				<AccessManagerContent
					resourceRef={{
						type: "bot",
						id: editor.id,
					}}
					resourceName={editor.name}
					linkedBlocks={toLinkedBlocks(editor)}
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
}) => {
	const publicationStatusOptions = getPublicationStatusOptions();

	return (
		<Card className="min-w-0 rounded-2xl border-border/70 bg-background">
			<CardHeader>
				<CardTitle>{m.authoring_review_title()}</CardTitle>
				<CardDescription>{m.authoring_review_description()}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div>
					<div className="font-medium text-sm">
						{m.authoring_review_bot_label()}
					</div>
					<div className="mt-2 rounded-xl border p-4">
						<div className="font-medium">
							{editor.name || m.authoring_review_bot_untitled()}
						</div>
						<div className="mt-1 text-muted-foreground text-sm">
							{editor.description || m.authoring_review_bot_no_description()}
						</div>
					</div>
				</div>

				<Separator />

				<div>
					<div className="font-medium text-sm">
						{m.authoring_review_behaviour_label()}
					</div>
					<div className="mt-2 rounded-xl border p-4 text-sm">
						{editor.templateBlock ? (
							<>
								<div className="font-medium">{editor.templateBlock.name}</div>
								<div className="mt-1 text-muted-foreground">
									{m.authoring_review_behaviour_hint()}
								</div>
								<div className="mt-3 max-w-sm space-y-2">
									<Label htmlFor="review-template-status">
										{m.authoring_review_behaviour_status_label()}
									</Label>
									<OptionPicker
										id="review-template-status"
										options={publicationStatusOptions}
										value={editor.templateBlock.status}
										onChange={onTemplateBlockStatusChange}
										disabled={
											Boolean(
												editor.templateBlock.id &&
													!canEditBlock(editor.templateBlock),
											) || isSettingBlockStatus
										}
									/>
									{editor.templateBlock.id &&
									!canEditBlock(editor.templateBlock) ? (
										<p className="text-muted-foreground text-xs">
											{m.authoring_review_behaviour_readonly_hint()}
										</p>
									) : null}
								</div>
							</>
						) : (
							<div className="text-muted-foreground">
								{m.authoring_review_behaviour_empty_state()}
							</div>
						)}
					</div>
				</div>

				<Separator />

				<div>
					<div className="font-medium text-sm">
						{m.authoring_review_repositories_label()}
					</div>
					<div className="mt-2 space-y-3">
						{editor.databaseBlocks.length === 0 ? (
							<div className="rounded-xl border p-4 text-muted-foreground text-sm">
								{m.authoring_review_repositories_empty_state()}
							</div>
						) : (
							editor.databaseBlocks.map((databaseBlock, index) => (
								<div
									key={databaseBlock.id ?? `review-db-${index}`}
									className="rounded-xl border p-4"
								>
									<div className="font-medium">{databaseBlock.name}</div>
									<div className="mt-1 text-muted-foreground text-sm">
										{m.authoring_attached_asset_count({
											count: databaseBlock.assetIds.length,
										})}
									</div>
									<div className="mt-3 max-w-sm space-y-2">
										<Label htmlFor={`review-db-status-${index}`}>
											{m.authoring_review_repository_status_label()}
										</Label>
										<OptionPicker
											id={`review-db-status-${index}`}
											options={publicationStatusOptions}
											value={databaseBlock.status}
											onChange={(status) =>
												onDatabaseBlockStatusChange({
													blockId: databaseBlock.id,
													blockIndex: index,
													status,
												})
											}
											disabled={
												Boolean(
													databaseBlock.id && !canEditBlock(databaseBlock),
												) || isSettingBlockStatus
											}
										/>
										{databaseBlock.id && !canEditBlock(databaseBlock) ? (
											<p className="text-muted-foreground text-xs">
												{m.authoring_review_repository_readonly_hint()}
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
						<div className="font-medium text-sm">
							{m.authoring_review_visibility_label()}
						</div>
						<div className="mt-1 text-muted-foreground text-sm">
							{visibility === "public"
								? m.authoring_review_visibility_public()
								: m.authoring_review_visibility_private()}
						</div>
					</div>
					<div className="rounded-xl border p-4">
						<div className="font-medium text-sm">
							{m.authoring_review_grants_label()}
						</div>
						<div className="mt-1 text-muted-foreground text-sm">
							{m.authoring_review_grant_count({
								count: grantCount,
							})}
						</div>
					</div>
				</div>

				{issues.length > 0 ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
						<div className="font-medium text-destructive text-sm">
							{m.authoring_review_issues_title()}
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
};

const ReadOnlyTemplateCard = ({
	block,
}: {
	block: NonNullable<BotEditorFormValues["templateBlock"]>;
}) => {
	const navigate = useNavigate();

	return (
		<Card className="min-w-0 rounded-2xl">
			<CardHeader>
				<CardTitle>{m.authoring_readonly_behaviour_title()}</CardTitle>
				<CardDescription>
					{m.authoring_readonly_behaviour_description()}
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
						{m.authoring_readonly_open_block_action()}
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
						{m.authoring_readonly_repository_description()}
					</CardDescription>
				</div>
				<Button variant="outline" size="sm" onClick={onDetach}>
					{m.authoring_readonly_detach_action()}
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="text-muted-foreground text-sm">
					{m.authoring_attached_asset_count({
						count: block.assetIds.length,
					})}
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
						{m.authoring_readonly_open_block_action()}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
};

export { BotEditorShell };
