import type { BlockId } from "@orcai/core";
import type { BotEditor, PublicationStatus } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRepositoryReadiness } from "@/components/assets/readiness/use-repository-readiness";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";
import {
	type BotEditorFormValues,
	botEditorFormOptions,
	toBotEditorFormValues,
	toLinkedBlockValues,
} from "@/components/authoring/bot-editor-form-options";
import {
	type BotEditorBlockSaved,
	type BotEditorBlockSlot,
	botEditorBaseline,
	planBotEditorSave,
	toBlockInput,
	withSavedBlock,
} from "@/components/authoring/bot-editor-save";
import { WIZARD_STEPS } from "@/components/authoring/bot-editor-steps";
import { PublishSummary } from "@/components/authoring/publish-summary";
import { BasicsStep } from "@/components/authoring/steps/basics-step";
import { BehaviourStep } from "@/components/authoring/steps/behaviour-step";
import { RepositoriesStep } from "@/components/authoring/steps/repositories-step";
import { ReviewStep } from "@/components/authoring/steps/review-step";
import { SharingStep } from "@/components/authoring/steps/sharing-step";
import {
	BotModelStep,
	type BotModelStepHandle,
} from "@/components/bot/setup/bot-model-step";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import {
	useResourceGrants,
	useResourceVisibility,
} from "@/hooks/authz/use-resource-access";
import { useAppForm } from "@/hooks/form";
import { useSetBlockStatusMutation } from "@/hooks/mutations/use-block-mutations";
import {
	usePublishBotMutation,
	useSaveBotEditorMutation,
} from "@/hooks/mutations/use-bot-mutations";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { formatList } from "@/lib/presentation/format-list";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const revealStep = (node: HTMLButtonElement | null) => {
	node?.scrollIntoView({
		block: "nearest",
		inline: "nearest",
	});
};

const getPublishIssues = (editor: BotEditorFormValues) => {
	const issues: string[] = [];

	if (!editor.behaviour) {
		issues.push(m.authoring_publish_issue_behaviour_missing());
	}
	if (editor.behaviour && editor.behaviour.status !== "ready") {
		issues.push(m.authoring_publish_issue_behaviour_not_ready());
	}

	for (const repository of editor.repositories) {
		if (repository.status !== "ready") {
			issues.push(
				m.authoring_publish_issue_repository_not_ready({
					name: repository.name,
				}),
			);
		}
		if (repository.assetIds.length === 0) {
			issues.push(
				m.authoring_publish_issue_repository_no_assets({
					name: repository.name,
				}),
			);
		}
	}

	return issues;
};

const blockPath = (slot: BotEditorBlockSlot) =>
	slot === "behaviour" ? "behaviour" : (`repositories[${slot}]` as const);

