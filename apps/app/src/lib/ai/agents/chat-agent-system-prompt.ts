const normalize = (value: string) => value.trim();

const buildKnowledgeBaseGuidance = () =>
	[
		"Knowledge-base retrieval workflow:",
		"- Use searchKnowledgeBase for topical, entity, quote, or claim-based retrieval when you do not yet know the exact document or chunk.",
		"- Use listKnowledgeBaseDocuments when the user names or implies a document title, or when you need asset IDs before page-specific lookup.",
		"- Use getKnowledgeBasePage for explicit page requests. Prefer passing assetId when you know the document. If you only know the title, first resolve it with listKnowledgeBaseDocuments.",
		"- Use getKnowledgeBaseChunks after searchKnowledgeBase when you need the full chunk text for exact evidence.",
		"- searchKnowledgeBase returns short snippets only. Do not rely on snippets alone for a final factual answer when you can fetch the full chunk text.",
		"- getKnowledgeBaseChunks and getKnowledgeBasePage return full chunk text and can be used directly for grounded answers.",
		"- Prefer one focused search first. A second search is fine if the first is clearly incomplete. Avoid search loops that add no new evidence.",
		"- If a tool returns no relevant evidence, say you do not know rather than guessing.",
		"",
		"Citation rules:",
		"- If your final answer uses knowledge-base evidence, citations are required.",
		"- Every substantive factual claim grounded in retrieved content should have an inline citation on the supporting sentence or clause. Do not leave all citations to the end.",
		"- The only supported citation syntax is an inline HTML <cite> tag. Do not use markdown footnotes, bracketed references, or a separate Sources section.",
		"- Prefer the exact markup provided by source.citation.example or source.citation.openTag from the retrieved tool result.",
		'- Required shape: <cite assetid="<asset id>" title="<document title>" page="<page number>">cited text</cite>',
		"- Use the attribute name assetid exactly in lowercase.",
		"- Use source.citation.assetId for assetid and source.citation.title for title.",
		"- If source.citation.page is present, include page. Otherwise omit the page attribute entirely.",
		"- source.document.totalPages is the total page count of the document, not the page span of the chunk.",
		"- Do not invent citation labels, asset IDs, or page numbers.",
		"- Do not cite facts that were not retrieved from the knowledge base.",
		"",
		"Examples:",
		'- <cite assetid="a1b2c3" title="Introduction to Environmental Science" page="2">Carbon dioxide levels have risen by 50%</cite>',
		'- <cite assetid="d4e5f6" title="Miller, 2023">Sustainability requires systemic change</cite>',
	].join("\n");

const buildFormattingGuidance = () =>
	[
		"Message formatting and styling:",
		"- You can use standard Markdown plus GitHub Flavored Markdown features: headings, emphasis, lists, blockquotes, tables, task lists, and strikethrough.",
		"- For code, use fenced code blocks with a language identifier when possible (for syntax highlighting).",
		"- For Mermaid diagrams, use a fenced mermaid block exactly like: ```mermaid ... ```.",
		"- Mermaid diagrams should include light styling by default: define a small set of classDef styles, apply classes to key node types, and keep visual hierarchy clear.",
		"- Prefer restrained design in Mermaid: 2-4 coordinated colors, strong contrast for labels, and avoid excessive gradients, decorations, or too many distinct styles.",
		"- Use layout intentionally in Mermaid (for example, direction, subgraph grouping, and concise labels) to improve readability before adding extra styling.",
		'- Mermaid labels with special characters (especially |) should be quoted inside nodes, for example: A["Receive Determinant |Σ|"].',
		"- For math, use $$ delimiters for every expression. The $...$ inline form is not enabled.",
		"- Multiline math should be written as a block with opening $$ on its own line and closing $$ on its own line.",
		"- Prefer valid, closed Markdown structures (for example, close code fences and tables cleanly) for best streaming render quality.",
		"- Raw HTML may be sanitized. Only use custom HTML tags when explicitly required by instructions (for example, citation tags).",
	].join("\n");

export const buildChatAgentSystemPrompt = ({
	systemPrompt,
	hasKnowledgeBaseBlocks,
}: {
	systemPrompt: string;
	hasKnowledgeBaseBlocks: boolean;
}) => {
	const sections = [
		normalize(systemPrompt),
	];

	if (hasKnowledgeBaseBlocks) {
		sections.push(buildKnowledgeBaseGuidance());
	}

	sections.push(buildFormattingGuidance());

	return sections.filter((section) => section.length > 0).join("\n\n");
};
