import { z } from "zod";
import type { ToolDef } from "./types";

const InputSchema = z.object({
  summary: z
    .string()
    .describe(
      "One- to three-sentence executive summary of what was accomplished in this run. Shown to the user as the final tagline."
    ),
  sections_written: z
    .array(z.string())
    .optional()
    .describe("Ids of sections written during this run, in order."),
});

type Input = z.infer<typeof InputSchema>;

export const finishTool: ToolDef<Input, { done: true; summary: string }> = {
  name: "finish",
  description:
    "Signal that the analysis is complete. Call this after all required sections have been written and there is nothing further to investigate. The run will terminate after this call.",
  input_schema: InputSchema,
  label: (input) => `finish("${input.summary.slice(0, 30)}…")`,
  async execute(input) {
    return {
      output: { done: true as const, summary: input.summary },
      summary: input.summary,
    };
  },
};
