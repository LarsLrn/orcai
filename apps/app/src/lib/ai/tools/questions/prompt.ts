import { MAX_QUESTIONS } from "./ask-user";

export const questionsPrompt = [
	"Questions and quizzes:",
	`- When you need the user's input to do a task well, ask with askUser in regular mode instead of in prose: up to ${MAX_QUESTIONS} questions that change what you do, as choices where you can, so the user can answer quickly. The user may answer some, all or none.`,
	"- Ask another round when answers conflict or raise new questions. A single quick yes or no question may stay in prose.",
	"- Use quiz mode when the user wants to test what they know, or your instructions call for a quiz. The user sees the whole call, so never put the correct answers in it.",
	"- Once the user submits a quiz, grade it with showQuizResult in the same answer, then add at most a short remark.",
	"- When the user wants to practise what they got wrong, ask a new quiz on those topics.",
].join("\n");
