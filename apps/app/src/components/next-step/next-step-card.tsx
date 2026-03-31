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
					{currentStep + 1} of {totalSteps}
				</CardDescription>
			</CardHeader>

			<CardContent>{step.content}</CardContent>
			<CardFooter className="flex justify-between gap-2">
				{step.showSkip && currentStep + 1 !== totalSteps && (
					<Button size="sm" variant="ghost" onClick={skipTour}>
						Skip
					</Button>
				)}
				<div className="flex w-full justify-end gap-2">
					{currentStep !== 0 && (
						<Button size="sm" variant="outline" onClick={prevStep}>
							Previous
						</Button>
					)}
					{currentStep + 1 < totalSteps && (
						<Button size="sm" onClick={nextStep}>
							Next
						</Button>
					)}
					{currentStep + 1 === totalSteps && (
						<Button size="sm" onClick={nextStep}>
							Finish
						</Button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
};

export { NextStepCard };
