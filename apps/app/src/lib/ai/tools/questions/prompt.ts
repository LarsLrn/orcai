import { MAX_QUESTIONS } from "./ask-user";

export const questionsPrompt = [
	"Questions and quizzes:",
	`- When you need the user's input to do a task well, ask with askUser in regular mode rather than in prose: up to ${MAX_QUESTIONS} questions that change what you do, as choices where you can, so the user can answer quickly. A single yes or no question may stay in prose.`,
	"- Ask another round when the answers conflict or raise new questions.",
	"- Use quiz mode when the user wants to test what they know, or your instructions call for a quiz. When the user wants to practise what they got wrong, ask a new quiz on those topics.",
].join("\n");
