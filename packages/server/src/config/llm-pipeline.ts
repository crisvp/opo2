import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const llmPipelineSchema = z.object({
  sieve: z.object({
    model: z.string(),
    maxTokens: z.number().int().positive(),
    temperature: z.number().min(0).max(2),
  }),
  extractor: z.object({
    model: z.string(),
    maxTokens: z.number().int().positive(),
    temperature: z.number().min(0).max(2),
  }),
});

export type LlmPipelineConfig = z.infer<typeof llmPipelineSchema>;

let _config: LlmPipelineConfig | null = null;

export function getLlmPipelineConfig(): LlmPipelineConfig {
  if (_config) return _config;

  // Inline default config to avoid YAML dependency at startup
  _config = {
    sieve: {
      model: "google/gemini-flash-1.5-8b",
      maxTokens: 1024,
      temperature: 0,
    },
    extractor: {
      model: "google/gemini-flash-1.5",
      maxTokens: 4096,
      temperature: 0,
    },
  };

  return _config;
}
