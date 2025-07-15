export function useUmami() {
	const identifyUser = (
		uniqueId: string,
		data: { name: string; email: string },
	) => {
		if (typeof window !== "undefined" && window.umami) {
			window.umami.identify(uniqueId, data);
		}
	};

	const trackEvent = (
		eventName: string,
		// biome-ignore lint/suspicious/noExplicitAny: <Broad type for eventData>
		eventData?: Record<string, any>,
	) => {
		if (typeof window !== "undefined" && window.umami) {
			window.umami.track(eventName, eventData);
		} else {
			console.warn("Umami is not yet loaded.");
		}
	};

	return { trackEvent, identifyUser };
}
