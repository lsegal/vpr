import { $ } from "execa";
import { readFile } from "fs/promises";

const opts = { shell: true, stderr: process.stderr, stdout: process.stdout };
await $(opts)`npm version ${
  process.env.VERSION || "minor"
} --no-commit-hooks --no-git-tag-version`;

const pkgData = await readFile("package.json");
const pkg = JSON.parse(pkgData.toString()) as { version: string };
const ver = pkg.version;
await $(opts)`git add . && git status`;
await $(opts)`yarn test && yarn build && yarn pack`;
await $(opts)`node dist/index.js release-commit ${ver}`;
await $(opts)`git --no-pager show`;
