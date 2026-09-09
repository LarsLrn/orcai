import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LandingSection({
	className,
	...props
}: ComponentProps<"section">) {
	return (
		<section
			className={cn("mx-auto w-full max-w-7xl px-4 py-10 sm:px-8", className)}
			{...props}
		/>
	);
}

export function Surface({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-3xl border border-landing-border bg-landing-surface-raised",
				className,
			)}
			{...props}
		/>
	);
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"font-medium text-landing-muted text-xs uppercase tracking-[0.12em]",
				className,
			)}
			{...props}
		/>
	);
}

export function SectionHeading({
	eyebrow,
	children,
	className,
}: {
	eyebrow?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			{eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
			<h2
				className={cn(
					"text-balance font-semibold text-3xl leading-tight tracking-tight",
					eyebrow && "mt-4",
				)}
			>
				{children}
			</h2>
		</div>
	);
}

export function BodyCopy({ className, ...props }: ComponentProps<"p">) {
	return (
		<p className={cn("text-landing-muted leading-6", className)} {...props} />
	);
}

const actionVariants = {
	primary:
		"border-landing-surface-inverse bg-landing-surface-inverse text-landing-surface-inverse-foreground hover:opacity-90",
	secondary:
		"border-landing-border bg-transparent text-landing-foreground hover:bg-landing-surface-hover",
} as const;

export function ActionLink({
	variant = "secondary",
	className,
	...props
}: ComponentProps<"a"> & {
	variant?: keyof typeof actionVariants;
}) {
	return (
		<a
			className={cn(
				"inline-flex items-center gap-2 rounded-full border px-5 py-2.5 font-medium transition-[color,background-color,border-color,opacity]",
				"focus-visible:outline-2 focus-visible:outline-landing-accent focus-visible:outline-offset-2",
				actionVariants[variant],
				className,
			)}
			{...props}
		/>
	);
}
