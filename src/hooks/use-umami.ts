import { clientEnv } from "@/lib/env/client";

export function useUmami() {
	const identifyUser = (
		uniqueId: string,
		data: { name: string; email: string },
	) => {
		if (!clientEnv.VITE_UMAMI_SCRIPT_URL || !clientEnv.VITE_UMAMI_WEBSITE_ID)
			return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.identify(uniqueId, data);
		}
	};

	const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
		if (!clientEnv.VITE_UMAMI_SCRIPT_URL || !clientEnv.VITE_UMAMI_WEBSITE_ID)
			return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.track(eventName, eventData);
		} else {
			console.warn("Umami is not yet loaded.");
		}
	};

	return { trackEvent, identifyUser };
}
