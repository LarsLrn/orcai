import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const ChatModelNotice = ({ className }: { className?: string }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: organization } = useQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId ?? "",
			},
			enabled: !!auth.session.activeOrganizationId,
		}),
	);
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_models",
	]);
	const canManageModels = hasCapability(
		capabilities?.data.capabilities,
		"manage_models",
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
				<p className="text-foreground">
					{m.chat_model_notice_title({
						organisation: organizationName,
					})}{" "}
					<span className="text-muted-foreground">
						{canManageModels
							? m.chat_model_notice_description_manager()
							: m.chat_model_notice_description_member()}
					</span>
				</p>
			</div>
			{canManageModels && (
				<Link
					to="/app/models"
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "shrink-0",
					})}
				>
					{m.chat_model_notice_add_model_action()}
				</Link>
			)}
		</div>
	);
};

export { ChatModelNotice };
