import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { model } from "../../config";
import { githubTool } from "./github-tool";

const agent = new Agent({
  name: "GitHub Reporter Workflow",
  model,
  instructions: `
    You are a GitHub analytics expert that provides structured repository statistics.

    For each repository, structure your response exactly as follows:

    📊 Repository: [owner/repo]
    ═══════════════════════════

    ⭐ KEY STATISTICS
    • Name: [Repository Name]
    • Stars: [X]
    • Forks: [Y]
    • Open Issues: [Z]
    • Total Commits: [W]

    📝 SUMMARY
    • Status: [Brief description, e.g., "Actively maintained with X recent commits"]
    • Activity: [Highlight recent activity, e.g., "High issue activity" or "Stable development"]

    ⚠️ NOTES
    • [Any relevant notes, e.g., "Private repository" or "API rate limit may affect data"]

    Guidelines:
    - Use the githubTool to fetch data.
    - Keep descriptions concise and professional.
    - If data is missing or limited, note it in the NOTES section.
    - Ensure the response follows the exact format with emojis and headers.
  `,
});

const githubStatsSchema = z.object({
  name: z.string(),
  stars: z.number(),
  forks: z.number(),
  issues: z.number(),
  commits: z.number(),
  location: z.string(),
});

const fetchGithubStats = createStep({
  id: "fetch-github-stats",
  description: "Fetches statistics for a GitHub repository",
  inputSchema: z.object({
    owner: z.string().describe("GitHub repository owner"),
    repo: z.string().describe("GitHub repository name"),
  }),
  outputSchema: githubStatsSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Input data not found");
    }
    // Construct the ToolExecutionContext with required runtimeContext
    const stats = await githubTool.execute({
      context: inputData,
      runtimeContext: {} as any, // Replace with actual runtimeContext if available
    });
    return stats;
  },
});

const summarizeStats = createStep({
  id: "summarize-stats",
  description: "Summarizes GitHub repository statistics",
  inputSchema: githubStatsSchema,
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Stats data not found");
    }

    const prompt = `Summarize the following GitHub repository statistics for ${inputData.location}:
      ${JSON.stringify(inputData, null, 2)}
    `;

    const response = await agent.stream([
      {
        role: "user",
        content: prompt,
      },
    ]);

    let summaryText = "";
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      summaryText += chunk;
    }

    return {
      summary: summaryText,
    };
  },
});

const githubWorkflow = createWorkflow({
  id: "github-workflow",
  inputSchema: z.object({
    owner: z.string().describe("GitHub repository owner"),
    repo: z.string().describe("GitHub repository name"),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
})
  .then(fetchGithubStats)
  .then(summarizeStats);

githubWorkflow.commit();

export { githubWorkflow };