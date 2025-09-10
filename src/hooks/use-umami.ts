/** biome-ignore-all lint/complexity/useOptionalChain: <need typeof check for SSR safety> */
export function useUmami() {
	const identifyUser = (
		uniqueId: string,
		data: { name: string; email: string },
	) => {
		if (!import.meta.env.PROD) return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.identify(uniqueId, data);
		}
	};

	const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
		if (!import.meta.env.PROD) return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.track(eventName, eventData);
		} else {
			console.warn("Umami is not yet loaded.");
		}
	};

	return { trackEvent, identifyUser };
}
