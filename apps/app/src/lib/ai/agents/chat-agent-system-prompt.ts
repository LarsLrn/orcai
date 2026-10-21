const normalize = (value: string) => value.trim();

const buildKnowledgeBaseGuidance = () =>
	[
		"Knowledge-base retrieval workflow:",
		"- Use searchKnowledgeBase for topical, entity, quote, or claim-based retrieval when you do not yet know the exact document or chunk.",
		"- Use listKnowledgeBaseDocuments when the user names or implies a document title, or when you need asset IDs before page-specific lookup.",
		"- Use getKnowledgeBasePage for explicit page requests. Prefer passing assetId when you know the document. If you only know the title, first resolve it with listKnowledgeBaseDocuments.",
		"- searchKnowledgeBase returns the full text of the best matching chunks; answer from them directly.",
		"- Use getKnowledgeBaseChunks only when you need the text around a chunk, such as the rest of a list or an argument.",
		"- Prefer one focused search first. A second search is fine if the first is clearly incomplete. Avoid search loops that add no new evidence.",
		"- If a tool returns no relevant evidence, say you do not know rather than guessing.",
		"",
		"Citation rules:",
		"- If your final answer uses knowledge-base evidence, citations are required.",
		"- Every substantive factual claim grounded in retrieved content should have an inline citation on the supporting sentence or clause. Do not leave all citations to the end.",
		"- The only supported citation syntax is an inline HTML <cite> tag. Do not use markdown footnotes, bracketed references, or a separate Sources section.",
		'- Each passage starts with its ref in brackets, such as [k7f3a2]. Cite it as <cite chunk="k7f3a2">cited text</cite>.',
		"- Use only refs from retrieved passages. Do not invent refs, and do not cite facts that were not retrieved from the knowledge base.",
		"",
		"Example:",
		'- <cite chunk="k7f3a2">Carbon dioxide levels have risen by 50%</cite>',
	].join("\n");

export const buildFormattingGuidance = () =>
	[
		"Message formatting and styling:",
		"- You can use standard Markdown plus GitHub Flavored Markdown features: headings, emphasis, lists, blockquotes, tables, task lists, and strikethrough.",
		"- For code, use fenced code blocks with a language identifier when possible (for syntax highlighting).",
		"- For Mermaid diagrams, use a fenced mermaid block exactly like: ```mermaid ... ```.",
		"- Style Mermaid diagrams lightly: a few classDef styles in 2-4 colors with readable labels, and direction and subgraphs for layout.",
		'- Mermaid labels with special characters (especially |) should be quoted inside nodes, for example: A["Receive Determinant |Σ|"].',
		"- For math, use $$ delimiters for every expression. The $...$ inline form is not enabled.",
		"- Multiline math should be written as a block with opening $$ on its own line and closing $$ on its own line.",
		"- Prefer valid, closed Markdown structures (for example, close code fences and tables cleanly) for best streaming render quality.",
		"- Raw HTML may be sanitized. Only use custom HTML tags when explicitly required by instructions (for example, citation tags).",
	].join("\n");

export const buildChatAgentSystemPrompt = ({
	systemPrompt,
	hasKnowledgeBaseBlocks,
	featurePrompts,
}: {
	systemPrompt: string;
	hasKnowledgeBaseBlocks: boolean;
	/** Prompt fragments of the features enabled this turn. */
	featurePrompts: readonly string[];
}) => {
	const sections = [
		normalize(systemPrompt),
	];

	if (hasKnowledgeBaseBlocks) {
		sections.push(buildKnowledgeBaseGuidance());
	}

	sections.push(...featurePrompts.map(normalize));

	sections.push(buildFormattingGuidance());

	return sections.filter((section) => section.length > 0).join("\n\n");
};
