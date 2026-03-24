/** Krexa MCP Server configuration — reads from environment variables */

const apiUrl = process.env.KREXA_API_URL ?? 'https://api.krexa.xyz/api/v1';

// BUG-062: warn if using HTTP in production
if (apiUrl.startsWith('http://') && process.env.NODE_ENV === 'production') {
  process.stderr.write('[krexa-mcp] WARNING: API URL uses HTTP — API key will be transmitted unencrypted\n');
}

export const config = {
  /** Base URL of the Krexa backend API */
  apiUrl,

  /** Optional API key for authenticated endpoints */
  apiKey: process.env.KREXA_API_KEY ?? '',
} as const;
