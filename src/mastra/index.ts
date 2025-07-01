import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/weather-agent"; // This can be deleted later
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow"; // This can be deleted later
import { githubReporterAgent } from "./agents/github-reporter-agent/github-reporter";
import { githubWorkflow } from "./agents/github-reporter-agent/github-workflow";

export const mastra = new Mastra({
	workflows: { weatherWorkflow, githubWorkflow }, // can be deleted later
	agents: { weatherAgent, githubReporterAgent },
	logger: new PinoLogger({
		name: "Mastra",
		level: "info",
	}),
	server: {
		port: 8080,
		timeout: 10000,
	},
});
