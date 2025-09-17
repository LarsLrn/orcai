import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type Block,
	isDatabaseBlock,
	isTemplateBlock,
} from "@/lib/orpc/schemas/block";
import { cn } from "@/lib/utils";

const toTitleCase = (value: string) =>
	value.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());

const blockTypeThemes: Record<
	string,
	{ label: string; badge: string; accent: string }
> = {
	template: {
		label: "Template",
		badge:
			"border-blue-200/70 bg-blue-500/10 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200",
		accent: "from-blue-500/50 via-blue-400/25 to-transparent",
	},
	database: {
		label: "Database",
		badge:
			"border-emerald-200/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
		accent: "from-emerald-500/50 via-emerald-400/25 to-transparent",
	},
};

const BlockPreview = ({
	children,
	className,
	block,
}: {
	children?: React.ReactNode;
	className?: HTMLDivElement["className"];
	block: Block;
}) => {
	const theme = blockTypeThemes[block.type] ?? {
		label: toTitleCase(block.type),
		badge: "border-border/50 bg-muted/60 text-foreground",
		accent: "from-border/60 via-border/30 to-transparent",
	};

	const details: Array<{ label: string; value: string }> = [];
	const addDetail = (
		label: string,
		value: string | number | null | undefined,
	) => {
		if (value === undefined || value === null || value === "") {
			return;
		}
		details.push({ label, value: String(value) });
	};

	if (isTemplateBlock(block)) {
		addDetail("Model", block.config.model);
		addDetail("Provider", block.config.provider);
	}

	if (isDatabaseBlock(block)) {
		addDetail("Provider", block.config.provider);
		addDetail("Embedding", block.config.embeddingModel);
		if (
			block.config.minReferences !== undefined &&
			block.config.maxReferences !== undefined
		) {
			addDetail(
				"References",
				`${block.config.minReferences}–${block.config.maxReferences}`,
			);
		}
	}

	return (
		<Card
			key={block.id}
			className={cn(
				"group relative overflow-hidden border-border/60 bg-card/80 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
				className,
			)}
		>
			<span
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
					theme.accent,
				)}
			/>
			<CardHeader className="gap-3">
				<CardTitle className="truncate font-semibold text-base">
					{block.name}
				</CardTitle>
				<Badge
					variant="secondary"
					className={cn(
						"inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium text-foreground/80 text-xs uppercase tracking-widest transition-colors group-hover:border-primary/40 group-hover:text-foreground",
						theme.badge,
					)}
				>
					<span className="h-1.5 w-1.5 rounded-full bg-current" />
					{theme.label}
				</Badge>
				<CardAction className="flex flex-col items-end gap-2 text-muted-foreground text-xs">
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-1 font-medium text-foreground/70 transition-colors group-hover:border-primary/40 group-hover:text-foreground">
								v{block.version}
							</span>
						</TooltipTrigger>
						<TooltipContent sideOffset={6}>
							<p>Block version {block.version}</p>
						</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 text-muted-foreground text-xs">
				{details.length > 0 ? (
					<dl className="grid gap-1.5">
						{details.map(({ label, value }) => (
							<div
								key={label}
								className="flex items-center justify-between gap-4"
							>
								<dt className="text-foreground/70">{label}</dt>
								<dd className="font-medium text-foreground">{value}</dd>
							</div>
						))}
					</dl>
				) : null}
			</CardContent>
			<CardFooter>
				{children ? <div className="text-right">{children}</div> : null}
			</CardFooter>
		</Card>
	);
};

export { BlockPreview };
