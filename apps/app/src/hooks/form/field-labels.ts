import type { AnyFieldApi } from "@tanstack/react-form";
import { useEffect } from "react";

// Keyed by the store a form shares with its fields.
const labelsByForm = new WeakMap<object, Map<string, string>>();

/** Records a field's visible label so the form's error summary names it the same way. */
export const useFieldLabel = (field: AnyFieldApi, label: string) => {
	const store = field.form.store;
	const name = field.name;

	useEffect(() => {
		const labels = labelsByForm.get(store) ?? new Map<string, string>();
		labelsByForm.set(store, labels);
		labels.set(name, label);

		return () => {
			labels.delete(name);
		};
	}, [
		store,
		name,
		label,
	]);
};

export const fieldLabelOf = (store: object, name: string) =>
	labelsByForm.get(store)?.get(name);
