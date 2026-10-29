import { Link, type LinkProps } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { Section, SectionTitle } from "@/components/ui/shell/section";

/** A titled block of the Use view, with a quiet link to the full list. */
const HomeSection = ({
	title,
	linkLabel,
	linkProps,
	children,
}: {
	title: string;
	linkLabel: string;
	linkProps: LinkProps;
	children: ReactNode;
}) => {
	const titleId = useId();

	return (
		<Section aria-labelledby={titleId} className="gap-4">
			<div className="flex items-baseline justify-between gap-4">
				<SectionTitle id={titleId}>{title}</SectionTitle>
				<Link
					{...linkProps}
					className="shrink-0 rounded-sm text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/75"
				>
					{linkLabel}
				</Link>
			</div>
			{children}
		</Section>
	);
};

export { HomeSection };
