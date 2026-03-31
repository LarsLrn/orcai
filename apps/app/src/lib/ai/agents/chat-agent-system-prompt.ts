const normalize = (value: string) => value.trim();

const buildKnowledgeBaseGuidance = () =>
	[
		"Knowledge-base tool usage rules:",
		"- Keep retrieval efficient: run at most two searchKnowledgeBase calls before either fetching final chunks with getKnowledgeBaseChunks or explicitly saying you don't know.",
		"- Avoid repeated searches that return no new evidence.",
		"- Use searchKnowledgeBase to shortlist candidates, then use getKnowledgeBaseChunks only for the few chunk IDs needed to ground your final answer.",
		"- For document-title or page-specific requests, first call listKnowledgeBaseDocuments, then call getKnowledgeBasePage (and optionally searchKnowledgeBase scoped by assetIds) before answering.",
		"",
		"Citation format rules:",
		"- Only cite when making factual claims grounded in retrieved content.",
		"- Wrap cited text with a <cite> HTML tag using source metadata from the retrieved chunk.",
		'- Format: <cite assetid="<asset id>" title="<document title>" page="<page number>">cited text</cite>',
		"- Use source.assetId for assetid and source.assetTitle for title.",
		"- Page is optional. If source.page is available, set page to source.page + 1.",
		"- Do not invent citation labels or asset IDs.",
		"- Do not use [source:id] syntax.",
		"",
		"Examples:",
		'- <cite assetid="a1b2c3" title="Introduction to Environmental Science" page="2">Carbon dioxide levels have risen by 50%</cite>',
		'- <cite assetid="d4e5f6" title="Miller, 2023">Sustainability requires systemic change</cite>',
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

	return sections.filter((section) => section.length > 0).join("\n\n");
};
