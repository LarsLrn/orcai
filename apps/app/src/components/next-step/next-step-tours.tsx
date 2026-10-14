import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type NavigationAdapter, NextStepReact, type Tour } from "nextstepjs";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { NextStepCard } from "@/components/next-step/next-step-card";
import { useSidebar } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const FEEDBACK_EMAIL = "sokratest@hochschule-rhein-waal.de";

const buildNextStepTours = (): Tour[] => [
	{
		tour: "initialTour",
		steps: [
			{
				icon: null,
				title: m.next_step_initial_welcome_title(),
				content: <>{m.next_step_initial_welcome_content()}</>,
				side: "right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_initial_sidebar_title(),
				content: <>{m.next_step_initial_sidebar_content()}</>,
				side: "right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_initial_start_chat_title(),
				content: <>{m.next_step_initial_start_chat_content()}</>,
				side: "top-right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_initial_chat_history_title(),
				content: <>{m.next_step_initial_chat_history_content()}</>,
				side: "top-left",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_initial_account_title(),
				content: <>{m.next_step_initial_account_content()}</>,
				side: "top",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_initial_complete_title(),
				content: (
					<>
						{m.next_step_initial_complete_content()}
						<br />
						<a
							className="text-accent text-sm"
							href={`mailto:${FEEDBACK_EMAIL}`}
						>
							{FEEDBACK_EMAIL}
						</a>
					</>
				),
				side: "right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
		],
	},
	// TODO: Target relevant elements in the chat interface
	{
		tour: "chatTour",
		steps: [
			{
				icon: null,
				title: m.next_step_chat_intro_title(),
				content: <>{m.next_step_chat_intro_content()}</>,
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_chat_references_title(),
				content: <>{m.next_step_chat_references_content()}</>,
				side: "bottom",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: m.next_step_chat_rating_title(),
				content: <>{m.next_step_chat_rating_content()}</>,
				side: "bottom",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
		],
	},
];

const useCustomAdapter = (): NavigationAdapter => {
	const router = useRouter();

	return {
		push: (path: string) => {
			router.navigate({
				to: path,
			});
		},
		getCurrentPath: () => {
			return router.basepath;
		},
	};
};

export const NextStepTours = ({ children }: { children: ReactNode }) => {
	const { setOpenMobile } = useSidebar();
	const { trackEvent } = useUmami();

	const { mutateAsync: setTourState } = useMutation(
		orpc.user.setTourState.mutationOptions(),
	);

	const nextStepCallbacks = {
		onStepChange: (step: number, tourName: string | null) => {
			if (step === 1 && tourName === "initialTour") {
				setOpenMobile(true);
			}
		},
		onComplete: (tourName: string | null) => {
			if (tourName === "initialTour" || tourName === "chatTour") {
				setTourState({
					tourId: tourName,
					state: "completed",
				});
				trackEvent("tour-completed", {
					tour: tourName,
				});
			}
		},
		onSkip: (_step: number, tourName: string | null) => {
			if (tourName === "initialTour" || tourName === "chatTour") {
				setTourState({
					tourId: tourName,
					state: "skipped",
				}).catch(() => {
					toast.error(m.next_step_skip_toast_error(), {
						description: m.next_step_skip_toast_error_description(),
					});
				});
				trackEvent("tour-skipped", {
					tour: tourName,
				});
			}
		},
	};

	return (
		<NextStepReact
			navigationAdapter={useCustomAdapter}
			steps={buildNextStepTours()}
			cardComponent={NextStepCard}
			{...nextStepCallbacks}
		>
			{children}
		</NextStepReact>
	);
};
