import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { TourCard } from "@/components/tour/tour-card";
import { type TourId, tourSteps } from "@/components/tour/tours";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUmami } from "@/hooks/use-umami";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type TourState = {
	tour: TourId;
	step: number;
	open: boolean;
};

const TourContext = createContext<{
	start: (tour: TourId) => void;
	ended: ReadonlySet<TourId>;
} | null>(null);

/**
 * `seen` is true once the user has completed or skipped the tour, here or
 * earlier, and undefined while their preferences load. `start` shows it as a
 * modal card until finished or skipped.
 */
export const useTour = (tour: TourId) => {
	const context = useContext(TourContext);
	if (!context) {
		throw new Error("useTour must be used within <TourProvider>");
	}
	const { start, ended } = context;
	const { data, status } = useQuery(
		orpc.user.me.queryOptions({
			input: {},
		}),
	);

	// A tour ended in this session wins over preferences cached before it ended.
	const stored = data?.data.preferences?.tours?.[tour];
	const seen = ended.has(tour)
		? true
		: status === "success"
			? stored === "completed" || stored === "skipped"
			: undefined;

	const startTour = useCallback(
		() => start(tour),
		[
			start,
			tour,
		],
	);

	return {
		seen,
		start: startTour,
	};
};

/**
 * Runs one tour at a time. Finishing persists "completed", Skip and Escape
 * persist "skipped"; either way the tour does not start on its own again.
 */
export const TourProvider = ({ children }: { children: ReactNode }) => {
	const [state, setState] = useState<TourState | null>(null);
	const [ended, setEnded] = useState<ReadonlySet<TourId>>(new Set());
	const primaryRef = useRef<HTMLButtonElement>(null);
	const { trackEvent } = useUmami();
	const { mutate: setTourState } = useMutation(
		orpc.user.setTourState.mutationOptions(),
	);

	const start = useCallback((tour: TourId) => {
		setState({
			tour,
			step: 0,
			open: true,
		});
	}, []);

	const steps = state ? tourSteps(state.tour) : [];
	const step = state ? steps[state.step] : undefined;

	const goTo = (index: number) => {
		if (!state) return;
		setState({
			...state,
			step: index,
		});
	};

	const finish = (outcome: "completed" | "skipped") => {
		if (!state?.open) return;
		const { tour } = state;
		setState({
			...state,
			open: false,
		});
		setEnded(new Set(ended).add(tour));
		trackEvent(outcome === "completed" ? "tour-completed" : "tour-skipped", {
			tour,
		});
		setTourState(
			{
				tourId: tour,
				state: outcome,
			},
			{
				onError: () => {
					if (outcome !== "skipped") return;
					toast.error(m.tour_skip_toast_error(), {
						description: m.tour_skip_toast_error_description(),
					});
				},
			},
		);
	};

	return (
		<TourContext
			value={{
				start,
				ended,
			}}
		>
			{children}
			<Dialog
				open={state?.open ?? false}
				onOpenChange={(open) => {
					if (!open) finish("skipped");
				}}
				disablePointerDismissal
			>
				<DialogContent
					showCloseButton={false}
					initialFocus={primaryRef}
					className="w-auto bg-transparent p-0 shadow-none ring-0"
				>
					{state && step && (
						<TourCard
							step={step}
							index={state.step}
							total={steps.length}
							primaryRef={primaryRef}
							onNext={() =>
								state.step + 1 < steps.length
									? goTo(state.step + 1)
									: finish("completed")
							}
							onPrevious={() => goTo(state.step - 1)}
							onSkip={() => finish("skipped")}
						/>
					)}
				</DialogContent>
			</Dialog>
		</TourContext>
	);
};
