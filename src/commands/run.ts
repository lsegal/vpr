import AdmZip from "adm-zip";
import clc from "cli-color";
import { InvalidArgumentError, type Command } from "commander";
import { $ } from "execa";
import inquirer from "inquirer";
import { existsSync } from "node:fs";
import fs, { rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cwd } from "node:process";
import { inspect } from "node:util";
import { default as recursiveCopy } from "recursive-copy";
import {
  repositoryDirectory,
  trackedFiles,
  untrackedFiles,
} from "~/util/git.js";
import { Logger } from "~/util/log.js";
import { spinner } from "~/util/ui.js";
const copy = recursiveCopy as unknown as (
  src: string,
  dest: string,
  options?: any
) => Promise<void>;

const OUTPUT_ARCHIVE = "rel-archive.zip";

const log = new Logger("vpr:run");

type RunOptions = {
  allowDirty: boolean;
  initialArchive: string[];
  excludeArtifact: string[];
  includeArtifact: string[];
  outputArchive: string;
  overwrite: boolean;
  write: boolean;
  continue: boolean;
  noCleanup: boolean;
};

const stdio = { stderr: process.stderr, stdout: process.stdout };

function parseInitialArchive(value: string, previous: string[]): any {
  if (!existsSync(value)) {
    throw new InvalidArgumentError(`File does not exist.`);
  }
  return previous.concat(value);
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

export function addRunCommand(program: Command): Command {
  return program
    .command("run")
    .description("Run a stage command and archive the repository")
    .passThroughOptions()
    .option("--allow-dirty", "Allow dirty repository")
    .option(
      "-i, --initial-archive <archive.zip>",
      "Archive (.zip) files to use as initial state. Disables output unless --write is provided. May be repeated.",
      parseInitialArchive,
      []
    )
    .option(
      "-c, --continue",
      `Continue next stage with default initial archive (${OUTPUT_ARCHIVE}). Disables output unless --write is provided.`
    )
    .option(
      "-o, --output-archive <filename.zip>",
      "Output .zip archive",
      OUTPUT_ARCHIVE
    )
    .option("-f, --overwrite", "Overwrite existing output archive")
    .option("-w, --write", "Write output archive to default location")
    .option(
      "--exclude-artifact <pattern>",
      "Exclude an extra pattern from the output archive (in addition to .relignore)",
      collect,
      []
    )
    .option(
      "--include-artifact <pattern>",
      "Include an extra pattern in the output archive (even if .gitignored)",
      collect,
      []
    )
    .option("--no-cleanup", "Do not cleanup temporary directory")
    .argument("<command...>", "Command to run")
    .action(run);
}

class RunCommand {
  origDir = cwd();
  initialDirty = false;

  constructor(
    private command: string[],
    private opts: RunOptions,
    private stageDir: string
  ) {}

  async run() {
    this.validateOptions();

    log.debug(`Command: ${inspect(this.command)}`);
    log.debug(`Options: ${inspect(this.opts)}`);
    this.initialDirty = false;

    if (this.opts.initialArchive.length > 0) {
      await this.stageInitialArchives();
    } else {
      await this.stageRepository();
    }

    process.chdir(this.stageDir);
    log.debug(`Running command: ${inspect(this.command)}`);
    await $(this.command[0], this.command.slice(1), {
      shell: true,
      ...stdio,
    });

    if (this.opts.outputArchive) {
      await this.createArchive();
    } else {
      log.debug(`Skipping archive creation (no output archive specified)`);
    }
  }

  async finalize() {
    process.chdir(this.origDir);
    if (this.opts.noCleanup) {
      log.info(`Leaving stage directory for inspection: ${this.stageDir}`);
    } else if (this.stageDir) {
      await rm(this.stageDir, { recursive: true });
    }
  }

  private validateOptions() {
    if (
      !this.opts.outputArchive &&
      (this.opts.overwrite || this.opts.write) &&
      existsSync(OUTPUT_ARCHIVE)
    ) {
      this.opts.outputArchive = OUTPUT_ARCHIVE;
    }

    if (this.opts.continue) {
      if (this.opts.initialArchive.length === 0) {
        this.opts.initialArchive = [OUTPUT_ARCHIVE];
      }
      if (!this.opts.write && !this.opts.overwrite) {
        this.opts.outputArchive = "";
      } else if (this.opts.write) {
        this.opts.overwrite = true;
      }
    }
  }

  private async stageInitialArchives() {
    const archives = this.opts.initialArchive;
    const { cancel } = spinner(
      `Unzipping ${archives
        .map((archive) => clc.bold(archive))
        .join(", ")} into staging directory`
    );
    try {
      await Promise.all(
        this.opts.initialArchive.map((archive) =>
          this.stageInitialArchive(archive)
        )
      );
      if (existsSync(join(this.stageDir, ".git"))) {
        await $`git -C ${this.stageDir} reset --hard`;
      }
    } finally {
      cancel();
    }
  }

  private async stageInitialArchive(archive: string) {
    const zip = new AdmZip(archive);
    log.debug(
      `Archive: ${inspect(archive)}: ${inspect(
        zip.getEntries().map((entry) => entry.entryName)
      )}`
    );
    await new Promise<void>((resolve, reject) => {
      zip.extractAllToAsync(this.stageDir, true, true, (error) =>
        error ? reject(error) : resolve()
      );
    });
  }

  private async stageRepository() {
    const repoRoot = await repositoryDirectory();
    const tracked = await trackedFiles();
    const dirty = tracked.length > 0;

    this.initialDirty = dirty;

    if (dirty && !this.opts.allowDirty) {
      throw new Error(
        "Repository is not clean, call with `--allow-dirty` to force the run."
      );
    }

    const { cancel } = spinner(
      `Staging existing repository${
        dirty ? " and files" : ""
      } to a temporary directory`
    );
    try {
      if (dirty) {
        await this.stageContents(repoRoot);
      } else {
        await this.stageContents(repoRoot, ".git");
        await $`git -C ${this.stageDir} reset --hard`;
      }
    } finally {
      cancel();
    }
  }

  private async stageContents(sourceDir: string, relative?: string) {
    const src = join(sourceDir, ...(relative ? [relative] : []));
    const dest = join(this.stageDir, ...(relative ? [relative] : []));
    log.debug(`Staging contents: ${src} -> ${dest}`);
    await copy(src, dest, {
      overwrite: true,
      dot: true,
      junk: false,
    });
  }

  private get artifactIgnorePatterns() {
    return this.opts.excludeArtifact.concat(
      this.opts.includeArtifact.map((pattern) => `!${pattern}`)
    );
  }

  private async createArchive() {
    const tracked = await trackedFiles();
    const untracked = await untrackedFiles(this.artifactIgnorePatterns);
    const dirty = tracked.length > 0;

    if (!this.initialDirty && dirty) {
      log.warn("Repository is not clean after staging");
      await $({ reject: false, ...stdio })`git status`;
    }

    const entries = [
      ...(existsSync(join(this.stageDir, ".git")) ? [".git"] : []),
      ...untracked,
    ];
    if (entries.length === 0) {
      log.warn("No files to archive");
      return;
    }

    const outputPath = join(this.origDir, this.opts.outputArchive);
    log.debug(
      `Creating output archive ${inspect(outputPath)} with: ${inspect(entries)}`
    );

    if (!this.opts.overwrite && existsSync(outputPath)) {
      const result = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `Overwrite existing ${clc.bold(this.opts.outputArchive)}?`,
          default: false,
        },
      ]);
      if (!result.overwrite) {
        log.info("Skipping archive creation, file already exists.");
        return;
      }
    }

    const zip = new AdmZip();
    await Promise.all(entries.map((entry) => this.zipEntry(zip, entry)));
    await zip.writeZipPromise(outputPath, { overwrite: true });
  }

  private async zipEntry(zip: AdmZip, entry: string) {
    const path = join(this.stageDir, entry);
    const info = await stat(path);
    try {
      if (info.isDirectory()) {
        log.debug(`Adding directory ${entry} to archive`);
        zip.addLocalFolder(path, entry);
      } else {
        log.debug(`Adding file ${entry} to archive`);
        zip.addLocalFile(path, dirname(entry));
      }
    } catch (error: any) {
      log.warn(`Failed to add ${entry} to archive: ${error.message}`);
    }
  }
}

async function run(command: string[], opts: RunOptions): Promise<void> {
  const stageDir = await fs.mkdtemp(join(tmpdir(), "vpr-stage-"));
  const cmd = new RunCommand(command, opts, stageDir);
  try {
    await cmd.run();
  } catch (error: any) {
    log.error(error);
    process.exitCode = 1;
  } finally {
    await cmd.finalize();
  }
}
