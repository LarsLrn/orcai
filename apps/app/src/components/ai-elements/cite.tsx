import type { AssetId } from "@orcai/core";
import { docsMarkdownPath, docsPageUrl, safeExternalUrl } from "@orcai/core";
import type { AssetMetadataType } from "@orcai/schema";
import { assetIdSchema, sourceTypeLabels } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpenIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmedLink } from "@/components/ui/composed/link-confirm";
import { hostOf } from "@/components/ui/composed/link-safety";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { usePublicConfig } from "@/hooks/use-public-config";
import type { StreamedCitations } from "@/lib/ai/citations/chat-sources";
import { formatAssetTitle } from "@/lib/assets/asset-title";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const CitePill = ({
	label,
	ariaLabel,
	text,
	onOpenChange,
	children,
}: {
	label: string;
	ariaLabel: string;
	text?: ReactNode;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) => (
	<span>
		<span>{text}</span>
		<Popover onOpenChange={onOpenChange}>
			<PopoverTrigger
				render={
					<Badge
						className="bg-accent-brand/10 text-accent-brand hover:bg-accent-brand/20 ml-1 inline-flex max-w-48 min-w-0 rounded-full border-transparent align-middle text-xs font-medium transition-colors duration-150"
						variant="secondary"
						title={label}
						aria-label={ariaLabel}
						render={<button type="button" />}
					/>
				}
			>
				<span className="truncate">{label}</span>
			</PopoverTrigger>
			<PopoverContent className="relative max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-2rem))] min-w-0 overflow-auto p-0">
				{children}
			</PopoverContent>
		</Popover>
	</span>
);

const CiteCardShell = ({
	title,
	page,
	children,
}: {
	title: string;
	page?: number;
	children: ReactNode;
}) => (
	<div className="space-y-3 p-4">
		<h4 className="text-sm leading-snug font-medium">{title}</h4>
		{children}
		{page === undefined ? null : (
			<p className="text-muted-foreground text-xs">
				{m.ai_elements_cite_page_label({
					page,
				})}
			</p>
		)}
	</div>
);

const CiteCardContent = ({
	assetId,
	title,
	page,
}: {
	assetId: AssetId;
	title: string;
	page?: number;
}) => {
	const { data, isLoading, isError } = useQuery(
		orpc.asset.find.queryOptions({
			input: {
				id: assetId,
			},
		}),
	);

	if (isLoading) {
		return (
			<CiteCardShell title={title} page={page}>
				<p className="text-muted-foreground flex items-center gap-2 text-xs">
					<Spinner className="size-3" />
					{m.ai_elements_cite_loading_label()}
				</p>
			</CiteCardShell>
		);
	}

	if (isError || !data?.data) {
		return (
			<CiteCardShell title={title} page={page}>
				<p className="text-muted-foreground text-xs">
					{m.ai_elements_cite_load_error()}
				</p>
			</CiteCardShell>
		);
	}

	const asset = data.data;
	const metadata = asset.metadata as AssetMetadataType | null;
	const sourceType = metadata?.sourceType;
	const typeLabel = sourceType ? sourceTypeLabels[sourceType] : null;

	return (
		<CiteCardShell
			title={formatAssetTitle(asset.title) ?? m.chat_source_fallback_title()}
			page={page}
		>
			{typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
			{metadata?.author && (
				<p className="text-muted-foreground text-xs">{metadata.author}</p>
			)}
			{metadata?.citationLabel && (
				<p className="text-muted-foreground text-xs italic">
					{metadata.citationLabel}
				</p>
			)}
			<Link
				className={buttonVariants({
					variant: "outline",
					size: "sm",
					className: "w-full",
				})}
				to="/app/library/assets/$assetId"
				params={{
					assetId,
				}}
			>
				{m.ai_elements_cite_open_asset_action()}
				<ExternalLinkIcon className="size-3" />
			</Link>
		</CiteCardShell>
	);
};

/** The sources of the refs the message cites, as the server resolved them. */
export const CitationsContext = createContext<StreamedCitations>({});

const AssetPill = ({
	rawAssetId,
	title,
	page,
	children,
}: {
	rawAssetId: string;
	title: string;
	page: number | undefined;
	children?: ReactNode;
}) => {
	const [hasOpened, setHasOpened] = useState(false);
	const parsedAssetId = assetIdSchema.safeParse(rawAssetId);
	const resolvedAssetId = parsedAssetId.success
		? parsedAssetId.data
		: undefined;
	const assetTitle = formatAssetTitle(title) ?? m.chat_source_fallback_title();
	const pillLabel =
		page === undefined
			? assetTitle
			: m.ai_elements_cite_pill_label_with_page({
					title: assetTitle,
					page,
				});

	return (
		<CitePill
			label={pillLabel}
			ariaLabel={m.ai_elements_cite_asset_aria_label({
				label: pillLabel,
			})}
			text={children}
			onOpenChange={(open) => {
				if (open) setHasOpened(true);
			}}
		>
			{resolvedAssetId && hasOpened ? (
				<CiteCardContent
					assetId={resolvedAssetId}
					title={assetTitle}
					page={page}
				/>
			) : (
				<CiteCardShell title={assetTitle} page={page}>
					<p className="text-muted-foreground text-xs">
						{m.ai_elements_cite_unknown_source()}
					</p>
				</CiteCardShell>
			)}
		</CitePill>
	);
};

const WebPill = ({
	url,
	title,
	children,
}: {
	url: string;
	title: string;
	children?: ReactNode;
}) => {
	const host = hostOf(url);
	const pageTitle = title || host;

	return (
		<CitePill
			label={host}
			ariaLabel={m.ai_elements_cite_web_aria_label({
				title: pageTitle,
			})}
			text={children}
		>
			<CiteCardShell title={pageTitle}>
				<p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
					<GlobeIcon className="size-3 shrink-0" />
					<span className="truncate">{host}</span>
				</p>
				<ConfirmedLink
					href={url}
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "w-full",
					})}
				>
					{m.ai_elements_cite_open_page_action()}
					<ExternalLinkIcon className="size-3" />
				</ConfirmedLink>
			</CiteCardShell>
		</CitePill>
	);
};

