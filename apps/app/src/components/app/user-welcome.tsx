import { useRouteContext } from "@tanstack/react-router";
import { CompassIcon, ExternalLinkIcon } from "lucide-react";
import { AppTourButton } from "@/components/next-step/app-tour-button";
import { buttonVariants } from "@/components/ui/button";
import { clientEnv } from "@/lib/env/client";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const getTimeBasedGreeting = () => {
	const hour = new Date().getHours();
	if (hour < 12) return m.acidic_last_llama_peek();
	if (hour < 18) return m.awful_salty_tern_cut();
	return m.yummy_watery_hawk_grin();
};

const UserWelcome = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});

	return (
		<div className="space-y-2">
			<div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
				<h1 className="font-semibold text-2xl tracking-tight">
					{getTimeBasedGreeting()}, {auth.user.name?.split(" ")[0]}!
				</h1>
				<div className="flex items-center justify-end gap-1">
					<AppTourButton
						variant="ghost"
						size="sm"
						tour="initialTour"
						autoTrigger={true}
						label="Take a tour"
						aria-label="Take a tour of OrcAI"
					>
						<CompassIcon className="text-foreground" />
					</AppTourButton>
					{clientEnv.VITE_WEB_URL && (
						<a
							href={clientEnv.VITE_WEB_URL}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								buttonVariants({
									variant: "ghost",
									size: "sm",
								}),
							)}
						>
							About OrcAI
							<ExternalLinkIcon className="size-3.5" />
						</a>
					)}
				</div>
			</div>
			<p className="text-muted-foreground">{m.only_pink_meerkat_relish()}</p>
		</div>
	);
};

export { UserWelcome };