const BotEditorShell = ({
	editorData,
	stepIndex,
	onStepChange,
}: {
	editorData?: BotEditor;
	stepIndex: number;
	onStepChange: (step: number) => void;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { availability: assistantAvailability } = useAssistantModel();
	const [wizardAction, setWizardAction] = useState<
		"back" | "next" | "draft" | "publish" | null
	>(null);
	const zedTokenRef = useRef<string | undefined>(undefined);
	// What the server holds; the form keeps the saved bot as its default values.
	const [baseline, setBaseline] = useState(() =>
		botEditorBaseline(toBotEditorFormValues(editorData)),
	);
	const form = useAppForm({
		...botEditorFormOptions,
		defaultValues: baseline.bot,
		onSubmit: () => undefined,
	});
	const modelStep = useRef<BotModelStepHandle>(null);
	useUnsavedChangesGuard(
		() => !form.state.isDefaultValue || modelStep.current?.isDirty() === true,
	);

	const editor = useSelector(form.store, (state) => state.values);
	const publishIssues = useMemo(
		() => getPublishIssues(editor),
		[
			editor,
		],
	);
	const readiness = useRepositoryReadiness(
		editor.repositories.flatMap((block) =>
			block.id
				? [
						block.id,
					]
				: [],
		),
	);

	const {
		mutateAsync: saveBotEditor,
		isPending: isSaving,
		isSuccess: hasSaved,
	} = useSaveBotEditorMutation();
	const { mutateAsync: publishBot, isPending: isPublishing } =
		usePublishBotMutation();
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

	const isWorking = isSaving || isPublishing || isSettingBlockStatus;

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

	// The Model step saves through its own procedure and loses its form when left.
	const leaveModelStep = async () => (await modelStep.current?.save()) ?? true;

	const handleLinkBlock = async (blockId: BlockId) => {
		const block = toLinkedBlockValues(
			await queryClient.query(
				orpc.block.find.queryOptions({
					input: {
						id: blockId,
					},
				}),
			),
		);
		if (
			block.type === "repository" &&
			form
				.getFieldValue("repositories")
				.some((repository) => repository.id === block.id)
		) {
			return;
		}

		setBaseline((current) => withSavedBlock(current, block));
		if (block.type === "behaviour") {
			form.setFieldValue("behaviour", block);
		} else {
			form.pushFieldValue("repositories", block);
		}
	};

	const markSaved = (values: BotEditorFormValues) => {
		setBaseline(botEditorBaseline(values));
		form.reset(values);
	};

	// A block committed before a later write failed stays saved, and a new one keeps its id.
	const handleBlockSaved = ({ slot, block, zedToken }: BotEditorBlockSaved) => {
		zedTokenRef.current = zedToken ?? zedTokenRef.current;
		setBaseline((current) => withSavedBlock(current, block));
		if (slot === "behaviour") {
			form.setFieldValue("behaviour.id", block.id);
		} else {
			form.setFieldValue(`repositories[${slot}].id`, block.id);
		}
	};

	/** Saves what changed; resolves with the saved state, or null when saving failed. */
	const handleSave = async ({
		nextStepOnCreate,
		status,
	}: {
		nextStepOnCreate?: number;
		status?: PublicationStatus;
	} = {}) => {
		const plan = planBotEditorSave({
			values: editor,
			baseline,
			status,
		});
		if (!plan) {
			return editor;
		}

		const result = await saveBotEditor({
			plan,
			zedToken: zedTokenRef.current,
			onBlockSaved: handleBlockSaved,
			confirmListing: (blocks) =>
				confirm({
					title: m.authoring_list_blocks_confirm_title(),
					description: m.authoring_list_blocks_confirm_description({
						blockNames: formatList(blocks.map((block) => block.name)),
					}),
					confirmText: m.authoring_list_blocks_confirm_button(),
					confirmVariant: "default",
				}),
		});
		if (result.status !== "success") {
			return null;
		}
		zedTokenRef.current = result.data.zedToken;
		const nextEditor = result.data.values;
		markSaved(nextEditor);

		if (!editorData?.id && nextEditor.id) {
			await navigate({
				to: "/app/library/bots/$botId/setup",
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
		const nextStep = Math.min(stepIndex + 1, WIZARD_STEPS.length - 1);
		if (!(await leaveModelStep())) {
			return;
		}
		const savedEditor = await handleSave({
			nextStepOnCreate: nextStep,
		});
		if (!savedEditor) {
			return;
		}

		if (editorData?.id && savedEditor.id === editorData.id) {
			onStepChange(nextStep);
		}
	};

	const handleWizardBack = async () => {
		if (!(await leaveModelStep())) {
			return;
		}
		if (stepIndex > 0 && editor.id) {
			await handleSave();
		}

		onStepChange(Math.max(stepIndex - 1, 0));
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
					repositories={readiness.data?.data}
				/>
			),
			confirmText: m.authoring_publish_confirm_button(),
			confirmVariant: "default",
		});

		if (!confirmed) {
			return;
		}

		const savedEditor = await handleSave({
			status: editor.id ? undefined : "draft",
		});
		if (!savedEditor?.id) {
			return;
		}

		const result = await publishBot({
			id: savedEditor.id,
		});
		if (result.status === "success") {
			await navigate({
				to: "/app/library/bots/$botId",
				params: {
					botId: result.data.data.id,
				},
				ignoreBlocker: true,
			});
		}
	};

	const handleSetDraft = async () => {
		await handleSave({
			status: "draft",
		});
	};

	const linkedSlotOf = (id: BlockId): BotEditorBlockSlot | undefined => {
		if (form.getFieldValue("behaviour")?.id === id) {
			return "behaviour";
		}
		const index = form
			.getFieldValue("repositories")
			.findIndex((repository) => repository.id === id);
		return index === -1 ? undefined : index;
	};

	/** A saved block's status is written at once; a new one's is saved with the bot. */
	const handleStatusChange = async (
		slot: BotEditorBlockSlot,
		status: PublicationStatus,
	) => {
		const path = blockPath(slot);
		const block = form.getFieldValue(path);
		if (!block || block.status === status) {
			return;
		}

		if (block.id) {
			if (!hasCapability(block.capabilities, "edit")) {
				return;
			}
			const savedBlock = {
				...block,
				id: block.id,
				status,
			};
			const result = await setBlockStatus({
				id: block.id,
				...toBlockInput(savedBlock),
			});
			if (result.status !== "success") {
				return;
			}
			setBaseline((current) => withSavedBlock(current, savedBlock));
			// The block may have moved or been detached while the write was pending.
			const linkedSlot = linkedSlotOf(savedBlock.id);
			if (linkedSlot !== undefined) {
				form.setFieldValue(`${blockPath(linkedSlot)}.status`, status);
			}
			return;
		}
		form.setFieldValue(`${path}.status`, status);
	};

	const currentStep = WIZARD_STEPS[stepIndex];

	return (
		<div className="@container grid min-w-0 grid-cols-1 gap-6">
			<div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 @4xl:grid @4xl:grid-cols-6 @4xl:overflow-visible">
				{WIZARD_STEPS.map((step, index) => {
					const Icon = step.icon;
					const isLocked = !editor.id && index > 0;
					const isActive = index === stepIndex;
					const isComplete = index < stepIndex;
					return (
						<button
							type="button"
							key={step.key}
							ref={isActive ? revealStep : undefined}
							className={cn(
								"border-border bg-background w-36 shrink-0 rounded-2xl border p-4 text-left transition-colors @4xl:w-auto @4xl:min-w-0",
								isActive && "border-primary bg-primary text-primary-foreground",
								isComplete && "border-secondary bg-secondary/5",
								isLocked &&
									"border-border/60 cursor-not-allowed border-dashed bg-transparent opacity-55",
							)}
							onClick={async () => {
								if (!isLocked && (await leaveModelStep())) {
									onStepChange(index);
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
							<div className="text-xs font-medium wrap-break-word">
								{step.title()}
							</div>
						</button>
					);
				})}
			</div>

			<div className="sm:bg-muted/25 min-w-0 sm:rounded-4xl sm:border sm:p-6 sm:shadow-inner">
				<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 className="text-2xl font-semibold">{currentStep.title()}</h2>
						<p className="text-muted-foreground mt-2 max-w-2xl">
							{currentStep.description()}
						</p>
					</div>
					{editor.id && assistantAvailability === "set" ? (
						<Button
							variant="outline"
							onClick={() =>
								navigate({
									to: "/app/assistant",
									search: {
										draft: m.assistant_ask_bot_setup_draft({
											name: editor.name,
										}),
									},
								})
							}
						>
							<SparklesIcon />
							{m.assistant_ask_action()}
						</Button>
					) : null}
				</div>

				<div className="grid min-w-0 grid-cols-1 gap-6">
					{currentStep.key === "basics" ? <BasicsStep form={form} /> : null}

					{currentStep.key === "behavior" ? (
						<BehaviourStep form={form} onLink={handleLinkBlock} />
					) : null}

					{currentStep.key === "repositories" ? (
						<RepositoriesStep form={form} onLink={handleLinkBlock} />
					) : null}

					{currentStep.key === "sharing" ? (
						<SharingStep
							editor={editor}
							grants={grants.data?.data ?? []}
							grantsAvailable={grants.isSuccess}
						/>
					) : null}

					{currentStep.key === "model" ? (
						<BotModelStep botId={editor.id} ref={modelStep} />
					) : null}

					{currentStep.key === "review" ? (
						<ReviewStep
							editor={editor}
							visibility={visibility.data?.data.visibility}
							grantCount={grants.data?.data.length ?? 0}
							issues={publishIssues}
							onStatusChange={handleStatusChange}
							isSettingBlockStatus={isSettingBlockStatus}
						/>
					) : null}

					<div className="bg-background grid min-w-0 grid-cols-[auto_auto] items-center justify-between gap-3 rounded-2xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
						<Button
							variant="outline"
							className="col-start-1 row-start-1"
							onClick={runWizardAction("back", handleWizardBack)}
							loading={isWizardActionPending("back")}
							disabled={stepIndex === 0 || isWorking}
						>
							<ChevronLeftIcon />
							{m.common_back_button()}
						</Button>
						<span
							className="text-muted-foreground col-span-2 row-start-2 text-xs sm:col-span-1 sm:col-start-2 sm:row-start-1"
							aria-live="polite"
						>
							{isSaving
								? m.authoring_wizard_saving_status()
								: hasSaved
									? m.authoring_wizard_saved_status()
									: m.authoring_wizard_autosave_hint()}
						</span>

						{stepIndex === WIZARD_STEPS.length - 1 ? (
							<div className="col-start-2 row-start-1 flex flex-wrap items-center justify-end gap-2 sm:col-start-3">
								<Button
									variant="outline"
									onClick={runWizardAction("draft", handleSetDraft)}
									loading={isWizardActionPending("draft")}
									disabled={
										isWorking ||
										!planBotEditorSave({
											values: editor,
											baseline,
											status: "draft",
										})
									}
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
								className="col-start-2 row-start-1 justify-self-end sm:col-start-3"
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

export { BotEditorShell };
