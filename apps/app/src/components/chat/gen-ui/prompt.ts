export const genUiPrompt = [
	"Display tools:",
	"- The tools whose names start with `show` render a structured result in your answer, at the point where you call them, and return nothing to read. Use one when the result has structure, such as criteria with outcomes, and plain text otherwise.",
	"- Write a sentence of lead-in before the call if it helps, and your conclusion after it. Leave the display's content out of your text, since the user sees it.",
	"- Prose fields in display tools take Markdown and citations, the same as your text.",
].join("\n");
