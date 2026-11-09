import type { BotId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { DisplayTimestamp } from "@/components/app/display-time";
import { MODEL_STEP_INDEX } from "@/components/authoring/bot-editor-steps";
import type { ComposerBlocker } from "@/components/chat/composer/composer-blocker";
import { buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { hasCapability } from "@/lib/authz/capabilities";
import { formatRelativeTime } from "@/lib/locale/format-timestamp";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** The bot's required model cannot serve the user; its setup editors get a way to change it. */
const BotModelNotice = ({ botId }: { botId: BotId }) => {
	const { data: bot } = useQuery(
		orpc.bot.find.queryOptions({
			input: {
				id: botId,
			},
		}),
	);
	const { data: setup } = useQuery(
		orpc.botSetup.find.queryOptions({
			input: {
				botId,
			},
		}),
	);
	const canEdit = setup?.data.canEdit === true;

	return (
		<>
			<div className="flex items-start gap-2.5">
				<CircleAlertIcon className="text-foreground mt-0.5 size-4 shrink-0" />
				<p className="text-foreground">
					{m.chat_bot_model_notice_title({
						bot: bot?.data.name ?? m.chat_bot_model_notice_bot_fallback(),
					})}{" "}
					<span className="text-muted-foreground">
						{canEdit
							? m.chat_bot_model_notice_description_editor()
							: m.chat_bot_model_notice_description_member()}
					</span>
				</p>
			</div>
			{canEdit && (
				<Link
					to="/app/library/bots/$botId/setup"
					params={{
						botId,
					}}
					search={{
						step: MODEL_STEP_INDEX,
					}}
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "shrink-0",
					})}
				>
					{m.chat_bot_model_notice_action()}
				</Link>
			)}
		</>
	);
};

/** Why the composer cannot send, below it: no usable model, no pool for the chosen one, or a used-up pool. */
const ChatModelNotice = ({
	blocker,
	className,
	assistant = false,
}: {
	blocker: ComposerBlocker;
	className?: string;
	/** The Assistant's model is the admins' choice, so the notice never suggests another. */
	assistant?: boolean;
}) => {
	const { reason } = blocker;
	const { data: organization } = useActiveOrganization();
	const { data: capabilities } = useOrganizationCapabilities();
	// Managers reach a used-up pool through the usage indicator.
	const canFix =
		reason !== "exhausted" &&
		reason !== "bot-model" &&
		hasCapability(
			capabilities?.data.capabilities,
			reason === "model" ? "manage_models" : "manage_quota_pools",
		);
	const organizationName =
		organization?.data.name ?? m.chat_model_notice_organisation_fallback();

	return (
		<div
			id="chat-model-notice"
			role="status"
			className={cn(
				"bg-muted/60 flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			{blocker.reason === "bot-model" ? (
				<BotModelNotice botId={blocker.botId} />
			) : (
				<>
					<div className="flex items-start gap-2.5">
						<CircleAlertIcon className="text-foreground mt-0.5 size-4 shrink-0" />
						{reason === "model" ? (
							<p className="text-foreground">
								{m.chat_model_notice_title({
									organisation: organizationName,
								})}{" "}
								<span className="text-muted-foreground">
									{canFix
										? m.chat_model_notice_description_manager()
										: m.chat_model_notice_description_member()}
								</span>
							</p>
						) : blocker.reason === "exhausted" ? (
							<p className="text-foreground">
								{m.chat_quota_exhausted_notice_title()}{" "}
								<Tooltip>
									<TooltipTrigger
										render={<span className="text-muted-foreground" />}
									>
										{m.chat_quota_exhausted_notice_resets({
											time: formatRelativeTime(blocker.resetsAt),
										})}
									</TooltipTrigger>
									<TooltipContent>
										<DisplayTimestamp value={blocker.resetsAt} />
									</TooltipContent>
								</Tooltip>
							</p>
						) : (
							<p className="text-foreground">
								{m.chat_quota_notice_title()}{" "}
								<span className="text-muted-foreground">
									{canFix
										? assistant
											? m.assistant_quota_notice_description_manager()
											: m.chat_quota_notice_description_manager()
										: assistant
											? m.assistant_quota_notice_description_member()
											: m.chat_quota_notice_description_member()}
								</span>
							</p>
						)}
					</div>
					{canFix && (
						<Link
							to={reason === "model" ? "/app/manage" : "/app/quota-pools/add"}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "shrink-0",
							})}
						>
							{reason === "model"
								? m.readiness_open_checklist_action()
								: m.chat_quota_notice_create_pool_action()}
						</Link>
					)}
				</>
			)}
		</div>
	);
};

export { ChatModelNotice };
