import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { ComponentProps } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import type { CarouselApi } from "@/components/ui/carousel";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({
	className,
	...props
}: InlineCitationProps) => (
	<span
		className={cn("group inline items-center gap-1", className)}
		{...props}
	/>
);

export type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({
	className,
	...props
}: InlineCitationTextProps) => (
	<span
		className={cn("transition-colors group-hover:bg-accent", className)}
		{...props}
	/>
);

export type InlineCitationCardProps = ComponentProps<typeof Popover>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
	<Popover {...props} />
);

export type InlineCitationCardTriggerProps = ComponentProps<typeof Badge> & {
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
				title={label ?? sources[0] ?? "unknown"}
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
				"unknown"
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

export type InlineCitationCardBodyProps = ComponentProps<typeof PopoverContent>;

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

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

const useCarouselApi = () => {
	const context = useContext(CarouselApiContext);
	return context;
};

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
	className,
	children,
	...props
}: InlineCitationCarouselProps) => {
	const [api, setApi] = useState<CarouselApi>();

	return (
		<CarouselApiContext.Provider value={api}>
			<Carousel className={cn("w-full", className)} setApi={setApi} {...props}>
				{children}
			</Carousel>
		</CarouselApiContext.Provider>
	);
};

export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export const InlineCitationCarouselContent = (
	props: InlineCitationCarouselContentProps,
) => <CarouselContent {...props} />;

export type InlineCitationCarouselItemProps = ComponentProps<"fieldset">;

export const InlineCitationCarouselItem = ({
	className,
	...props
}: InlineCitationCarouselItemProps) => (
	<CarouselItem
		className={cn("w-full min-w-0 space-y-2 p-4 pl-8", className)}
		{...props}
	/>
);

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export const InlineCitationCarouselHeader = ({
	className,
	...props
}: InlineCitationCarouselHeaderProps) => (
	<div
		className={cn(
			"flex min-w-0 items-center justify-between gap-2 rounded-t-md bg-secondary p-2",
			className,
		)}
		{...props}
	/>
);

export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export const InlineCitationCarouselIndex = ({
	children,
	className,
	...props
}: InlineCitationCarouselIndexProps) => {
	const api = useCarouselApi();
	const [current, setCurrent] = useState(0);
	const [count, setCount] = useState(0);

	const syncState = useCallback(() => {
		if (!api) {
			return;
		}
		setCount(api.scrollSnapList().length);
		setCurrent(api.selectedScrollSnap() + 1);
	}, [
		api,
	]);

	useEffect(() => {
		if (!api) {
			return;
		}

		syncState();

		api.on("select", syncState);

		return () => {
			api.off("select", syncState);
		};
	}, [
		api,
		syncState,
	]);

	return (
		<div
			className={cn(
				"flex flex-1 items-center justify-end px-3 py-1 text-muted-foreground text-xs",
				className,
			)}
			{...props}
		>
			{children ?? `${current}/${count}`}
		</div>
	);
};

export type InlineCitationCarouselPrevProps = ComponentProps<"button">;

export const InlineCitationCarouselPrev = ({
	className,
	...props
}: InlineCitationCarouselPrevProps) => {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		if (api) {
			api.scrollPrev();
		}
	}, [
		api,
	]);

	return (
		<button
			aria-label="Previous"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			type="button"
			{...props}
		>
			<ArrowLeftIcon className="size-4 text-muted-foreground" />
		</button>
	);
};

export type InlineCitationCarouselNextProps = ComponentProps<"button">;

export const InlineCitationCarouselNext = ({
	className,
	...props
}: InlineCitationCarouselNextProps) => {
	const api = useCarouselApi();

	const handleClick = useCallback(() => {
		if (api) {
			api.scrollNext();
		}
	}, [
		api,
	]);

	return (
		<button
			aria-label="Next"
			className={cn("shrink-0", className)}
			onClick={handleClick}
			type="button"
			{...props}
		>
			<ArrowRightIcon className="size-4 text-muted-foreground" />
		</button>
	);
};

export type InlineCitationSourceProps = ComponentProps<"div"> & {
	title?: string;
	url?: string;
	description?: string;
};

export const InlineCitationSource = ({
	title,
	url,
	description,
	className,
	children,
	...props
}: InlineCitationSourceProps) => (
	<div className={cn("min-w-0 space-y-1", className)} {...props}>
		{title && (
			<h4 className="truncate font-medium text-sm leading-tight" title={title}>
				{title}
			</h4>
		)}
		{url && (
			<p
				className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
				title={url}
			>
				{url}
			</p>
		)}
		{description && (
			<p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
				{description}
			</p>
		)}
		{children}
	</div>
);

export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export const InlineCitationQuote = ({
	children,
	className,
	...props
}: InlineCitationQuoteProps) => (
	<blockquote
		className={cn(
			"min-w-0 break-words border-muted border-l-2 pl-3 text-muted-foreground text-sm italic [overflow-wrap:anywhere]",
			className,
		)}
		{...props}
	>
		{children}
	</blockquote>
);
