import { useStore } from "@tanstack/react-form";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { ChevronDownIcon, PlusIcon, SettingsIcon, XIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { BlockCard } from "@/components/blocks/block-card";
import { BlockSelectorDialog } from "@/components/blocks/block-selector-dialog";
import { BotCard } from "@/components/bot/bot-card";
import { chatConfigFormOptions } from "@/components/chat/form/chat-config-form-options";
import { ModelSelectorButton } from "@/components/chat/model-selector";
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
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppForm } from "@/hooks/form";
import { useUpdateChatMutation } from "@/hooks/mutations/use-chat-mutation";
import { DEFAULT_CHAT_GENERATION_PARAMS } from "@/lib/ai/utils/chat-generation-defaults";
import { client, orpc } from "@/lib/orpc/orpc";
import type { Chat, ChatConfig } from "@/lib/orpc/schemas/chat";
import type { Model } from "@/lib/orpc/schemas/model";
import type { Provider } from "@/lib/orpc/schemas/provider";

const ChatSettings = ({
	className,
	chatId,
	zedToken,
}: {
	className?: string;
	chatId: Chat["id"];
	zedToken?: string;
}) => {
	const [open, setOpen] = useState(false);

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
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button variant="ghost" size="icon" className={className}>
						<SettingsIcon />
					</Button>
				}
			/>
			<DialogContent className="flex h-[90vh] max-h-[90vh] flex-col sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>Chat Settings</DialogTitle>
					<DialogDescription>
						{isBotLinked
							? "This chat is linked to a bot. The system prompt is locked, but you can change the model and generation parameters."
							: "Configure the model and parameters for this chat."}
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
							(isBotLinked ? (
								<>
									<Separator />
									<div className="text-muted-foreground text-sm">
										Attached blocks are managed by the bot for bot-linked chats.
									</div>
								</>
							) : (
								<>
									<Separator />
									<ChatBlocksEditor chatId={chatId} zedToken={zedToken} />
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
	chatId: Chat["id"];
	config: ChatConfig;
	isBotLinked: boolean;
}) => {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const { mutate: updateChat } = useUpdateChatMutation();
	const form = useAppForm({
		...chatConfigFormOptions(config),
		onSubmit: ({ value }) => {
			updateChat({
				id: chatId,
				config: {
					modelId: value.modelId,
					providerId: value.providerId,
					temperature: value.temperature,
					maxTokens: value.maxTokens ?? null,
					topP: value.topP,
					frequencyPenalty: value.frequencyPenalty,
					presencePenalty: value.presencePenalty,
					...(isBotLinked
						? {}
						: {
								systemPrompt: value.systemPrompt?.trim() || null,
							}),
				},
			});
		},
	});
	const selectedModelId = useStore(form.store, (state) => state.values.modelId);
	const selectedProviderId = useStore(
		form.store,
		(state) => state.values.providerId,
	);
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

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
				<Label>Model</Label>
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
						<Label>System Prompt</Label>
						<p className="text-muted-foreground text-sm">
							Locked by bot. The system prompt is defined in the bot's template
							block.
						</p>
					</>
				) : (
					<form.AppField
						name="systemPrompt"
						children={(field) => (
							<field.TextareaField
								label="System Prompt"
								placeholder="You are a helpful assistant."
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
							Advanced generation settings
						</div>
						<div className="text-muted-foreground text-sm">
							Adjust temperature, token limits, and penalties.
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
									label="Temperature"
									defaultValue={DEFAULT_CHAT_GENERATION_PARAMS.temperature}
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
									label="Top P"
									defaultValue={DEFAULT_CHAT_GENERATION_PARAMS.topP}
									min={0}
									max={1}
									step={0.05}
									formatValue={(value) => value.toFixed(2)}
								/>
							)}
						/>

						<form.AppField
							name="maxTokens"
							children={(field) => (
								<field.TextField
									label="Max Tokens"
									type="number"
									min={1}
									placeholder="Default (model limit)"
								/>
							)}
						/>

						<form.AppField
							name="frequencyPenalty"
							children={(field) => (
								<field.SliderField
									label="Frequency Penalty"
									defaultValue={DEFAULT_CHAT_GENERATION_PARAMS.frequencyPenalty}
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
									label="Presence Penalty"
									defaultValue={DEFAULT_CHAT_GENERATION_PARAMS.presencePenalty}
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
				<Button type="submit" size="sm" disabled={isSubmitting}>
					Save Settings
				</Button>
			</div>
		</form>
	);
};

const ChatBlocksEditor = ({
	chatId,
	zedToken,
}: {
	chatId: Chat["id"];
	zedToken?: string;
}) => {
	const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
	const [isDatabasePickerOpen, setIsDatabasePickerOpen] = useState(false);
	const queryClient = useQueryClient();

	const { data: attachedBlocks } = useQuery(
		orpc.chatBlock.list.queryOptions({
			input: {
				chatId,
				zedToken,
			},
		}),
	);

	const attachMutation = useMutation({
		mutationFn: (blockId: string) =>
			client.chatBlock.attach({
				chatId,
				blockId,
				zedToken,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.chatBlock.list.key({
					input: {
						chatId,
						zedToken,
					},
				}),
			});
		},
		onError: (error) => {
			toast.error("Failed to attach block", {
				description: error instanceof Error ? error.message : undefined,
			});
		},
	});

	const detachMutation = useMutation({
		mutationFn: (blockId: string) =>
			client.chatBlock.detach({
				chatId,
				blockId,
				zedToken,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.chatBlock.list.key({
					input: {
						chatId,
						zedToken,
					},
				}),
			});
		},
		onError: () => {
			toast.error("Failed to detach block");
		},
	});

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
			<Label className="text-base">Chat Blocks</Label>

			<div className="space-y-3 rounded-2xl border border-dashed bg-muted/15 p-4">
				<div className="grid gap-2 sm:grid-cols-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsTemplatePickerOpen(true)}
						disabled={!!attachedTemplateBlock || attachMutation.isPending}
					>
						<PlusIcon className="mr-2 size-4" />
						Add Behaviour
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsDatabasePickerOpen(true)}
						disabled={attachMutation.isPending}
					>
						<PlusIcon className="mr-2 size-4" />
						Add Content Collection
					</Button>
				</div>
				<p className="text-muted-foreground text-sm">
					{attachedTemplateBlock
						? `Only one behaviour block can be attached. Remove "${attachedTemplateBlock.name}" to attach another behaviour.`
						: "Behaviour blocks define system behaviour. Content collections provide retrieval context."}
				</p>
			</div>

			<Separator />

			<Label>Attached Blocks</Label>

			{attached.length === 0 && (
				<p className="text-muted-foreground text-sm">
					No blocks attached to this chat yet.
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
						disabled={detachMutation.isPending}
						onClick={() => detachMutation.mutate(block.id)}
					>
						<XIcon className="size-4" />
					</Button>
				</div>
			))}

			<BlockSelectorDialog
				open={isTemplatePickerOpen}
				onOpenChange={setIsTemplatePickerOpen}
				type="template"
				selectedIds={attachedTemplateIds}
				onSelect={async (block) => {
					await attachMutation.mutateAsync(block.id);
				}}
				title="Add Behaviour"
				description="Attach one reusable AI behaviour block to this chat."
			/>
			<BlockSelectorDialog
				open={isDatabasePickerOpen}
				onOpenChange={setIsDatabasePickerOpen}
				type="database"
				selectedIds={attachedDatabaseIds}
				onSelect={async (block) => {
					await attachMutation.mutateAsync(block.id);
				}}
				title="Add Content Collection"
				description="Attach reusable content collections to enrich chat responses."
			/>
		</div>
	);
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
