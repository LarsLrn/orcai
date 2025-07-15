import type { Course } from "@/db/schema/course";
import type { Document } from "@/db/schema/document";
import type { FilePayload } from "./file";

export interface ProcessDocumentTaskPayload {
	courseId: string;
	documentRef: Omit<FilePayload, "expiry">;
	mergePages: boolean;
}

export interface VectorizeFilesTaskPayload {
	prefix: string;
	courseId: string;
	documentId: Document["id"];
	mergePages: boolean;
}

// Base type with common properties
interface ProcessingStatusBase {
	documentId: Document["id"];
	courseId: Course["id"];
	mergePages: boolean;
	step: "processing" | "embedding";
}

// Success variant
interface ProcessingStatusSuccess extends ProcessingStatusBase {
	status: "success";
}

// Error variant with required error property
interface ProcessingStatusError extends ProcessingStatusBase {
	status: "error";
	error: string;
}

// Discriminated union
export type ProcessingStatus = ProcessingStatusSuccess | ProcessingStatusError;
