import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, SparklesIcon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** Shown instead of the composer while the organisation has no assistant model. */
const AssistantUnavailable = ({
	variant = "page",
	className,
}: {
	/** `inline` sits in place of a conversation's composer. */
	variant?: "page" | "inline";
	className?: string;
}) => {
	const { data: capabilities } = useOrganizationCapabilities();
	const canFix = hasCapability(
		capabilities?.data.capabilities,
		"manage_organization",
	);
	const description = canFix
		? m.assistant_unavailable_description_admin()
		: m.assistant_unavailable_description_member();
	const action = canFix && (
		<Link
			to="/app/manage"
			className={buttonVariants({
				variant: "outline",
				size: "sm",
				className: "shrink-0",
			})}
		>
			{m.readiness_open_checklist_action()}
		</Link>
	);

	if (variant === "inline") {
		return (
			<div
				role="status"
				className={cn(
					"bg-muted/60 flex flex-col gap-3 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
					className,
				)}
			>
				<div className="flex items-start gap-2.5">
					<CircleAlertIcon className="text-foreground mt-0.5 size-4 shrink-0" />
					<div className="flex flex-col gap-0.5">
						<p className="text-foreground">{m.assistant_unavailable_title()}</p>
						<p className="text-muted-foreground">{description}</p>
					</div>
				</div>
				{action}
			</div>
		);
	}

	return (
		<Placeholder
			role="status"
			className={className}
			Icon={SparklesIcon}
			title={m.assistant_unavailable_title()}
			description={description}
		>
			{action}
		</Placeholder>
	);
};

export { AssistantUnavailable };
