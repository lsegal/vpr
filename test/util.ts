import type { Command } from "commander";
import { program } from "~/program.js";

export type CommandResult = {
  stdout: string;
  stderr: string;
  program: Command;
};

export function mockProgram(): CommandResult {
  const output = {
    stdout: "",
    stderr: "",
  } as CommandResult;
  output.program = program()
    .exitOverride()
    .configureOutput({
      writeOut: (str) => (output.stdout += str),
      writeErr: (str) => (output.stderr += str),
    });
  return output;
}
