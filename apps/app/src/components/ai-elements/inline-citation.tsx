import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({
	className,
	...props
}: InlineCitationProps) => (
	<span
		className={cn("group inline items-center gap-1", className)}
		{...props}
	/>
);

type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({
	className,
	...props
}: InlineCitationTextProps) => (
	<span
		className={cn("transition-colors group-hover:bg-accent", className)}
		{...props}
	/>
);

type InlineCitationCardProps = ComponentProps<typeof Popover>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
	<Popover {...props} />
);

type InlineCitationCardTriggerProps = ComponentProps<typeof Badge> & {
	sources: string[];
	label?: string;
};

export const InlineCitationCardTrigger = ({
	sources,
	label,
	className,
	...props
}: InlineCitationCardTriggerProps) => (
	<PopoverTrigger
		render={
			<Badge
				className={cn(
					"ml-1 inline-flex min-w-0 max-w-48 rounded-full align-middle",
					className,
				)}
				variant="secondary"
				title={
					label ??
					sources[0] ??
					m.ai_elements_inline_citation_unknown_source_label()
				}
				{...props}
				render={<button type="button" />}
			/>
		}
	>
		<span className="truncate">
			{label ? (
				label
			) : sources[0] ? (
				<>
					{tryHostname(sources[0])}{" "}
					{sources.length > 1 && `+${sources.length - 1}`}
				</>
			) : (
				m.ai_elements_inline_citation_unknown_source_label()
			)}
		</span>
	</PopoverTrigger>
);

const tryHostname = (url: string) => {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
};

type InlineCitationCardBodyProps = ComponentProps<typeof PopoverContent>;

export const InlineCitationCardBody = ({
	className,
	...props
}: InlineCitationCardBodyProps) => (
	<PopoverContent
		className={cn(
			"relative max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-2rem))] min-w-0 overflow-auto p-0",
			className,
		)}
		{...props}
	/>
);
