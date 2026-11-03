import { usePublicConfig } from "@/hooks/use-public-config";

export function useUmami() {
	const { umami } = usePublicConfig();

	const identifyUser = (user: { id: string; name: string; email: string }) => {
		if (!umami) return;

		if (typeof window !== "undefined" && window.umami) {
			window.umami.identify(user.id, {
				email: user.email,
				name: user.name,
			});
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
