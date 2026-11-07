import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

// Ensure this service is strictly server-side
if (typeof window !== 'undefined') {
  throw new Error('Gemini service must only be executed in a server environment.');
}

export interface GenerateStructuredJsonOptions<T extends z.ZodTypeAny> {
  prompt: string;
  schema: T;
  systemInstruction?: string;
  modelOverride?: string;
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
  fallbackModels?: string[];
  promptVersion?: string;
}

/**
 * Returns an instance of GoogleGenAI using GEMINI_API_KEY from server environment.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Server environment variable GEMINI_API_KEY is not set.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Resolves the model to use from GEMINI_MODEL environment variable, with a configurable fallback.
 */
export function getGeminiModel(override?: string): string {
  if (override && override.trim().length > 0) return override.trim();
  const envModel = process.env.GEMINI_MODEL;
  if (envModel && envModel.trim().length > 0) return envModel.trim();
  return 'gemini-3.8-flash';
}

/**
 * Extracts and cleans raw JSON string from LLM responses, stripping code fences if present.
 */
export function extractJsonFromResponse(rawText: string): string {
  let cleaned = rawText.trim();
  // Strip markdown code blocks like ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    const lastFence = cleaned.lastIndexOf('```');
    if (lastFence !== -1) {
      cleaned = cleaned.slice(0, lastFence);
    }
  }
  return cleaned.trim();
}

/**
 * Checks whether an error is a permanent quota limit on the specific model (e.g. Free tier per day limit),
 * which should trigger an immediate fallback instead of retrying the same model.
 */
function isQuotaExhaustedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as { message?: unknown; status?: unknown };
  const msg = typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';
  const statusStr = typeof errObj.status === 'string' ? errObj.status.toLowerCase() : '';
  return (
    msg.includes('per day limit exceeded') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('quotafailure') ||
    (statusStr.includes('resource_exhausted') && msg.includes('limit: 20'))
  );
}

/**
 * Checks whether an error from the Gemini API is retryable (rate limits, capacity spikes, network, timeouts).
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (isQuotaExhaustedError(error)) return false; // Failover immediately to next model
  const errObj = error as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
  const msg = typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';
  const statusStr = typeof errObj.status === 'string' ? errObj.status.toLowerCase() : '';
  const statusCode = typeof errObj.status === 'number' ? errObj.status : undefined;
  const code = typeof errObj.code === 'number' ? errObj.code : typeof errObj.code === 'string' ? parseInt(errObj.code, 10) : undefined;
  const name = typeof errObj.name === 'string' ? errObj.name : '';

  if (code === 429 || code === 503 || code === 500 || code === 502 || code === 504) return true;
  if (statusCode === 429 || statusCode === 503 || statusCode === 500 || statusCode === 502 || statusCode === 504) return true;
  if (statusStr.includes('unavailable') || statusStr.includes('resource_exhausted')) return true;
  if (name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout')) return true;
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable') || msg.includes('rate limit')) return true;
  if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('fetch failed')) return true;

  return false;
}

/**
 * Reusable function to call Gemini and return validated structured JSON with retries, timeouts, and fallbacks.
 */
export async function generateStructuredJson<T extends z.ZodTypeAny>({
  prompt,
  schema,
  systemInstruction,
  modelOverride,
  temperature = 0.1,
  maxRetries = 2,
  timeoutMs = 25000,
  fallbackModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.7-flash'],
  promptVersion = 'v1.0'
}: GenerateStructuredJsonOptions<T>): Promise<z.output<T>> {
  const client = getGeminiClient();
  const primaryModel = getGeminiModel(modelOverride);
  const modelsToTry = [primaryModel, ...fallbackModels.filter(m => m !== primaryModel)];

  let lastError: Error | null = null;

  for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
    const currentModel = modelsToTry[modelIndex];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            temperature,
            responseMimeType: 'application/json',
            abortSignal: AbortSignal.timeout(timeoutMs),
            ...(systemInstruction ? { systemInstruction } : {})
          }
        });

        const rawText = response.text;
        if (!rawText || rawText.trim().length === 0) {
          throw new Error(`Empty response received from Gemini model ${currentModel}`);
        }

        const cleanedJson = extractJsonFromResponse(rawText);
        let parsed: unknown;
        try {
          parsed = JSON.parse(cleanedJson);
        } catch (jsonErr) {
          throw new Error(
            `Malformed JSON from Gemini model ${currentModel}: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}. Raw output: ${rawText.slice(0, 300)}`
          );
        }

        const validationResult = schema.safeParse(parsed);
        if (!validationResult.success) {
          const errors = validationResult.error.flatten();
          throw new Error(
            `Schema validation failed for model ${currentModel} output: ${JSON.stringify(errors)}`
          );
        }

        const usage = (response as any).usageMetadata;
        if (usage) {
          console.info(
            `[Gemini Telemetry] Model: ${currentModel} | Version: ${promptVersion} | PromptTokens: ${usage.promptTokenCount ?? 0} | CandidatesTokens: ${usage.candidatesTokenCount ?? 0} | TotalTokens: ${usage.totalTokenCount ?? 0}`
          );
        }

        return validationResult.data;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isExhausted = isQuotaExhaustedError(err);
        const retryable = !isExhausted && isRetryableError(err);

        if (retryable && attempt < maxRetries) {
          const baseDelay = 1500;
          const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 500);
          const delay = exponentialDelay + jitter;
          console.warn(
            `[Gemini Service] Transient error on ${currentModel} (attempt ${attempt}/${maxRetries}): ${lastError.message}. Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // If attempts exhausted, or model is 404/quota-exhausted, immediately try next fallback model
        if (modelIndex < modelsToTry.length - 1) {
          console.warn(
            `[Gemini Service] Model ${currentModel} unavailable (${lastError.message.slice(0, 100)}). Falling back to ${modelsToTry[modelIndex + 1]}...`
          );
          break; // Exit retry loop and move to next model in modelsToTry
        }
      }
    }
  }

  throw lastError || new Error(`Failed to generate structured content after attempting all models and retries.`);
}
