import type { Command } from "commander";
import { $ } from "execa";
import { Logger } from "~/util/log.js";

const log = new Logger("vpr:release-commit");
const stdio = { stderr: process.stderr, stdout: process.stdout };

type ReleaseCommitOptions = {
  dryRun: boolean;
  issueMatch: string;
  tag: boolean;
  tagCommit: boolean;
};

export function addReleaseCommitCommand(program: Command): Command {
  return program
    .command("release-commit")
    .description("Generates a release commit for the version")
    .option(
      "--issue-match <regex>",
      "regular expression of a matching issue number",
      "(#\\d+)"
    )
    .option("--tag-commit", "Generate a tag commit (annotated tag)")
    .option("--no-tag", "Do not tag version")
    .option("--dry-run", "Print the message without performing the commit")
    .argument("<version>", "the release version")
    .action(run);
}

async function collectIssues(issueMatch: string): Promise<string[]> {
  let lastTag = "";
  try {
    lastTag = (await $`git describe --tags --abbrev=0`).stdout
      .toString()
      .trim();
  } catch {
    lastTag = (await $`git rev-list --max-parents=0 @`).stdout
      .toString()
      .trim();
  }
  const result = await $`git log --all --format=%B ${lastTag}..@`;
  const matches = result.stdout
    .toString()
    .matchAll(new RegExp(issueMatch, "gi"));

  const list = [];
  for (const match of matches) {
    list.push(match[1] || match[0]);
  }
  return list;
}

class ReleaseCommitCommand {
  constructor(private version: string, private opts: ReleaseCommitOptions) {}

  async run() {
    const tag = `v${this.version.replace(/^v/, "")}`;
    let message = `Release: ${tag}`;

    const issues = await collectIssues(this.opts.issueMatch);
    if (issues.length > 0) {
      message += `\n\nReferences: ${issues.join(", ")}`;
    }

    const command = this.opts.dryRun ? "echo" : "git";
    if (this.opts.dryRun) log.info("COMMIT:", message);

    if (this.opts.tagCommit) {
      await $({ input: message, ...stdio })`${command} tag -a -F - ${tag}`;
    } else {
      await $({ input: message, ...stdio })`${command} commit -F -`;
      if (this.opts.tag) await $({ ...stdio })`${command} tag ${tag}`;
    }
  }

  async finalize() {}
}

async function run(version: string, opts: ReleaseCommitOptions): Promise<void> {
  const cmd = new ReleaseCommitCommand(version, opts);
  try {
    await cmd.run();
  } catch (error: any) {
    log.error(error);
  } finally {
    await cmd.finalize();
  }
}
