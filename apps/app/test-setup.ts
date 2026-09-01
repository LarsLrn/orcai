import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// Lets React Testing Library wrap updates in act() without warnings.
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
});
