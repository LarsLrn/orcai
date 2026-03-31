import type { SpiceConvergeOperation } from "../types";
import { removeCourseTuplesOperation } from "./010-remove-course-tuples";

export const operations: SpiceConvergeOperation[] = [
	removeCourseTuplesOperation,
];
