import { ExternalLinkIcon } from "lucide-react";
import { usePublicConfig } from "@/hooks/use-public-config";
import { m } from "@/paraglide/messages";

/** Points to the docs page on writing a behaviour, where the instance links its docs. */
const BehaviourDocsLink = () => {
	const { docsUrl } = usePublicConfig();

	if (!docsUrl) {
		return null;
	}

	return (
		<a
			href={`${docsUrl.replace(/\/$/, "")}/docs/using-orcai/behaviours`}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
		>
			{m.authoring_behaviour_docs_link()}
			<ExternalLinkIcon className="size-3" />
		</a>
	);
};

export { BehaviourDocsLink };
