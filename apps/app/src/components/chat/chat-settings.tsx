import type { ChatId } from "@orcai/core";
import {
	CHAT_FEATURE_IDS,
	type ChatConfig,
	type Features,
	type Model,
	type Provider,
} from "@orcai/schema";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BlockCard } from "@/components/blocks/block-card";
import { BlockSelectorDialog } from "@/components/blocks/block-selector-dialog";
import { BotCard } from "@/components/bot/bot-card";
import { chatConfigFormOptions } from "@/components/chat/form/chat-config-form-options";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { FeaturesSection } from "@/components/features/features-section";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppForm } from "@/hooks/form";
import { useUpdateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { reasonMessage } from "@/lib/errors/reason-messages";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const ChatSettings = ({
	chatId,
	zedToken,
	open,
	onOpenChange,
}: {
	chatId: ChatId;
	zedToken?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
				zedToken,
			},
		}),
	);

	const config = chat?.data.config;
	const isBotLinked = !!chat?.data.botId;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[90vh] max-h-[90vh] flex-col sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>{m.chat_settings_dialog_title()}</DialogTitle>
					<DialogDescription>
						{isBotLinked
							? m.chat_settings_dialog_description_bot_linked()
							: m.chat_settings_dialog_description()}
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="h-full min-h-0 flex-1">
					<div className="grid auto-rows-min gap-6 px-6 pb-6">
						{chat?.data.botId && (
							<Suspense fallback={<Skeleton className="h-12 w-full" />}>
								<BotDetails botId={chat.data.botId} />
							</Suspense>
						)}

						{chat && (
							<ChatConfigEditor
								chatId={chatId}
								config={config ?? {}}
								isBotLinked={isBotLinked}
							/>
						)}

						{chat &&
							(chat.data.botId ? (
								<>
									<Separator />
									<Suspense fallback={<Skeleton className="h-24 w-full" />}>
										<BotFeatures botId={chat.data.botId} />
									</Suspense>
									<Separator />
									<div className="flex flex-col gap-2 text-muted-foreground text-sm">
										<p>{m.chat_settings_blocks_bot_managed_notice()}</p>
										<p>{m.chat_settings_features_bot_managed_notice()}</p>
									</div>
								</>
							) : (
								<>
									<Separator />
									<ChatBlocksEditor chatId={chatId} zedToken={zedToken} />
									<Separator />
									<ChatFeaturesEditor
										chatId={chatId}
										features={config?.features ?? {}}
									/>
								</>
							))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};

