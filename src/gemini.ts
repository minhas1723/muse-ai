/**
 * Gemini API Module — Streaming SSE Inference
 *
 * Calls the Gemini model via Cloud Code Assist API.
 * Provider-aware: uses correct headers/endpoints based on auth provider.
 * Pure fetch-based — works in Chrome extension service workers.
 */

import {
  type AuthProvider,
  getProvider,
  ANTIGRAVITY_PROVIDER,
} from "./providers";

// Claude thinking models need a special beta header
const CLAUDE_THINKING_BETA_HEADER = "interleaved-thinking-2025-05-14";

function isClaudeThinkingModel(modelId: string): boolean {
  const normalized = modelId.toLowerCase();
  return normalized.includes("claude") && normalized.includes("thinking");
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type ChatMessage = {
  role: "user" | "model";
  parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }>;
};

export type StreamChunk = {
  text?: string;
  thinking?: string;
  finishReason?: string;
  usage?: { input: number; output: number; total: number };
  error?: string;
  functionCall?: { name: string; args: Record<string, any> };
  rawPart?: any; // Preserve full part (incl. thoughtSignature) for conversation replay
};

// ═══════════════════════════════════════════════════════════
// TOOL DECLARATIONS
// ═══════════════════════════════════════════════════════════

// ─── Tool declarations split by mode ───
const READ_DECLARATIONS = [
  {
    name: "read_page_chunks",
    description:
      "Read specific chunks of the user's web page content. The page has been split into numbered chunks. Use the 'source' parameter to choose between the current page ('latest') or the previous version ('previous').",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["latest", "previous"],
          description:
            "Which version to read from: 'latest' (current page) or 'previous' (page state from last message). Defaults to 'latest'.",
        },
        indices: {
          type: "array",
          items: { type: "integer" },
          description: "Chunk indices (0-based) to read",
        },
      },
      required: ["indices"],
    },
  },
  {
    name: "read_editable_content",
    description:
      "Read the raw text content of a specific code editor, textarea, or rich-text input block found on the user's current page.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["latest", "previous"],
          description: "Which page version to read from. Defaults to 'latest'.",
        },
        keys: {
          type: "array",
          items: { type: "string" },
          description: "The exact keys of the editable content to read (e.g., ['monaco_1', 'textarea_2']).",
        },
      },
      required: ["keys"],
    },
  },
];

const WRITE_DECLARATION = {
  name: "write_editable_content",
  description:
    "Edit text in a code editor, textarea, or input field on the user's page using search & replace. Specify the exact text to find and what to replace it with. To type into an empty field, use find='' (empty string) and replace='your text'. Preserves undo history.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "The key of the editable to write to (e.g., 'input_1', 'monaco_1').",
      },
      find: {
        type: "string",
        description: "The exact text to find. Use '' (empty string) to set the entire value.",
      },
      replace: {
        type: "string",
        description: "The text to replace the found text with.",
      },
    },
    required: ["key", "find", "replace"],
  },
};

/** Ask mode — read-only tools (no write) */
export const ASK_TOOLS = [{ functionDeclarations: READ_DECLARATIONS }];

/** Edit mode — read + write tools */
export const EDIT_TOOLS = [{ functionDeclarations: [...READ_DECLARATIONS, WRITE_DECLARATION] }];

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

