import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { useNextStep } from "nextstepjs";
import { useEffect } from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";

const AppTourButton = ({
	tour,
	autoTrigger = false,
	label,
	className,
	variant,
	size,
	children,
	...props
}: {
	tour: "initialTour" | "chatTour";
	autoTrigger?: boolean;
	label?: string;
} & ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants>) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { startNextStep } = useNextStep();
	const { data: userPrefs, status } = useQuery(
		orpc.user.find.queryOptions({
			input: {
				id: auth.user.id,
			},
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
	}, [
		autoTrigger,
		isTourCompleted,
		status,
	]);

	const showLabel = !!label && status === "success" && !isTourCompleted;

	return (
		<Button
			onClick={handleStartTour}
			data-slot="button"
			variant={variant}
			size={showLabel ? size : size === "sm" ? "icon-sm" : size}
			className={className}
			{...props}
		>
			{children}
			{showLabel && <span>{label}</span>}
		</Button>
	);
};

export { AppTourButton };
