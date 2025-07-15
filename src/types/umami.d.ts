export {};

declare global {
	interface Window {
		umami: {
			track: (
				eventName: string,
				// biome-ignore lint/suspicious/noExplicitAny: <Broad type for eventData>
				eventData?: Record<string, any>,
			) => void;
			identify: (unique_id: string, data: object) => void;
		};
	}

	const umami: typeof window.umami;
}
