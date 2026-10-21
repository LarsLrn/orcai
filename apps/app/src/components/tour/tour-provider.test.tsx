import { afterEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { m } from "@/paraglide/messages";

const setTourState = mock(async (_input: unknown) => ({}));
let storedTours: Record<string, string> = {};
const trackEvent = mock((_name: string, _data?: unknown) => undefined);

mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		user: {
			me: {
				queryOptions: () => ({
					queryKey: [
						"user",
						"me",
					],
					queryFn: async () => ({
						data: {
							preferences: {
								tours: storedTours,
							},
						},
					}),
				}),
			},
			setTourState: {
				mutationOptions: () => ({
					mutationFn: (input: unknown) => setTourState(input),
				}),
			},
		},
	},
}));
mock.module("@/hooks/use-umami", () => ({
	useUmami: () => ({
		trackEvent,
		identifyUser: () => undefined,
	}),
}));

const { TourProvider, useTour } = await import(
	"@/components/tour/tour-provider"
);

afterEach(() => {
	cleanup();
	storedTours = {};
	setTourState.mockClear();
	trackEvent.mockClear();
});

const Probe = ({ tour }: { tour: "initial" | "chat" }) => {
	const { seen, start } = useTour(`${tour}Tour`);
	return (
		<button type="button" onClick={start}>
			{`start ${tour} (${seen ?? "loading"})`}
		</button>
	);
};

const renderTours = () =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<TourProvider>
				<Probe tour="initial" />
				<Probe tour="chat" />
			</TourProvider>
		</QueryClientProvider>,
	);

const startTour = (tour: "initial" | "chat") => {
	renderTours();
	fireEvent.click(screen.getByText(new RegExp(`^start ${tour}`)));
	return screen.getByRole("dialog");
};

const click = (name: string) =>
	fireEvent.click(
		screen.getByRole("button", {
			name,
		}),
	);

describe("TourProvider", () => {
	test("reports which tours the user has completed or skipped", async () => {
		storedTours = {
			chatTour: "skipped",
		};
		renderTours();

		expect(screen.getByText("start initial (loading)")).toBeDefined();
		expect(await screen.findByText("start initial (false)")).toBeDefined();
		expect(screen.getByText("start chat (true)")).toBeDefined();
	});

	test("shows the first step as a labelled dialog with focus on Next", async () => {
		const dialog = startTour("initial");

		expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
		expect(
			screen.getByRole("heading", {
				name: m.tour_initial_welcome_title(),
			}),
		).toBeDefined();
		expect(
			screen.getByText(
				m.tour_card_progress({
					current: 1,
					total: 6,
				}),
			),
		).toBeDefined();
		await waitFor(() =>
			expect(document.activeElement?.textContent).toBe(m.common_next_button()),
		);
	});

	test("walks the steps forward and back", () => {
		startTour("initial");

		click(m.common_next_button());
		expect(screen.getByText(m.tour_initial_sidebar_title())).toBeDefined();

		click(m.tour_card_previous_button());
		expect(screen.getByText(m.tour_initial_welcome_title())).toBeDefined();
	});

	test("Escape skips the tour and remembers it", async () => {
		const dialog = startTour("initial");

		fireEvent.keyDown(dialog, {
			key: "Escape",
		});

		expect(dialog.hasAttribute("data-closed")).toBe(true);
		await waitFor(() => expect(setTourState).toHaveBeenCalled());
		expect(setTourState).toHaveBeenCalledWith({
			tourId: "initialTour",
			state: "skipped",
		});
		expect(trackEvent).toHaveBeenCalledWith("tour-skipped", {
			tour: "initialTour",
		});
		// Seen at once, although the preferences loaded before still say otherwise.
		expect(screen.getByText("start initial (true)")).toBeDefined();
	});

	test("finishing the last step completes the tour", async () => {
		const dialog = startTour("chat");

		click(m.common_next_button());
		click(m.common_next_button());
		expect(
			screen.queryByRole("button", {
				name: m.tour_card_skip_button(),
			}),
		).toBeNull();
		click(m.tour_card_finish_button());

		expect(dialog.hasAttribute("data-closed")).toBe(true);
		await waitFor(() => expect(setTourState).toHaveBeenCalled());
		expect(setTourState).toHaveBeenCalledTimes(1);
		expect(setTourState).toHaveBeenCalledWith({
			tourId: "chatTour",
			state: "completed",
		});
		expect(trackEvent).toHaveBeenCalledWith("tour-completed", {
			tour: "chatTour",
		});
	});
});
