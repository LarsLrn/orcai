import type { DataExportId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const dataExportIdSchema = createUuidIdSchema<DataExportId>();
