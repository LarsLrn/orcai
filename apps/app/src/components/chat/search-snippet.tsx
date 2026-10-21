import type { ChatSearchSnippet } from "@orcai/schema";

/** A search hit's surrounding text with the matched terms marked. */
const SearchSnippet = ({ snippet }: { snippet: ChatSearchSnippet }) => (
	<p className="line-clamp-2 text-muted-foreground text-xs">
		{snippet.map((segment, index) =>
			segment.highlighted ? (
				<mark
					key={index}
					className="rounded-sm bg-accent-brand/15 text-foreground"
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
