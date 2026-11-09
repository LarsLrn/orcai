import { AsyncLocalStorage } from "node:async_hooks";
import {
	getServerAsyncLocalStorage,
	type Locale,
	overwriteServerAsyncLocalStorage,
} from "@/paraglide/runtime";

/**
 * Runs `render` with message functions in `locale`, on the server, inside a
 * request or outside one. Paraglide keeps the request's locale in this storage.
 */
export const withLocale = <A>(locale: Locale, render: () => A): A => {
	let storage = getServerAsyncLocalStorage();
	if (!storage) {
		storage = new AsyncLocalStorage();
		overwriteServerAsyncLocalStorage(storage);
	}

	return storage.run(
		{
			...storage.getStore(),
			locale,
		},
		render,
	);
};
