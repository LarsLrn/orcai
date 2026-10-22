import { MessageCircleQuestionMarkIcon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { m } from "@/paraglide/messages";

/** The frame of a round of questions: heading and progress, the body, then the actions. */
export const QuestionsCard = ({
	title,
	progress,
	status,
	footer,
	children,
}: {
	title: string | undefined;
	progress?: string;
	/** Shown at the end of the header, such as a badge. */
	status?: ReactNode;
	footer?: ReactNode;
	children: ReactNode;
}) => {
	const titleId = useId();

	return (
		<section
			aria-labelledby={titleId}
			className="not-prose overflow-hidden rounded-xl border bg-card"
		>
			<header className="flex items-center gap-3 border-b px-4 py-3">
				<MessageCircleQuestionMarkIcon
					aria-hidden
					className="size-4 shrink-0 text-muted-foreground"
				/>
				<div className="min-w-0 flex-1">
					<h3 id={titleId} className="font-medium text-sm">
						{title ?? m.questions_card_title()}
					</h3>
					{progress && (
						<p className="text-muted-foreground text-xs">{progress}</p>
					)}
				</div>
				{status}
			</header>
			<div className="px-4 py-3">{children}</div>
			{footer && (
				<footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
					{footer}
				</footer>
			)}
		</section>
	);
};
