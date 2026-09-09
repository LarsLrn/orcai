import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

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
	const organizationName = organization?.data.name ?? "this organisation";

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
					No chat model is available in {organizationName} yet.{" "}
					<span className="text-muted-foreground">
						{canManageModels
							? "Add a provider and a model, then chatting opens for everyone."
							: "An organisation admin needs to add a provider and a model before anyone can chat."}
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
					Add a model
				</Link>
			)}
		</div>
	);
};

export { ChatModelNotice };
