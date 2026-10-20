import { Link } from "@tanstack/react-router";
import { CircleAlertIcon, SparklesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
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
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const canFix = hasCapability(
		capabilities?.data.capabilities,
		"manage_organization",
	);
	const description = canFix
		? m.assistant_unavailable_description_admin()
		: m.assistant_unavailable_description_member();
	const action = canFix && (
		<Link
			to="/app/organization"
			className={buttonVariants({
				variant: "outline",
				size: "sm",
				className: "shrink-0",
			})}
		>
			{m.assistant_unavailable_admin_action()}
		</Link>
	);

	if (variant === "inline") {
		return (
			<div
				role="status"
				className={cn(
					"flex flex-col gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
					className,
				)}
			>
				<div className="flex items-start gap-2.5">
					<CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
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
		<Empty role="status" className={className}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SparklesIcon />
				</EmptyMedia>
				<EmptyTitle>{m.assistant_unavailable_title()}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{action && <EmptyContent>{action}</EmptyContent>}
		</Empty>
	);
};

export { AssistantUnavailable };