const ChatConfigEditor = ({
	chatId,
	config,
	isBotLinked,
}: {
	chatId: ChatId;
	config: ChatConfig;
	isBotLinked: boolean;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const { mutateAsync: updateChat } = useUpdateChatMutation();
	const form = useAppForm({
		...chatConfigFormOptions(config),
		onSubmit: async ({ value }) => {
			await updateChat({
				id: chatId,
				config: {
					modelId: value.modelId,
					providerId: value.providerId,
					temperature: value.temperature ?? null,
					maxTokens: value.maxTokens ?? null,
					topP: value.topP ?? null,
					frequencyPenalty: value.frequencyPenalty ?? null,
					presencePenalty: value.presencePenalty ?? null,
					...(isBotLinked
						? {}
						: {
								systemPrompt: value.systemPrompt?.trim() || null,
							}),
				},
			});
		},
	});
	const selectedModelId = useSelector(
		form.store,
		(state) => state.values.modelId,
	);
	const selectedProviderId = useSelector(
		form.store,
		(state) => state.values.providerId,
	);
	const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);
	const { data: selectedModel } = useQuery(
		orpc.model.find.queryOptions({
			input: {
				id: selectedModelId ?? "",
			},
			enabled: !!selectedModelId,
		}),
	);
	const modelMaxOutputTokens = selectedModel?.data.maxOutputTokens ?? null;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-5"
		>
			<Separator />

			<div className="flex flex-col gap-2">
				<Label>{m.chat_settings_model_label()}</Label>
				<ModelSelectorButton
					selectedModelId={selectedModelId}
					selectedProviderId={selectedProviderId}
					onSelect={(model: Model, provider: Provider) => {
						form.setFieldValue("modelId", model.id);
						form.setFieldValue("providerId", provider.id);
					}}
					variant="full"
				/>
			</div>

			<div className="flex flex-col gap-2">
				{isBotLinked ? (
					<>
						<Label>{m.chat_settings_system_prompt_label()}</Label>
						<p className="text-muted-foreground text-sm">
							{m.chat_settings_system_prompt_locked_description()}
						</p>
					</>
				) : (
					<form.AppField
						name="systemPrompt"
						children={(field) => (
							<field.TextareaField
								label={m.chat_settings_system_prompt_label()}
								placeholder={m.chat_settings_system_prompt_placeholder()}
								rows={4}
							/>
						)}
					/>
				)}
			</div>

			<Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
				<CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-muted/15 px-4 py-3 text-left">
					<div>
						<div className="font-medium text-sm">
							{m.chat_settings_advanced_title()}
						</div>
						<div className="text-muted-foreground text-sm">
							{m.chat_settings_advanced_description()}
						</div>
					</div>
					<ChevronDownIcon
						className={`h-4 w-4 transition-transform ${
							isAdvancedOpen ? "rotate-180" : ""
						}`}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent className="pt-4">
					<div className="flex flex-col gap-4">
						<form.AppField
							name="temperature"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_temperature_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={1}
									min={0}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>

						<form.AppField
							name="topP"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_top_p_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={1}
									min={0}
									max={1}
									step={0.05}
									formatValue={(value) => value.toFixed(2)}
								/>
							)}
						/>

						<form.AppField
							name="maxTokens"
							validators={{
								onChangeListenTo: [
									"modelId",
								],
								onChange: ({ value }) =>
									value != null &&
									modelMaxOutputTokens !== null &&
									value > modelMaxOutputTokens
										? {
												message: reasonMessage(
													"CHAT_MAX_TOKENS_EXCEEDS_MODEL",
													{
														maxOutputTokens: modelMaxOutputTokens,
													},
												),
											}
										: undefined,
							}}
							children={(field) => (
								<field.TextField
									label={m.chat_settings_max_tokens_label()}
									description={
										modelMaxOutputTokens === null
											? undefined
											: m.chat_settings_max_tokens_description({
													maxOutputTokens: formatCount(modelMaxOutputTokens),
												})
									}
									type="number"
									min={1}
									max={modelMaxOutputTokens ?? undefined}
									placeholder={m.chat_settings_provider_default_placeholder()}
								/>
							)}
						/>

						<form.AppField
							name="frequencyPenalty"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_frequency_penalty_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={0}
									min={-2}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>

						<form.AppField
							name="presencePenalty"
							children={(field) => (
								<field.SliderField
									label={m.chat_settings_presence_penalty_label()}
									placeholder={m.chat_settings_provider_default_placeholder()}
									restingValue={0}
									min={-2}
									max={2}
									step={0.1}
									formatValue={(value) => value.toFixed(1)}
								/>
							)}
						/>
					</div>
				</CollapsibleContent>
			</Collapsible>

			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<div className="flex justify-end">
				<Button type="submit" size="sm" loading={isSubmitting}>
					{m.chat_settings_save_button()}
				</Button>
			</div>
		</form>
	);
};