/** A docs page; without the docs URL known, the card names it only. */
const DocsPill = ({
	path,
	title,
	children,
}: {
	path: string;
	title: string;
	children?: ReactNode;
}) => {
	const { docsUrl } = usePublicConfig();
	const url = docsUrl && docsPageUrl(docsUrl, path);

	return (
		<CitePill
			label={title}
			ariaLabel={m.ai_elements_cite_docs_aria_label({
				title,
			})}
			text={children}
		>
			<CiteCardShell title={title}>
				{url ? (
					<>
						<p className="text-muted-foreground flex items-center gap-1.5 text-xs">
							<BookOpenIcon className="size-3 shrink-0" />
							{m.ai_elements_cite_docs_source()}
						</p>
						<ConfirmedLink
							href={url}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "w-full",
							})}
						>
							{m.ai_elements_cite_open_page_action()}
							<ExternalLinkIcon className="size-3" />
						</ConfirmedLink>
					</>
				) : null}
			</CiteCardShell>
		</CitePill>
	);
};

/**
 * A citation by ref, as `<cite ref=R>` or `<cite ref="R">`, resolved from the
 * message's citations. A ref without a source is plain text.
 */
export const CiteComponent = ({
	ref,
	children,
}: {
	/** The tag's `ref` attribute, which Streamdown passes as the `ref` prop. */
	ref?: unknown;
	children?: ReactNode;
}) => {
	const citations = use(CitationsContext);
	const citation =
		typeof ref === "string" && Object.hasOwn(citations, ref)
			? citations[ref]
			: undefined;

	switch (citation?.kind) {
		case "asset":
			return (
				<AssetPill
					rawAssetId={citation.assetId}
					title={citation.title}
					page={citation.page}
				>
					{children}
				</AssetPill>
			);
		case "web":
			// The schema checks stored URLs; this keeps a streamed one to the same rule.
			if (safeExternalUrl(citation.url)) {
				return (
					<WebPill url={citation.url} title={citation.title}>
						{children}
					</WebPill>
				);
			}
			return <>{children}</>;
		case "docs":
			// As for web: a streamed path keeps to the stored rule.
			if (docsMarkdownPath(citation.path)?.path === citation.path) {
				return (
					<DocsPill path={citation.path} title={citation.title}>
						{children}
					</DocsPill>
				);
			}
			return <>{children}</>;
		default:
			return <>{children}</>;
	}
};
