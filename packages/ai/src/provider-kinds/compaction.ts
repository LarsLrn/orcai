/** What the summarizer keeps, natively and in our own summary. */
export const COMPACTION_INSTRUCTIONS = [
	"Summarize the conversation so far, so that the work can continue from the summary alone. Do not call tools.",
	"Keep the user's goals and requests, the decisions made and why, the current plan with its open tasks, what was being worked on last, and the names, ids, numbers and other specifics the remaining work needs.",
	"Leave out greetings and details that later messages superseded. Write in the language of the conversation.",
].join("\n");
