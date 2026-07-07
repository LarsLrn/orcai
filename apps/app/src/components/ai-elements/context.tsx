import type { LanguageModelUsage } from "ai";
import { type ComponentProps, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

type ModelId = string;

type ContextSchema = {
	usedTokens: number;
	maxTokens: number;
	usage?: LanguageModelUsage;
	modelId?: ModelId;
};

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
	const context = useContext(ContextContext);

	if (!context) {
		throw new Error("Context components must be used within Context");
	}

	return context;
};

export type ContextProps = ComponentProps<typeof Popover> & ContextSchema;

export const Context = ({
	usedTokens,
	maxTokens,
	usage,
	modelId,
	...props
}: ContextProps) => (
	<ContextContext.Provider
		value={{
			usedTokens,
			maxTokens,
			usage,
			modelId,
		}}
	>
		<Popover {...props} />
	</ContextContext.Provider>
);

const ContextIcon = () => {
	const { usedTokens, maxTokens } = useContextValue();
	const circumference = 2 * Math.PI * ICON_RADIUS;
	const usedPercent = usedTokens / maxTokens;
	const dashOffset = circumference * (1 - usedPercent);

	return (
		<svg
			aria-label="Model context usage"
			height="20"
			role="img"
			style={{
				color: "currentcolor",
			}}
			viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
			width="20"
		>
			<circle
				cx={ICON_CENTER}
				cy={ICON_CENTER}
				fill="none"
				opacity="0.25"
				r={ICON_RADIUS}
				stroke="currentColor"
				strokeWidth={ICON_STROKE_WIDTH}
			/>
			<circle
				cx={ICON_CENTER}
				cy={ICON_CENTER}
				fill="none"
				opacity="0.7"
				r={ICON_RADIUS}
				stroke="currentColor"
				strokeDasharray={`${circumference} ${circumference}`}
				strokeDashoffset={dashOffset}
				strokeLinecap="round"
				strokeWidth={ICON_STROKE_WIDTH}
				style={{
					transformOrigin: "center",
					transform: "rotate(-90deg)",
				}}
			/>
		</svg>
	);
};

export type ContextTriggerProps = ComponentProps<typeof Button> & {
	children?: React.ReactElement;
};

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
	const { usedTokens, maxTokens } = useContextValue();
	const usedPercent = usedTokens / maxTokens;
	const renderedPercent = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);

	return (
		<PopoverTrigger
			render={
				<Button
					type="button"
					variant="ghost"
					className="min-w-0 max-w-full"
					{...props}
				/>
			}
		>
			{children && (
				<>
					{children}
					<Separator orientation="vertical" className="mx-2 my-auto h-4" />
				</>
			)}
			<span className="shrink-0 font-medium text-muted-foreground">
				{renderedPercent}
			</span>
			<ContextIcon />
		</PopoverTrigger>
	);
};

export type ContextContentProps = ComponentProps<typeof PopoverContent>;

export const ContextContent = ({
	className,
	...props
}: ContextContentProps) => (
	<PopoverContent
		className={cn(
			"max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-2rem))] min-w-0 divide-y overflow-auto p-0",
			className,
		)}
		{...props}
	/>
);

export type ContextContentHeaderProps = ComponentProps<"div">;

export const ContextContentHeader = ({
	children,
	className,
	...props
}: ContextContentHeaderProps) => {
	const { usedTokens, maxTokens } = useContextValue();
	const usedPercent = usedTokens / maxTokens;
	const displayPct = new Intl.NumberFormat("en-US", {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(usedPercent);
	const used = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(usedTokens);
	const total = new Intl.NumberFormat("en-US", {
		notation: "compact",
	}).format(maxTokens);

	return (
		<div className={cn("w-full space-y-2 p-3", className)} {...props}>
			{children ?? (
				<>
					<div className="flex items-center justify-between gap-3 text-xs">
						<p>{displayPct}</p>
						<p className="font-mono text-muted-foreground">
							{used} / {total}
						</p>
					</div>
					<div className="space-y-2">
						<Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
					</div>
				</>
			)}
		</div>
	);
};

export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({
	children,
	className,
	...props
}: ContextContentBodyProps) => (
	<div className={cn("w-full p-3", className)} {...props}>
		{children}
	</div>
);

export type ContextContentFooterProps = ComponentProps<"div">;

export const ContextContentFooter = ({
	children,
	className,
	...props
}: ContextContentFooterProps) => {
	const { usage } = useContextValue();

	return (
		<div
			className={cn(
				"flex w-full items-center justify-between gap-3 bg-secondary/20 p-3 text-xs",
				className,
			)}
			{...props}
		>
			{children ?? (
				<>
					<span className="text-muted-foreground">Total tokens</span>
					<span>{usage?.totalTokens}</span>
				</>
			)}
		</div>
	);
};

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({
	className,
	children,
	...props
}: ContextInputUsageProps) => {
	const { usage } = useContextValue();
	const inputTokens = usage?.inputTokens ?? 0;

	if (children) {
		return children;
	}

	if (!inputTokens) {
		return null;
	}

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Input</span>
			<Tokens tokens={inputTokens} />
		</div>
	);
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({
	className,
	children,
	...props
}: ContextOutputUsageProps) => {
	const { usage } = useContextValue();
	const outputTokens = usage?.outputTokens ?? 0;

	if (children) {
		return children;
	}

	if (!outputTokens) {
		return null;
	}

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Output</span>
			<Tokens tokens={outputTokens} />
		</div>
	);
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({
	className,
	children,
	...props
}: ContextReasoningUsageProps) => {
	const { usage } = useContextValue();
	const reasoningTokens = usage?.outputTokenDetails?.reasoningTokens ?? 0;

	if (children) {
		return children;
	}

	if (!reasoningTokens) {
		return null;
	}

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Reasoning</span>
			<Tokens tokens={reasoningTokens} />
		</div>
	);
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({
	className,
	children,
	...props
}: ContextCacheUsageProps) => {
	const { usage } = useContextValue();
	const cacheTokens = usage?.inputTokenDetails?.noCacheTokens ?? 0;

	if (children) {
		return children;
	}

	if (!cacheTokens) {
		return null;
	}

	return (
		<div
			className={cn("flex items-center justify-between text-xs", className)}
			{...props}
		>
			<span className="text-muted-foreground">Cache</span>
			<Tokens tokens={cacheTokens} />
		</div>
	);
};

const Tokens = ({ tokens }: { tokens?: number }) => (
	<span>
		{tokens === undefined
			? "—"
			: new Intl.NumberFormat("en-US", {
					notation: "compact",
				}).format(tokens)}
	</span>
);
