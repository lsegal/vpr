import { $ } from "execa";
import { existsSync } from "node:fs";
import { join } from "node:path";

const GITIGNORE = ".gitignore";
const RELIGNORE = ".relignore";

export async function repositoryDirectory(): Promise<string> {
  return (await $`git rev-parse --show-toplevel`).stdout.trim();
}

export async function trackedFiles(): Promise<string[]> {
  const status = await $({ lines: true })`git status --porcelain`;
  return status.stdout
    .filter((line) => line.length > 0 && !line.startsWith("?? "))
    .map((line) => line.split(" ").at(-1) ?? "");
}

export async function untrackedFiles(
  ignorePatterns: string[] = []
): Promise<string[]> {
  const repoDir = await repositoryDirectory();
  const gitignore = join(repoDir, GITIGNORE);
  const relignore = join(repoDir, RELIGNORE);
  const lsFiles = await $(
    "git",
    [
      "ls-files",
      "--others",
      "--directory",
      ...(existsSync(gitignore) ? ["-X", gitignore] : []),
      ...(existsSync(relignore) ? ["-X", relignore] : []),
      ...ignorePatterns.flatMap((pattern) => ["-x", pattern]),
    ],
    { lines: true }
  );
  return lsFiles.stdout
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\/$/, ""));
}
