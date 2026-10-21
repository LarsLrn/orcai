import {
	ReadableStream,
	TextDecoderStream,
	TextEncoderStream,
	TransformStream,
	WritableStream,
} from "node:stream/web";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// happy-dom's stream classes do not mix with the AI SDK's; tests run on the native ones.
Object.assign(globalThis, {
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
