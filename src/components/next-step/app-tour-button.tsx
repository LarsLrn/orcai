import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { useNextStep } from "nextstepjs";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

const AppTourButton = ({
	tour,
	autoTrigger = false,
	className,
	variant,
	size,
	...props
}: {
	tour: "initialTour" | "chatTour";
	autoTrigger?: boolean;
} & ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants>) => {
	const { auth } = useRouteContext({ from: "/app" });
	const { startNextStep } = useNextStep();
	const { data: userPrefs, status } = useQuery(
		orpc.user.find.queryOptions({
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: Dependency for startNextStep not needed
	useEffect(() => {
		if (status !== "success" || isTourCompleted) return;
		if (autoTrigger) {
			startNextStep(tour);
		}
	}, [autoTrigger, isTourCompleted, status]);

	return (
		<Button
			onClick={handleStartTour}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
};

export { AppTourButton };
