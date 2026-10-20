import { z } from "zod/v4";
import { m } from "@/paraglide/messages";

export const statusSchema = z.enum([
	"met",
	"partial",
	"not_met",
	"n_a",
]);

export type Status = z.infer<typeof statusSchema>;

export const statusLabel = (status: Status): string => {
	switch (status) {
		case "met":
			return m.gen_ui_status_met();
		case "partial":
			return m.gen_ui_status_partial();
		case "not_met":
			return m.gen_ui_status_not_met();
		case "n_a":
			return m.gen_ui_status_n_a();
	}
};

const TALLIED_STATUSES = [
	"not_met",
	"partial",
	"met",
] as const satisfies readonly Status[];

export type TalliedStatus = (typeof TALLIED_STATUSES)[number];

/** Counts in display order; zero counts and `n_a` are left out. */
export const tally = (
	statuses: readonly (Status | undefined)[],
): {
	status: TalliedStatus;
	count: number;
}[] =>
	TALLIED_STATUSES.map((status) => ({
		status,
		count: statuses.filter((value) => value === status).length,
	})).filter(({ count }) => count > 0);
