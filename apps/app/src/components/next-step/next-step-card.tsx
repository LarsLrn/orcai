import type { CardComponentProps } from "nextstepjs";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages";

const NextStepCard = ({
	step,
	currentStep,
	totalSteps,
	nextStep,
	prevStep,
	skipTour,
}: CardComponentProps) => {
	return (
		<Card className="w-xs">
			<CardHeader>
				<CardTitle>
					{step.icon} {step.title}
				</CardTitle>
				<CardDescription>
					{m.next_step_card_progress({
						current: currentStep + 1,
						total: totalSteps,
					})}
				</CardDescription>
			</CardHeader>

			<CardContent>{step.content}</CardContent>
			<CardFooter className="flex justify-between gap-2">
				{step.showSkip && currentStep + 1 !== totalSteps && (
					<Button size="sm" variant="ghost" onClick={skipTour}>
						{m.next_step_card_skip_button()}
					</Button>
				)}
				<div className="flex w-full justify-end gap-2">
					{currentStep !== 0 && (
						<Button size="sm" variant="outline" onClick={prevStep}>
							{m.next_step_card_previous_button()}
						</Button>
					)}
					{currentStep + 1 < totalSteps && (
						<Button size="sm" onClick={nextStep}>
							{m.common_next_button()}
						</Button>
					)}
					{currentStep + 1 === totalSteps && (
						<Button size="sm" onClick={nextStep}>
							{m.next_step_card_finish_button()}
						</Button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
};

export { NextStepCard };
