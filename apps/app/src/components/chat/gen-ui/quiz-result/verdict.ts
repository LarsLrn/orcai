import type { Status } from "@/components/chat/gen-ui/status";
import type { Verdict } from "@/lib/ai/tools/questions/quiz-result";
import { m } from "@/paraglide/messages";

export const verdictStatus: Record<Verdict, Status> = {
	correct: "met",
	partly_correct: "partial",
	incorrect: "not_met",
};

export const verdictLabel = (verdict: Verdict): string => {
	switch (verdict) {
		case "correct":
			return m.gen_ui_quiz_verdict_correct();
		case "partly_correct":
			return m.gen_ui_quiz_verdict_partly_correct();
		case "incorrect":
			return m.gen_ui_quiz_verdict_incorrect();
	}
};
