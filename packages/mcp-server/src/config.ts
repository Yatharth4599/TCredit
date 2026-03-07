/** Krexa MCP Server configuration — reads from environment variables */

export const config = {
  /** Base URL of the Krexa backend API (e.g. http://localhost:3001/api/v1) */
  apiUrl: process.env.KREXA_API_URL ?? 'http://localhost:3001/api/v1',

  /** Optional API key for authenticated endpoints */
  apiKey: process.env.KREXA_API_KEY ?? '',
} as const;
