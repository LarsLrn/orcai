import type { BotId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { MODEL_STEP_INDEX } from "@/components/authoring/bot-editor-steps";
import type { ComposerBlocker } from "@/components/chat/composer-blocker";
import { buttonVariants } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import {
	formatDisplayTimestamp,
	formatRelativeTime,
} from "@/lib/presentation/format-timestamp";
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
				<CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
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
					to="/app/hub/bots/$botId/setup"
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
}: {
	blocker: ComposerBlocker;
	className?: string;
}) => {
	const { reason } = blocker;
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId ?? "",
			},
			enabled: reason === "model" && !!auth.session.activeOrganizationId,
		}),
	);
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_models",
		"manage_quotas",
	]);
	// Managers reach a used-up pool through the usage indicator.
	const canFix =
		reason !== "exhausted" &&
		reason !== "bot-model" &&
		hasCapability(
			capabilities?.data.capabilities,
			reason === "model" ? "manage_models" : "manage_quotas",
		);
	const organizationName =
		organization?.data.name ?? m.chat_model_notice_organisation_fallback();

	return (
		<div
			id="chat-model-notice"
			role="status"
			className={cn(
				"flex flex-col gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			{blocker.reason === "bot-model" ? (
				<BotModelNotice botId={blocker.botId} />
			) : (
				<>
					<div className="flex items-start gap-2.5">
						<CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
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
										{formatDisplayTimestamp(blocker.resetsAt)}
									</TooltipContent>
								</Tooltip>
							</p>
						) : (
							<p className="text-foreground">
								{m.chat_quota_notice_title()}{" "}
								<span className="text-muted-foreground">
									{canFix
										? m.chat_quota_notice_description_manager()
										: m.chat_quota_notice_description_member()}
								</span>
							</p>
						)}
					</div>
					{canFix && (
						<Link
							to={reason === "model" ? "/app/manage" : "/app/quotas/add"}
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
