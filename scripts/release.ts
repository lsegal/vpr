import { $ } from "execa";
import { readFile } from "node:fs/promises";

const pkgData = await readFile("package.json");
const pkg = JSON.parse(pkgData.toString()) as {
  name: string;
  version: string;
};
const pkgfile = `${pkg.name}-v${pkg.version}.tgz`;

const opts = { shell: true, stderr: process.stderr, stdout: process.stdout };
await $(opts)`yarn publish --non-interactive ${pkgfile}`;
await $(opts)`git push origin main v${pkg.version}`;
await $(opts)`gh release create --generate-notes v${pkg.version} ${pkgfile}`;
