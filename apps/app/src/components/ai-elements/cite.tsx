import type { AssetId } from "@orcai/core";
import type { AssetMetadataType } from "@orcai/schema";
import { assetIdSchema, sourceTypeLabels } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
	InlineCitation,
	InlineCitationCard,
	InlineCitationCardBody,
	InlineCitationCardTrigger,
	InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import { formatAssetTitle } from "@/components/chat/message/asset-title";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";

const CiteCardShell = ({
	title,
	page,
	children,
}: {
	title: string;
	page?: number | null;
	children: ReactNode;
}) => (
	<div className="space-y-3 p-4">
		<h4 className="font-medium text-sm leading-snug">{title}</h4>
		{children}
		{page == null ? null : (
			<p className="text-muted-foreground text-xs">Page {page}</p>
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
	page?: number | null;
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
					Loading the source details
				</p>
			</CiteCardShell>
		);
	}

	if (isError || !data?.data) {
		return (
			<CiteCardShell title={title} page={page}>
				<p className="text-muted-foreground text-xs">
					The source details could not be loaded.
				</p>
			</CiteCardShell>
		);
	}

	const asset = data.data;
	const metadata = asset.metadata as AssetMetadataType | null;
	const sourceType = metadata?.sourceType;
	const typeLabel = sourceType ? sourceTypeLabels[sourceType] : null;

	return (
		<CiteCardShell title={formatAssetTitle(asset.title)} page={page}>
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
				to="/app/hub/assets/$assetId"
				params={{
					assetId,
				}}
			>
				Open asset
				<ExternalLinkIcon className="size-3" />
			</Link>
		</CiteCardShell>
	);
};

export const CiteComponent = ({
	assetid,
	assetId,
	asset_id,
	title,
	page,
	pageNumber,
	page_number,
	children,
}: {
	assetid?: string;
	assetId?: string;
	asset_id?: string;
	title?: string;
	page?: string;
	pageNumber?: string;
	page_number?: string;
	children?: ReactNode;
}) => {
	const [hasOpened, setHasOpened] = useState(false);
	const resolvedAssetId = (() => {
		const raw = assetid ?? assetId ?? asset_id;
		const result = assetIdSchema.safeParse(raw);
		return result.success ? result.data : undefined;
	})();
	const resolvedPage = parsePageNumber(page ?? pageNumber ?? page_number);
	const assetTitle = formatAssetTitle(title);
	const pillLabel =
		resolvedPage == null ? assetTitle : `${assetTitle} · p. ${resolvedPage}`;

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
					sources={[]}
					className="border-transparent bg-accent-brand/10 font-medium text-accent-brand text-xs transition-colors duration-150 hover:bg-accent-brand/20"
				/>
				<InlineCitationCardBody>
					{resolvedAssetId && hasOpened ? (
						<CiteCardContent
							assetId={resolvedAssetId}
							title={assetTitle}
							page={resolvedPage}
						/>
					) : (
						<CiteCardShell title={assetTitle} page={resolvedPage}>
							<p className="text-muted-foreground text-xs">
								This citation does not name a source in the library.
							</p>
						</CiteCardShell>
					)}
				</InlineCitationCardBody>
			</InlineCitationCard>
		</InlineCitation>
	);
};

const parsePageNumber = (page?: string) => {
	if (!page) {
		return null;
	}

	const parsed = Number.parseInt(page, 10);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return null;
	}

	return parsed;
};
