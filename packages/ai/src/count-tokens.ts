import llamaTokenizer from "llama-tokenizer-js";

export function countTokens(text: string) {
	return llamaTokenizer.encode(text).length;
}
