import { useRouteContext } from "@tanstack/react-router";
import { CompassIcon } from "lucide-react";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { AboutModal } from "./about-modal";

const UserWelcome = () => {
	const { auth } = useRouteContext({ from: "/app" });

	const getTimeBasedGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return m.acidic_last_llama_peek();
		if (hour < 18) return m.awful_salty_tern_cut();
		return m.yummy_watery_hawk_grin();
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
				<h1 className="font-bold text-3xl tracking-tight">
					{getTimeBasedGreeting()}, {auth.user.name?.split(" ")[0]}!
				</h1>
				<div className="flex items-center gap-2">
					<AppTourButton
						variant="outline"
						size="sm"
						className="right-0 size-8"
						tour="initialTour"
						autoTrigger={true}
					>
						<CompassIcon className="text-foreground" />
					</AppTourButton>
					<AboutModal>
						<Button size="sm" variant="outline">
							{m.fluffy_short_halibut_enchant()}
						</Button>
					</AboutModal>
				</div>
			</div>
			<p className="text-muted-foreground">{m.only_pink_meerkat_relish()}</p>
		</div>
	);
};

export { UserWelcome };
