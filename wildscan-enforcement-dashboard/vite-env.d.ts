/// <reference types="vite/client" />

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
