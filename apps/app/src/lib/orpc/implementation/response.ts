/** For `toFetchResponse` in the handlers: pings event streams inside Bun's 10 s idle timeout, which closes a stream while the model is silent. */
export const toFetchResponse = {
	eventStream: {
		keepAlive: {
			enabled: true,
			interval: 5_000,
		},
	},
};
