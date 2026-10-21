import type { RefObject } from "react";
import type { TourStep } from "@/components/tour/tours";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { m } from "@/paraglide/messages";

const TourCard = ({
	step,
	index,
	total,
	primaryRef,
	onNext,
	onPrevious,
	onSkip,
}: {
	step: TourStep;
	index: number;
	total: number;
	primaryRef: RefObject<HTMLButtonElement | null>;
	onNext: () => void;
	onPrevious: () => void;
	onSkip: () => void;
}) => {
	const isLast = index + 1 === total;

	return (
		<Card className="w-xs">
			<CardHeader>
				<DialogTitle>{step.title}</DialogTitle>
				<CardDescription>
					{m.tour_card_progress({
						current: index + 1,
						total,
					})}
				</CardDescription>
			</CardHeader>

			<CardContent>
				<DialogDescription className="text-card-foreground">
					{step.content}
				</DialogDescription>
			</CardContent>
			<CardFooter className="flex justify-between gap-2">
				{!isLast && (
					<Button size="sm" variant="ghost" onClick={onSkip}>
						{m.tour_card_skip_button()}
					</Button>
				)}
				<div className="flex w-full justify-end gap-2">
					{index !== 0 && (
						<Button size="sm" variant="outline" onClick={onPrevious}>
							{m.tour_card_previous_button()}
						</Button>
					)}
					<Button ref={primaryRef} size="sm" onClick={onNext}>
						{isLast ? m.tour_card_finish_button() : m.common_next_button()}
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
};

export { TourCard };
