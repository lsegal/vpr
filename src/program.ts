import { Command, Option } from "commander";
import { addReleaseCommitCommand } from "~/commands/release-commit.js";
import { addRunCommand } from "~/commands/run.js";
import { Logger } from "~/util/log.js";
import { default as pkg } from "../package.json" assert { type: "json" };

const log = new Logger("vpr:program");

export function program() {
  const cmd = new Command();
  cmd
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version)
    .enablePositionalOptions()
    .configureHelp({
      visibleOptions: (cmd) => (cmd.parent ? cmd.options : []) as Option[],
    })
    .configureOutput({
      writeOut: (str) => log.info(str),
      writeErr: (str) => log.info(str),
      outputError: (str) => log.error(str),
    });

  addRunCommand(cmd);
  addReleaseCommitCommand(cmd);

  return cmd;
}
