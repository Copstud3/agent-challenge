import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export const githubTool = createTool({
  id: "get-github-stats",
  description: "Fetches statistics for a GitHub repository",
  inputSchema: z.object({
    owner: z.string().describe("GitHub repository owner (e.g., 'nosana-ci')"),
    repo: z.string().describe("GitHub repository name (e.g., 'agent-challenge')"),
  }),
  outputSchema: z.object({
    name: z.string(),
    stars: z.number(),
    forks: z.number(),
    issues: z.number(),
    commits: z.number(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getGithubStats(context.owner, context.repo);
  },
});

const getGithubStats = async (owner: string, repo: string) => {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const { data: commitsData } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });
    const commitsCount = commitsData.length > 0 ? await getCommitCount(owner, repo) : 0;
    return {
      name: repoData.name,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      issues: repoData.open_issues_count,
      commits: commitsCount,
      location: `${owner}/${repo}`,
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = (error as any).status;
      if (status === 403) {
        throw new Error(`Access denied to ${owner}/${repo}. Ensure the token has access to this private repository.`);
      } else if (status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or inaccessible.`);
      }
    }
    const message = typeof error === "object" && error !== null && "message" in error
      ? (error as any).message
      : String(error);
    throw new Error(`Failed to fetch stats for ${owner}/${repo}: ${message}`);
  }
};

async function getCommitCount(owner: string, repo: string): Promise<number> {
  try {
    // GitHub API doesn't provide a direct total commit count, so we approximate
    // For simplicity, check the first page of commits; for production, paginate or use GraphQL
    const { data } = await octokit.repos.listCommits({ owner, repo, per_page: 100 });
    return data.length; // Approximate count; consider GraphQL for precise counts
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error fetching commits: ${error.message}`);
    } else {
      console.error(`Error fetching commits: ${String(error)}`);
    }
    return 0;
  }
}