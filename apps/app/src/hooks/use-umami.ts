import { usePublicConfig } from "@/hooks/use-public-config";

export function useUmami() {
	const { umami } = usePublicConfig();

	const identifyUser = (
		uniqueId: string,
		data: {
			name: string;
			email: string;
		},
	) => {
		if (!umami) return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.identify(uniqueId, data);
		}
	};

	const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
		if (!umami) return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.track(eventName, eventData);
		} else {
			console.warn("Umami is not yet loaded.");
		}
	};

	return {
		trackEvent,
		identifyUser,
	};
}
