export {};

declare global {
	interface Window {
		umami: {
			track: (eventName: string, eventData?: Record<string, any>) => void;
			identify: (unique_id: string, data: object) => void;
		};
	}

	const umami: typeof window.umami;
}
