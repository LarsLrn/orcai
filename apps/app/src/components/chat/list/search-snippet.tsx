import type { ChatSearchSnippet } from "@orcai/schema";

/** A search hit's surrounding text with the matched terms marked. */
const SearchSnippet = ({ snippet }: { snippet: ChatSearchSnippet }) => (
	<p className="text-muted-foreground line-clamp-2 text-xs">
		{snippet.map((segment, index) =>
			segment.highlighted ? (
				<mark
					key={index}
					className="bg-accent-brand/15 text-foreground rounded-sm"
				>
					{segment.text}
				</mark>
			) : (
				segment.text
			),
		)}
	</p>
);

export { SearchSnippet };
