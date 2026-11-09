import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, pinnedFile, sha256 } from "./cache";
import { generatedDocuments } from "./generated";

export interface EvalDocument {
	id: string;
	title: string;
	language: "de" | "en";
	mimeType: string;
	data: Uint8Array;
}

/**
 * Public documents fetched at run time and pinned by digest, never stored in
 * the repository. Each may be used under the basis it names: a German
 * official work (§ 5 UrhG), the public domain, CC0, CC BY or the Datenlizenz
 * Deutschland.
 */
const FETCHED: (Omit<EvalDocument, "data"> & {
	url: string;
	sha256: string;
	licence: string;
})[] = [
	{
		id: "wohngeld-verordnung",
		title: "Zweite Verordnung zur Fortschreibung des Wohngeldes",
		language: "de",
		mimeType: "application/pdf",
		url: "https://www.recht.bund.de/bgbl/1/2024/314/regelungstext.pdf?__blob=publicationFile&v=1",
		sha256: "7921ddc1c607f101c50d5dd4adf43ed5920d72d21f2c33095c501beb90ae50cc",
		licence: "§ 5 Abs. 1 UrhG, Verordnung (BGBl. 2024 I Nr. 314)",
	},
	{
		id: "rki-gesundheitskompetenz",
		title:
			"Gesundheitskompetenz von Schülerinnen und Schülern in Deutschland, Ergebnisse der HBSC-Studie 2022",
		language: "de",
		mimeType: "application/pdf",
		url: "https://edoc.rki.de/bitstream/176904/11544/1/JHealthMonit_2024_01_Gesundheitskompetenz.pdf",
		sha256: "ee24088a8e3d54a963c1125c9a6c7594d21067b1c608ae7f10945fc5f371e626",
		licence: "CC BY 4.0 (Robert Koch-Institut, Journal of Health Monitoring)",
	},
	{
		id: "rki-health-literacy",
		title:
			"Health literacy of students in Germany, results of the HBSC study 2022",
		language: "en",
		mimeType: "application/pdf",
		url: "https://edoc.rki.de/bitstream/176904/11551/1/JHealthMonit_2024_01_Health_Literacy-1.pdf",
		sha256: "8e73facf8c378ee866bb4aef976824c8663555865ffad416bfbf76805b47172e",
		licence: "CC BY 4.0 (Robert Koch-Institut, Journal of Health Monitoring)",
	},
	{
		id: "census-household-income",
		title: "Household Income in States and Metropolitan Areas: 2024",
		language: "en",
		mimeType: "application/pdf",
		url: "https://www2.census.gov/library/publications/2025/demo/acsbr-025.pdf",
		sha256: "5de1b0d5ec469344896bdf8485d3e93206351c0f1f9e51029b8d57d2df9054b9",
		licence: "Public domain, 17 U.S.C. § 105 (U.S. Census Bureau)",
	},
	{
		id: "naca-scan",
		title: "NACA Research Memorandum E6L05a (1947), scanned",
		language: "en",
		mimeType: "application/pdf",
		url: "https://ntrs.nasa.gov/api/citations/20030063942/downloads/20030063942.pdf",
		sha256: "b0772652d55a1c93d64eeda6a89fdf0a738971d538c9d64606c37e89c10be3ff",
		licence: "Public domain, work of the U.S. Government (NTRS 20030063942)",
	},
];

/** The Tesseract models the workers image installs (Debian's tessdata_fast 4.1.0). */
const TESSDATA = [
	{
		language: "eng",
		sha256: "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
	},
	{
		language: "deu",
		sha256: "19d219bbb6672c869d20a9636c6816a81eb9a71796cb93ebe0cb1530e2cdb22d",
	},
];

/** A directory with the OCR models, for `TESSDATA_PREFIX`. */
export const tessdata = async () => {
	await Promise.all(
		TESSDATA.map(({ language, sha256 }) =>
			pinnedFile({
				url: `https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/${language}.traineddata`,
				sha256,
				path: `tessdata/${language}.traineddata`,
			}),
		),
	);
	return join(CACHE, "tessdata");
};

/** What the corpus is made of: the pinned digests and the source the generated documents come from, whose bytes differ per run. */
export const corpusFingerprint = () =>
	sha256(
		JSON.stringify([
			FETCHED.map(({ id, sha256: digest }) => [
				id,
				digest,
			]),
			sha256(readFileSync(join(import.meta.dir, "generated.ts"))),
		]),
	);

export const loadCorpus = async (): Promise<EvalDocument[]> => [
	...(await Promise.all(
		FETCHED.map(async ({ url, sha256, licence: _, ...document }) => ({
			...document,
			data: await pinnedFile({
				url,
				sha256,
				path: `documents/${sha256}`,
			}),
		})),
	)),
	...(await generatedDocuments()),
];
