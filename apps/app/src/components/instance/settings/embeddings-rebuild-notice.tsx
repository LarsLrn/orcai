import { RefreshCwIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEmbeddingsRebuilding } from "@/hooks/use-embeddings-configured";
import { m } from "@/paraglide/messages";

/** Says that search finds only some assets while every one is embedded again. */
export const EmbeddingsRebuildAlert = ({
	className,
}: {
	className?: string;
}) => (
	<Alert className={className}>
		<RefreshCwIcon />
		<AlertTitle>{m.embeddings_rebuild_notice_title()}</AlertTitle>
		<AlertDescription>
			{m.embeddings_rebuild_notice_description()}
		</AlertDescription>
	</Alert>
);

/** The alert while files are being re-embedded. */
export const EmbeddingsRebuildNotice = ({
	className,
}: {
	className?: string;
}) =>
	useEmbeddingsRebuilding() ? (
		<EmbeddingsRebuildAlert className={className} />
	) : null;

/** The same, in a chat that searches repositories. */
export const ChatEmbeddingsRebuildNotice = ({
	repositoryIds,
}: {
	repositoryIds: readonly string[];
}) => {
	const rebuilding = useEmbeddingsRebuilding();
	if (!rebuilding || repositoryIds.length === 0) return null;

	return (
		<div
			role="status"
			className="flex items-start gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-sm"
		>
			<RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-foreground" />
			<p className="text-foreground">
				{m.embeddings_rebuild_notice_description()}
			</p>
		</div>
	);
};
