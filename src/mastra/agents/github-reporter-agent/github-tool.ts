import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const githubTool = createTool({
  id: "get-github-stats",
  description: "Fetches statistics and profile information for a GitHub repository and its owner",
  inputSchema: z.object({
    owner: z.string().describe("GitHub repository owner"),
    repo: z.string().describe("GitHub repository name"),
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ context, runtimeContext }) => {
    const { owner, repo } = context;
    const githubToken = process.env.GITHUB_TOKEN || (runtimeContext && (runtimeContext as any)["GITHUB_TOKEN"]);

    if (!githubToken) {
      return {
        name: null,
        stars: null,
        forks: null,
        issues: null,
        commits: null,
        location: null,
        primaryLanguage: null,
        lastCommitDate: null,
        license: null,
        user: null,
        status: "not_found" as "not_found",
        errorMessage: "GITHUB_TOKEN is required",
      };
    }

    const headers = {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Fetch user profile data first
    let userData = null;
    try {
      const userResponse = await fetch(`https://api.github.com/users/${owner}`, { headers });
      if (userResponse.ok) {
        userData = await userResponse.json();
      }
    } catch (error) {
      console.error(`Failed to fetch user data for ${owner}:`, error);
    }

    // Fetch repository data
    let repoData = null;
    let commitCount = 0;
    let lastCommitDate = null;
    let status: "success" | "private" | "not_found" = "success";
    let errorMessage: string | null = null;

    try {
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          status = "private"; // Assume private if 404 (could also be not found)
          errorMessage = `Repository ${owner}/${repo} is private or does not exist`;
        } else {
          status = "not_found";
          errorMessage = `Failed to fetch repository: ${repoResponse.statusText}`;
        }
      } else {
        repoData = await repoResponse.json();

        // Fetch commit count
        const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers });
        if (commitsResponse.ok) {
          const commitsLink = commitsResponse.headers.get("link");
          if (commitsLink) {
            const match = commitsLink.match(/page=(\d+)>; rel="last"/);
            commitCount = match ? parseInt(match[1], 10) : 1;
          }
          const commits = await commitsResponse.json();
          lastCommitDate = commits[0]?.commit?.committer?.date || null;
        }
      }
    } catch (error: any) {
      status = "not_found";
      errorMessage = `Error fetching repository: ${error?.message ?? String(error)}`;
    }

    return {
      name: repoData ? repoData.name : null,
      stars: repoData ? repoData.stargazers_count : null,
      forks: repoData ? repoData.forks_count : null,
      issues: repoData ? repoData.open_issues_count : null,
      commits: commitCount || null,
      location: repoData ? `${owner}/${repo}` : null,
      primaryLanguage: repoData ? repoData.language || "None" : "None",
      lastCommitDate: lastCommitDate || "None",
      license: repoData ? repoData.license?.name || "None" : "None",
      user: userData ? {
        login: userData.login,
        bio: userData.bio || "None",
        followers: userData.followers,
        following: userData.following,
        avatarUrl: userData.avatar_url || "None",
        location: userData.location || "None",
      } : null,
      status: status,
      errorMessage,
    };
  },
});