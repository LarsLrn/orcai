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
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import type { AssetMetadataType } from "@/lib/orpc/schemas/fragments/asset-metadata";
import { sourceTypeLabels } from "@/lib/orpc/schemas/fragments/asset-metadata";

const CiteCardContent = ({ assetId }: { assetId: string }) => {
	const { data, isLoading, isError } = useQuery(
		orpc.asset.find.queryOptions({
			input: {
				id: assetId,
			},
		}),
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-4">
				<Spinner className="size-5" />
			</div>
		);
	}

	if (isError || !data?.data) {
		return (
			<div className="p-3 text-muted-foreground text-sm">
				Could not load source details.
			</div>
		);
	}

	const asset = data.data;
	const metadata = asset.metadata as AssetMetadataType | null;
	const sourceType = metadata?.sourceType;
	const typeLabel = sourceType ? sourceTypeLabels[sourceType] : null;

	return (
		<div className="space-y-2 p-3">
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<h4 className="font-medium text-sm leading-tight">{asset.title}</h4>
					{metadata?.author && (
						<p className="mt-0.5 text-muted-foreground text-xs">
							{metadata.author}
						</p>
					)}
				</div>
			</div>

			{(typeLabel || metadata?.citation) && (
				<div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
					{typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
					{metadata?.citation && (
						<span className="italic">{metadata.citation}</span>
					)}
				</div>
			)}

			{metadata?.pageRange && (
				<p className="text-muted-foreground text-xs">
					Pages {metadata.pageRange}
				</p>
			)}

			{metadata?.doi && (
				<p className="truncate text-muted-foreground text-xs">
					DOI: {metadata.doi}
				</p>
			)}

			<div className="flex items-center gap-2 border-t pt-2">
				<Link
					className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
					to="/app/hub/assets/$assetId"
					params={{
						assetId,
					}}
				>
					Open asset
					<ExternalLinkIcon className="size-3" />
				</Link>
			</div>
		</div>
	);
};

export const CiteComponent = ({
	assetid,
	title,
	page,
	children,
}: {
	assetid?: string;
	title?: string;
	page?: string;
	children?: ReactNode;
}) => {
	const [hasOpened, setHasOpened] = useState(false);
	const pageNumber = parsePageNumber(page);
	const triggerLabel =
		pageNumber == null
			? (title ?? "Source")
			: `${title ?? "Source"} (p. ${pageNumber})`;

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
				<InlineCitationCardTrigger label={triggerLabel} sources={[]} />
				<InlineCitationCardBody>
					{assetid && hasOpened ? (
						<CiteCardContent assetId={assetid} />
					) : (
						<div className="p-3 text-muted-foreground text-sm">
							{triggerLabel}
						</div>
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
