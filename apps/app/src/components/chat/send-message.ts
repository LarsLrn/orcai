import { createContext } from "react";

/** Sends a message as the user, as a prefilled reply does; undefined while a turn runs. */
export const SendMessageContext = createContext<
	((text: string) => Promise<void>) | undefined
>(undefined);
