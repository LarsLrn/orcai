import { test as base, expect } from "../index";
import {
	type InferenceMock,
	type InferenceMockOptions,
	startInferenceMock,
} from "./server";

type InferenceWorkerFixtures = {
	/** Options the mock starts with; override per project or per file. */
	inferenceOptions: InferenceMockOptions;
	/** This worker's mock inference server, on an ephemeral port. */
	inference: InferenceMock;
};

/** `test` from `fixtures/index.ts` plus the worker-scoped mock inference server. */
export const test = base.extend<
	{
		resetInference: undefined;
	},
	InferenceWorkerFixtures
>({
	resetInference: [
		async ({ inference }, use) => {
			inference.reset();
			try {
				await use(undefined);
			} finally {
				inference.reset();
			}
		},
		{
			auto: true,
		},
	],
	inferenceOptions: [
		{},
		{
			scope: "worker",
			option: true,
		},
	],

	inference: [
		async ({ inferenceOptions }, use) => {
			const mock = await startInferenceMock(inferenceOptions);

			await use(mock);

			await mock.close();
		},
		{
			scope: "worker",
		},
	],
});

export {
	DEFAULT_EMBEDDING_DIMENSIONS,
	INFERENCE_MOCK_MODELS,
	startInferenceMock,
} from "./server";
export type { InferenceMock, InferenceMockOptions };
export { expect };
