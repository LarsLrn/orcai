import { z } from "zod/v4";

/** ISO 4217 codes the runtime can format. */
export const CURRENCIES = Intl.supportedValuesOf("currency");

export const currencySchema = z.enum(CURRENCIES);

/** A price an admin entered, in its provider's currency. */
export const priceSchema = z.number().nonnegative().max(1_000_000);
