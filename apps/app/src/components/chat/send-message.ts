import { createContext } from "react";

/** Sends a message as the user, as a prefilled reply does; undefined while a turn runs or the composer is blocked. */
export const SendMessageContext = createContext<
	((text: string) => Promise<void>) | undefined
>(undefined);
