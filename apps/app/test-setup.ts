import {
	ReadableStream,
	TextDecoderStream,
	TextEncoderStream,
	TransformStream,
	WritableStream,
} from "node:stream/web";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const { AbortController, AbortSignal } = globalThis;

GlobalRegistrator.register();

// happy-dom's stream and abort classes do not mix with native streams; tests run on the native ones.
Object.assign(globalThis, {
	AbortController,
	AbortSignal,
	ReadableStream,
	WritableStream,
	TransformStream,
	TextDecoderStream,
	TextEncoderStream,
});

// Lets React Testing Library wrap updates in act() without warnings.
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
});
