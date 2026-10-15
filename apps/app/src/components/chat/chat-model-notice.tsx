import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** Why the composer cannot chat: no usable model, or no quota pool for the chosen one. */
type ChatModelNoticeReason = "model" | "quota";

const ChatModelNotice = ({
	reason,
	className,
}: {
	reason: ChatModelNoticeReason;
	className?: string;
}) => {
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
	const canFix = hasCapability(
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
					to={reason === "model" ? "/app/models" : "/app/quotas/add"}
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "shrink-0",
					})}
				>
					{reason === "model"
						? m.chat_model_notice_models_action()
						: m.chat_quota_notice_create_pool_action()}
				</Link>
			)}
		</div>
	);
};

export { ChatModelNotice, type ChatModelNoticeReason };
