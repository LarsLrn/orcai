import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import { useAutoStartTour, useTour } from "@/components/tour/tour-provider";
import type { TourId } from "@/components/tour/tours";
import { Button, type buttonVariants } from "@/components/ui/button";

/** Starts a tour on click, and on mount with `autoTrigger` until the user has seen it. */
const TourButton = ({
	tour,
	autoTrigger = false,
	label,
	className,
	variant,
	size,
	children,
	...props
}: {
	tour: TourId;
	autoTrigger?: boolean;
	label?: string;
} & ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants>) => {
	const { seen, start } = useTour(tour);
	useAutoStartTour(tour, autoTrigger);

	const showLabel = !!label && seen === false;

	return (
		<Button
			onClick={start}
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

export { TourButton };
