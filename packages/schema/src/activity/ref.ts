import type { ActivityRunId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const activityRunIdSchema = createUuidIdSchema<ActivityRunId>();
