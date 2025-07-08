import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { githubReporterAgent } from "./agents/github-reporter-agent/github-reporter";
import { githubWorkflow } from "./agents/github-reporter-agent/github-workflow";


export const mastra = new Mastra({
	workflows: {githubWorkflow}, // can be deleted later
	agents: { githubReporterAgent},
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
