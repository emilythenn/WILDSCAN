/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "@google/genai" {
	export class GoogleGenAI {
		constructor(options: { apiKey: string });
		models: {
			generateContent: (args: unknown) => Promise<any>;
		};
	}
}

declare module "@google/genai/web" {
	export * from "@google/genai";
}
