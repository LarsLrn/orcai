import { useHydrated, useRouteContext } from "@tanstack/react-router";
import { CompassIcon, ExternalLinkIcon } from "lucide-react";
import { TourButton } from "@/components/tour/tour-button";
import { buttonVariants } from "@/components/ui/button";
import { usePublicConfig } from "@/hooks/use-public-config";
import { m } from "@/paraglide/messages";

const timeOfDay = () => {
	const hour = new Date().getHours();
	if (hour < 12) return "morning";
	if (hour < 18) return "afternoon";
	return "evening";
};

/** The greeting, with the tour and the docs link beside it. */
const UserWelcome = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	// The server does not know the browser's timezone, so it renders a neutral greeting.
	const hydrated = useHydrated();
	const greetingTime = hydrated ? timeOfDay() : "unknown";
	const { docsUrl } = usePublicConfig();

	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
			<h1 className="font-heading font-semibold text-3xl tracking-tight">
				{m.home_welcome_heading({
					timeOfDay: greetingTime,
					name: auth.user.name?.split(" ")[0] ?? "",
				})}
			</h1>
			<div className="-ms-3 flex items-center gap-1 sm:ms-0 sm:-me-3">
				<TourButton
					variant="ghost"
					size="sm"
					tour="initialTour"
					autoTrigger={true}
					label={m.home_tour_button_label()}
					aria-label={m.home_tour_button_aria_label()}
				>
					<CompassIcon className="text-foreground" />
				</TourButton>
				{docsUrl && (
					<a
						href={docsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={buttonVariants({
							variant: "ghost",
							size: "sm",
						})}
					>
						{m.home_about_link()}
						<ExternalLinkIcon className="size-3.5" />
					</a>
				)}
			</div>
		</div>
	);
};

export { UserWelcome };
