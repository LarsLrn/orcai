import type { AssetId } from "@orcai/core";
import type { AssetMetadataType } from "@orcai/schema";
import { assetIdSchema, sourceTypeLabels } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import {
	InlineCitation,
	InlineCitationCard,
	InlineCitationCardBody,
	InlineCitationCardTrigger,
	InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { StreamedCitations } from "@/lib/ai/citations/chat-sources";
import { orpc } from "@/lib/orpc/orpc";
import { formatAssetTitle } from "@/lib/presentation/asset-title";
import { m } from "@/paraglide/messages";

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
		<h4 className="font-medium text-sm leading-snug">{title}</h4>
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
				<p className="flex items-center gap-2 text-muted-foreground text-xs">
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
			{metadata?.citation && (
				<p className="text-muted-foreground text-xs italic">
					{metadata.citation}
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
		<InlineCitation>
			<InlineCitationText className="group-hover:bg-transparent">
				{children}
			</InlineCitationText>
			<InlineCitationCard
				onOpenChange={(open) => {
					if (open) setHasOpened(true);
				}}
			>
				<InlineCitationCardTrigger
					label={pillLabel}
					aria-label={m.ai_elements_cite_asset_aria_label({
						label: pillLabel,
					})}
					sources={[]}
					className="border-transparent bg-accent-brand/10 font-medium text-accent-brand text-xs transition-colors duration-150 hover:bg-accent-brand/20"
				/>
				<InlineCitationCardBody>
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
				</InlineCitationCardBody>
			</InlineCitationCard>
		</InlineCitation>
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
		default:
			return <>{children}</>;
	}
};