// Helper: Build Request Body
function buildRequestBody(params: {
  projectId: string;
  modelId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  tools?: any[];
  maxOutputTokens?: number;
  temperature?: number;
  thinkingLevel?: "high" | "low";
  providerConfig: any;
  isAntigravity: boolean;
}): Record<string, unknown> {
  const {
    projectId,
    modelId,
    messages,
    systemPrompt,
    tools,
    maxOutputTokens,
    temperature,
    thinkingLevel,
    providerConfig,
    isAntigravity,
  } = params;

  // Build system instruction
  let systemInstruction: Record<string, unknown> | undefined;
  if (systemPrompt) {
    systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  return {
    project: projectId,
    model: modelId,
    request: {
      contents: messages,
      ...(systemInstruction && { systemInstruction }),
      ...(tools && { tools: tools }),
      generationConfig: {
        ...(maxOutputTokens && { maxOutputTokens }),
        ...(temperature !== undefined && { temperature }),
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel: thinkingLevel ?? "high",
        },
      },
    },
    userAgent: providerConfig.userAgent,
    ...(providerConfig.requestType ? { requestType: providerConfig.requestType } : {}),
    requestId: `${isAntigravity ? "agent" : "pi"}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  };
}

// Helper: Execute Request (Fetch with Retries)
async function executeRequest(params: {
  accessToken: string;
  projectId: string;
  modelId: string;
  providerConfig: any;
  requestBody: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ response?: Response; error?: Error }> {
  const { accessToken, projectId, modelId, providerConfig, requestBody, signal } = params;
  let response: Response | undefined;
  let lastError: Error | undefined;

  for (const endpoint of providerConfig.endpoints) {
    // Reset per-endpoint so a stale error from a previous endpoint doesn't
    // masquerade as the final error if a later endpoint fails differently.
    lastError = undefined;

    const url = `${endpoint}/v1internal:streamGenerateContent?alt=sse`;

    // 🔍 DEBUG: Log basic request details (endpoint + model)
    console.log("🔍 [STREAM REQUEST]", {
      url,
      model: modelId,
      project: projectId,
      isClaudeThinking: isClaudeThinkingModel(modelId),
    });

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...providerConfig.headers,
            ...(isClaudeThinkingModel(modelId) ? { "anthropic-beta": CLAUDE_THINKING_BETA_HEADER } : {}),
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (response.ok) break; // Success!

        const errorText = await response.text();
        console.warn(`⚠️ [STREAM RETRY] Attempt ${attempt}/${MAX_RETRIES} failed`, { status: response.status, endpoint, model: modelId, errorText });

        // Handle Rate Limit (429) specially
        if (response.status === 429) {
          // Try to extract "reset after Xs"
          const match = errorText.match(/after (\d+)s/);
          let waitSeconds = 2; // default backoff

          if (match && match[1]) {
            waitSeconds = parseInt(match[1], 10);
            // Add a buffer
            waitSeconds += 1;
          }

          if (waitSeconds <= 20) {
            console.log(`⏳ Quota exhausted. Waiting ${waitSeconds}s before retry...`);
            await new Promise((r) => setTimeout(r, waitSeconds * 1000));
            continue; // Retry same endpoint
          } else {
             // Too long to wait — try next endpoint or fail
             const waitMsg = match?.[1] ? `Please try again in ${waitSeconds - 1} seconds.` : "Please try again later.";
             lastError = new Error(`Rate limit exceeded. ${waitMsg}`);
             break; // Break inner loop, try next endpoint
          }
        }

        // Handle Service Unavailable (503) — quick backoff
        if (response.status === 503) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }

        // Provide a more helpful error for Claude models
        if (response.status === 404 && isClaudeThinkingModel(modelId)) {
          lastError = new Error(
            `Claude model '${modelId}' not found (404). Your Google Cloud project likely does not have access to these internal/beta models. Try using a Gemini model instead.`
          );
        } else {
          lastError = new Error(`API error (${response.status}): ${errorText}`);
        }
        
        // Non-retriable error (400, 401, 403, 404, etc)
        break;

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // If aborted, stop retrying immediately
        if (lastError.name === "AbortError") {
          console.log("⏹️ [STREAM] Fetch aborted by user.");
          break;
        }

        // Network error? Wait and retry
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    if (response && response.ok) break; // Found a working endpoint!
  }

  if (!response || !response.ok) {
    return { error: lastError ?? new Error("Failed to connect to Cloud Code Assist API") };
  }

  return { response };
}

// Helper: Parse Stream
async function* parseStream(response: Response): AsyncGenerator<StreamChunk> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let chunk: any;
        try {
          chunk = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        const responseData = chunk.response;
        if (!responseData) continue;

        const candidate = responseData.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text !== undefined) {
              const isThinking = part.thought === true;
              yield isThinking
                ? { thinking: part.text, rawPart: part }
                : { text: part.text, rawPart: part };
            }
            if (part.functionCall) {
              yield {
                functionCall: {
                  name: part.functionCall.name,
                  args: part.functionCall.args ?? {},
                },
                rawPart: part,
              };
            }
          }
        }

        if (candidate?.finishReason) {
          yield { finishReason: candidate.finishReason };
        }

        if (responseData.usageMetadata) {
          yield {
            usage: {
              input: responseData.usageMetadata.promptTokenCount || 0,
              output:
                (responseData.usageMetadata.candidatesTokenCount || 0) +
                (responseData.usageMetadata.thoughtsTokenCount || 0),
              total: responseData.usageMetadata.totalTokenCount || 0,
            },
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ═══════════════════════════════════════════════════════════
// STREAMING INFERENCE
// ═══════════════════════════════════════════════════════════

/**
 * Call Gemini via Cloud Code Assist — streaming SSE.
 * Yields chunks as they arrive.
 * Uses provider-specific headers and endpoints.
 */
export async function* streamGeminiChat(params: {
  accessToken: string;
  projectId: string;
  prompt?: string;
  history?: ChatMessage[];
  messages?: ChatMessage[];
  model?: string;
  systemPrompt?: string;
  tools?: any[];
  maxOutputTokens?: number;
  temperature?: number;
  thinkingLevel?: "high" | "low";
  provider?: AuthProvider;
  signal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const providerId = params.provider ?? "antigravity";
  const config = getProvider(providerId);
  const modelId = params.model ?? "gemini-2.5-flash";

  // Build conversation: use explicit messages OR prompt+history
  const messages: ChatMessage[] = params.messages
    ? params.messages
    : [
        ...(params.history ?? []),
        ...(params.prompt ? [{ role: "user" as const, parts: [{ text: params.prompt }] }] : []),
      ];

  const isAntigravity = providerId === "antigravity";

  const requestBody = buildRequestBody({
    projectId: params.projectId,
    modelId,
    messages,
    systemPrompt: params.systemPrompt,
    tools: params.tools,
    maxOutputTokens: params.maxOutputTokens,
    temperature: params.temperature,
    thinkingLevel: params.thinkingLevel,
    providerConfig: config,
    isAntigravity,
  });

  const { response, error } = await executeRequest({
    accessToken: params.accessToken,
    projectId: params.projectId,
    modelId,
    providerConfig: config,
    requestBody,
    signal: params.signal,
  });

  if (error || !response) {
    yield { error: error?.message ?? "Unknown error" };
    return;
  }

  yield* parseStream(response);
}

/**
 * Simple non-streaming call (collects all text).
 */
export async function callGeminiSimple(params: {
  accessToken: string;
  projectId: string;
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  provider?: AuthProvider;
}): Promise<string> {
  let result = "";
  for await (const chunk of streamGeminiChat(params)) {
    if (chunk.text) result += chunk.text;
    if (chunk.error) throw new Error(chunk.error);
  }
  return result;
}
