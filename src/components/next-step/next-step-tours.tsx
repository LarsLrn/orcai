import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { type NavigationAdapter, NextStepReact, type Tour } from "nextstepjs";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { NextStepCard } from "@/components/next-step/next-step-card";
import { useSidebar } from "@/components/ui/sidebar";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";

const nextStepTours: Tour[] = [
	{
		tour: "initialTour",
		steps: [
			{
				icon: null,
				title: "Welcome to OrcAI",
				content: (
					<>
						Great to have you here! Let&apos;s take a quick tour through the
						app. Click &quot;Next&quot; to proceed.
					</>
				),
				side: "right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "Sidebar",
				content: (
					<>
						The sidebar gives you quick access to your chats, workspace, and
						account settings.
					</>
				),
				side: "right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "Start a chat",
				content: (
					<>
						Use the button at the top of the sidebar to start a chat at any
						time.
					</>
				),
				side: "top-right",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "Chat history",
				content: (
					<>
						Your previous chats will appear here. To keep the list organised,
						you can delete or rename chats.
					</>
				),
				side: "top-left",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "Account",
				content: (
					<>
						You can manage your account settings, access grants and more here.
					</>
				),
				side: "top",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "You are all set!",
				content: (
					<>
						You are ready to explore the workspace. Build bots, manage content,
						or continue chats whenever you need them. The project team is also
						looking forward to your feedback on the experience.
						<br />
						<a
							className="text-accent text-sm"
							href="mailto:sokratest@hochschule-rhein-waal.de"
						>
							sokratest@hochschule-rhein-waal.de
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
				title: "Chat",
				content: (
					<>
						Now that you have received your first response, you may want to take
						a quick tour around the chat interface. Click &quot;Next&quot; to
						proceed.
					</>
				),
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "References",
				content: (
					<>
						A response usually includes references to related content that the
						bot considered particularly relevant. Since these references are
						automatically retrieved, please note that not all referenced
						material is necessarily relevant. For technical reasons, these
						references furthermore do not yet adhere to common citation
						standards. The system may cite some sources in verbatim without
						indicating so in the text. In any case, if the system references
						material, it has definitely also used that material to generate the
						response.
					</>
				),
				side: "bottom",
				showControls: true,
				showSkip: true,
				pointerPadding: 10,
				pointerRadius: 10,
			},
			{
				icon: null,
				title: "Rate responses",
				content: (
					<>
						Please assess each response you receive by using the buttons below.
						This will help to improve the bot, while it will not have a direct
						impact on your current chat.
					</>
				),
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
				toast.promise(
					setTourState({
						tourId: tourName,
						state: "skipped",
					}),
					{
						loading: "Skipping tour...",
						success: "Tour skipped",
						error: "Failed to skip tour",
					},
				);
				trackEvent("tour-skipped", {
					tour: tourName,
				});
			}
		},
	};

	return (
		<NextStepReact
			navigationAdapter={useCustomAdapter}
			steps={nextStepTours}
			cardComponent={NextStepCard}
			{...nextStepCallbacks}
		>
			{children}
		</NextStepReact>
	);
};
