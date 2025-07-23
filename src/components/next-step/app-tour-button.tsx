import { Slot } from "@radix-ui/react-slot";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { useNextStep } from "nextstepjs";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { userQueryOptions } from "@/lib/query-options/user";
import { cn } from "@/lib/utils";

const AppTourButton = ({
	tour,
	autoTrigger = false,
	className,
	variant,
	size,
	asChild = false,
	...props
}: {
	tour: "initialTour" | "chatTour";
	autoTrigger?: boolean;
} & React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) => {
	const { auth } = useRouteContext({ from: "/app" });
	const { startNextStep } = useNextStep();
	const { data: userPrefs, status } = useQuery(
		userQueryOptions.find({
			input: { id: auth.user.id },
		}),
	);

	const isTourCompleted =
		status === "success" &&
		(userPrefs.data.preferences?.tours?.[tour] === "completed" ||
			userPrefs.data.preferences?.tours?.[tour] === "skipped");

	const handleStartTour = () => {
		startNextStep(tour);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <Dependency for startNextStep not needed>
	useEffect(() => {
		if (status !== "success" || isTourCompleted) return;
		if (autoTrigger) {
			startNextStep(tour);
		}
	}, [autoTrigger, isTourCompleted, status]);

	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			onClick={handleStartTour}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
};

export { AppTourButton };
