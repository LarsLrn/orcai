import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";

export type TourId = "initialTour" | "chatTour";

export type TourStep = {
	title: string;
	content: ReactNode;
};

/** Built on render so the texts follow the current locale. */
export const tourSteps = (
	tour: TourId,
	{
		feedbackEmail,
	}: {
		feedbackEmail?: string;
	},
): TourStep[] => {
	switch (tour) {
		case "initialTour":
			return [
				{
					title: m.tour_initial_welcome_title(),
					content: m.tour_initial_welcome_content(),
				},
				{
					title: m.tour_initial_sidebar_title(),
					content: m.tour_initial_sidebar_content(),
				},
				{
					title: m.tour_initial_start_chat_title(),
					content: m.tour_initial_start_chat_content(),
				},
				{
					title: m.tour_initial_chat_history_title(),
					content: m.tour_initial_chat_history_content(),
				},
				{
					title: m.tour_initial_account_title(),
					content: m.tour_initial_account_content(),
				},
				{
					title: m.tour_initial_complete_title(),
					content: (
						<>
							{m.tour_initial_complete_content()}
							{feedbackEmail && (
								<>
									{" "}
									{m.tour_initial_feedback_content()}
									<br />
									<a
										className="text-accent text-sm"
										href={`mailto:${feedbackEmail}`}
									>
										{feedbackEmail}
									</a>
								</>
							)}
						</>
					),
				},
			];
		case "chatTour":
			return [
				{
					title: m.tour_chat_intro_title(),
					content: m.tour_chat_intro_content(),
				},
				{
					title: m.tour_chat_menu_title(),
					content: m.tour_chat_menu_content(),
				},
				{
					title: m.tour_chat_references_title(),
					content: m.tour_chat_references_content(),
				},
				{
					title: m.tour_chat_rating_title(),
					content: m.tour_chat_rating_content(),
				},
			];
	}
};