const ChatBlocksEditor = ({
	chatId,
	zedToken,
}: {
	chatId: ChatId;
	zedToken?: string;
}) => {
	const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
	const [isDatabasePickerOpen, setIsDatabasePickerOpen] = useState(false);
	const { data: attachedBlocks } = useQuery(
		orpc.chatBlock.list.queryOptions({
			input: {
				chatId,
				zedToken,
			},
		}),
	);

	const attachMutation = useMutation(
		orpc.chatBlock.attach.mutationOptions({
			onError: (error) => {
				toast.error(m.chat_settings_block_attach_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
			},
		}),
	);

	const detachMutation = useMutation(
		orpc.chatBlock.detach.mutationOptions({
			onError: () => {
				toast.error(m.chat_settings_block_detach_failed_toast_error());
			},
		}),
	);

	const attached = attachedBlocks?.data ?? [];
	const attachedTemplateBlock = attached.find(
		(block) => block.type === "template",
	);
	const attachedTemplateIds = attached
		.filter((block) => block.type === "template")
		.map((block) => block.id);
	const attachedDatabaseIds = attached
		.filter((block) => block.type === "database")
		.map((block) => block.id);

	return (
		<div className="flex flex-col gap-3">
			<Label className="text-base">{m.chat_settings_blocks_label()}</Label>

			<div className="space-y-3 rounded-2xl border border-dashed bg-muted/15 p-4">
				<div className="grid gap-2 sm:grid-cols-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsTemplatePickerOpen(true)}
						disabled={!!attachedTemplateBlock || attachMutation.isPending}
					>
						<PlusIcon className="mr-2 size-4" />
						{m.chat_settings_add_behaviour_action()}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsDatabasePickerOpen(true)}
						disabled={attachMutation.isPending}
					>
						<PlusIcon className="mr-2 size-4" />
						{m.chat_settings_add_repository_action()}
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					{attachedTemplateBlock
						? m.chat_settings_blocks_hint_behaviour_attached({
								name: attachedTemplateBlock.name,
							})
						: m.chat_settings_blocks_hint()}
				</p>
			</div>

			<Separator />

			<Label>{m.chat_settings_attached_blocks_label()}</Label>

			{attached.length === 0 && (
				<p className="text-muted-foreground text-sm">
					{m.chat_settings_attached_blocks_empty_state()}
				</p>
			)}

			{attached.map((block) => (
				<div key={block.id} className="flex items-start gap-2">
					<div className="flex-1">
						<BlockCard block={block} />
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="shrink-0"
						loading={
							detachMutation.isPending &&
							detachMutation.variables.blockId === block.id
						}
						disabled={detachMutation.isPending}
						aria-label={m.chat_settings_attached_block_remove_aria_label({
							name: block.name,
						})}
						onClick={() =>
							detachMutation.mutate({
								chatId,
								blockId: block.id,
								zedToken,
							})
						}
					>
						<XIcon className="size-4" aria-hidden="true" />
					</Button>
				</div>
			))}

			<BlockSelectorDialog
				open={isTemplatePickerOpen}
				onOpenChange={setIsTemplatePickerOpen}
				type="template"
				selectedIds={attachedTemplateIds}
				onSelect={async (block) => {
					await attachMutation.mutateAsync({
						chatId,
						blockId: block.id,
						zedToken,
					});
				}}
				title={m.chat_settings_behaviour_dialog_title()}
				description={m.chat_settings_behaviour_dialog_description()}
			/>
			<BlockSelectorDialog
				open={isDatabasePickerOpen}
				onOpenChange={setIsDatabasePickerOpen}
				type="database"
				selectedIds={attachedDatabaseIds}
				onSelect={async (block) => {
					await attachMutation.mutateAsync({
						chatId,
						blockId: block.id,
						zedToken,
					});
				}}
				title={m.chat_settings_repository_dialog_title()}
				description={m.chat_settings_repository_dialog_description()}
			/>
		</div>
	);
};

const ChatFeaturesEditor = ({
	chatId,
	features,
}: {
	chatId: ChatId;
	features: Features;
}) => {
	const queryClient = useQueryClient();
	const updateMutation = useMutation(
		orpc.chat.update.mutationOptions({
			// Waiting for the chat's refetch keeps the switch on its new value until it lands.
			onSuccess: () =>
				queryClient.refetchQueries(
					{
						queryKey: orpc.chat.find.key(),
						type: "active",
					},
					{
						cancelRefetch: false,
					},
				),
			onError: (error) => {
				toast.error(m.chat_settings_feature_update_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
			},
		}),
	);

	return (
		<FeaturesSection
			value={
				updateMutation.isPending
					? (updateMutation.variables.config?.features ?? {})
					: features
			}
			ids={CHAT_FEATURE_IDS}
			onChange={(next) =>
				updateMutation.mutate({
					id: chatId,
					config: {
						features: next,
					},
				})
			}
			disabled={updateMutation.isPending}
		/>
	);
};

const BotFeatures = ({ botId }: { botId: string }) => {
	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: botId,
			},
		}),
	);

	return <FeaturesSection value={bot.data.features} />;
};

const BotDetails = ({ botId }: { botId: string }) => {
	const { data: bot } = useSuspenseQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: botId,
			},
		}),
	);

	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: {
				filters: {
					botId,
				},
			},
		}),
	);

	return (
		<div className="flex flex-col gap-6">
			<BotCard
				bot={bot.data}
				actions={{
					footer: [],
				}}
			/>
			<div className="grid gap-6 md:grid-cols-2">
				{blocks.data.map((block) => (
					<BlockCard
						key={block.id}
						block={block}
						actions={{
							footer: [],
						}}
					/>
				))}
			</div>
		</div>
	);
};

export { ChatSettings };
