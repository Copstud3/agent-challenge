import { Agent } from "@mastra/core/agent";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { model } from "../../config";
import { githubTool } from "./github-tool";

const agent = new Agent({
  name: "GitHub Reporter Workflow",
  model,
  instructions: `
GitHub Reporter: Analytics for repositories and owners

Format your response exactly as follows, with clear sections and line breaks. If the repository is private or not found, include only the Owner Profile and Notes sections.

📊 **Repository**: [location]
════════════════════════════

⭐ **Key Statistics**
- Name: [name]
- Stars: [stars]
- Forks: [forks]
- Open Issues: [issues]
- Total Commits: [commits]
- Primary Language: [primaryLanguage]
- Last Commit: [lastCommitDate]
- License: [license]

👤 **Owner Profile**
- Username: [user.login]
- Bio: [user.bio]
- Followers: [user.followers]
- Following: [user.following]
- Location: [user.location]

📝 **Summary**
- Status: [Brief status, e.g., "Active with recent commits" or "Repository inaccessible"]
- Activity: [Brief activity, e.g., "Stable [primaryLanguage] project" or "No activity data available"]

⚠️ **Notes**
- [Notes, e.g., "No bio available", "Repository is private or does not exist"]
- [If repository accessible] Suggested README badge: ![Stars](https://img.shields.io/github/stars/[owner]/[repo]?style=social)

Guidelines:
- Always use the githubTool to fetch data from the GitHub API.
- If status is "private" or "not_found", omit Key Statistics and include errorMessage in Notes.
- Ensure all fields are filled; use "None" for missing data (e.g., bio, license).
- Use markdown-like formatting with headers and bullet points, preserving line breaks for readability in the Mastra Playground and API.
- Handle errors gracefully (e.g., include errorMessage in Notes).
  `,
});

const githubStatsSchema = z.object({
  name: z.string().nullable(),
  stars: z.number().nullable(),
  forks: z.number().nullable(),
  issues: z.number().nullable(),
  commits: z.number().nullable(),
  location: z.string().nullable(),
  primaryLanguage: z.string().nullable(),
  lastCommitDate: z.string().nullable(),
  license: z.string().nullable(),
  user: z.object({
    login: z.string(),
    bio: z.string().nullable(),
    followers: z.number(),
    following: z.number(),
    avatarUrl: z.string().nullable(),
    location: z.string().nullable(),
  }).nullable(),
  status: z.enum(["success", "private", "not_found"]).default("success"),
  errorMessage: z.string().nullable(),
});

const inputSchema = z.union([
  z.object({
    owner: z.string().describe("GitHub repository owner"),
    repo: z.string().describe("GitHub repository name"),
  }),
  z.object({
    messages: z.array(
      z.object({
        role: z.literal("user"),
        content: z.union([
          z.object({
            owner: z.string().describe("GitHub repository owner"),
            repo: z.string().describe("GitHub repository name"),
          }),
          z.string().transform((str) => {
            try {
              return JSON.parse(str);
            } catch {
              throw new Error("Invalid JSON in content");
            }
          }).pipe(
            z.object({
              owner: z.string(),
              repo: z.string(),
            })
          ),
        ]),
      })
    ),
  }),
]);

const fetchGithubStats = createStep({
  id: "fetch-github-stats",
  description: "Fetches statistics for a GitHub repository and its owner",
  inputSchema,
  outputSchema: githubStatsSchema,
  execute: async ({ inputData, runtimeContext }) => {
    console.log("fetchGithubStats input:", JSON.stringify(inputData, null, 2));
    let owner, repo;
    if ("messages" in inputData && inputData.messages?.[0]?.content) {
      const content = inputData.messages[0].content;
      if (typeof content === "string") {
        const parsed = JSON.parse(content);
        owner = parsed.owner;
        repo = parsed.repo;
      } else {
        owner = content.owner;
        repo = content.repo;
      }
    } else if ("owner" in inputData && "repo" in inputData) {
      owner = inputData.owner;
      repo = inputData.repo;
    } else {
      throw new Error("Invalid input: owner and repo required");
    }
    console.log(`Fetching stats for ${owner}/${repo}`);
    const stats = await githubTool.execute({
      context: { owner, repo },
      runtimeContext: runtimeContext || {},
    });
    return stats;
  },
});

const summarizeStats = createStep({
  id: "summarize-stats",
  description: "Summarizes GitHub repository and user statistics",
  inputSchema: githubStatsSchema,
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error("Stats data not found");
    }
    console.log("summarizeStats input:", JSON.stringify(inputData, null, 2));

    const prompt = `Summarize the following GitHub repository and user statistics for ${inputData.location || "unknown location"}:
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
  inputSchema,
  outputSchema: z.object({
    summary: z.string(),
  }),
})
  .then(fetchGithubStats)
  .then(summarizeStats);

githubWorkflow.commit();

export { githubWorkflow };