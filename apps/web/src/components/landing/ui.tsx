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
				"rounded-xl border border-landing-border bg-landing-surface-raised",
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
				"font-mono text-landing-accent-muted text-sm uppercase tracking-[0.12em]",
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
				className={cn("text-balance text-3xl leading-tight", eyebrow && "mt-4")}
			>
				{children}
			</h2>
		</div>
	);
}

export function BodyCopy({ className, ...props }: ComponentProps<"p">) {
	return (
		<p className={cn("text-landing-muted leading-7", className)} {...props} />
	);
}

const actionVariants = {
	primary:
		"border-landing-surface-inverse bg-landing-surface-inverse text-white hover:opacity-90 dark:text-landing-accent-foreground",
	secondary:
		"border-landing-border bg-transparent text-landing-foreground hover:bg-landing-surface-raised",
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
				"inline-flex items-center gap-2 rounded-lg border px-5 py-3 font-medium transition-colors",
				actionVariants[variant],
				variant === "primary" && "dark:bg-landing-accent",
				className,
			)}
			{...props}
		/>
	);
}
