import { $ } from "execa";
import { existsSync } from "node:fs";

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

export async function untrackedFiles(): Promise<string[]> {
  const lsFiles = await $(
    "git",
    [
      "ls-files",
      "--others",
      "--directory",
      ...(existsSync(GITIGNORE) ? ["-X", GITIGNORE] : []),
      ...(existsSync(RELIGNORE) ? ["-X", RELIGNORE] : []),
    ],
    { lines: true }
  );
  return lsFiles.stdout
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\/$/, ""));
}
