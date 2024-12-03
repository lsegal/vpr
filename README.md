# ✌️ vpr

vpr is a **v**ersioned **p**ackage **r**elease tool for managing and staging releases of packages in a git repository.
**vpr** stage your release within an isolated copy of your repository, retaining all generated artifacts and git
history. The process is also compatible with job based CI pipelines that support artifact outputs without relying on the
CI system itself to manage the release, meaning that **vpr releases can be built, staged, and validated locally**.

## 📃 Requirements

To run `vpr` you need:

- A git repository _(more VCS systems may be supported in the future)_,
- Something to release (package, library, command line tool),
- _That's it!_

## 💽 Installation

```sh
npm install -g vpr
```

Or use `npx`:

```sh
npx vpr help
```

## 👋 Getting Started

Using `vpr` usually involves two stages, a **prepare** stage and a **release** stage.

1. In the **prepare** stage, you run your tests, run any build commands to generate release artifacts, and make updates
   to your repository as needed, typically in the form of commits and a version tag.

2. In the **release** stage, you (optionally) validate your package and run the remaining release command(s) to push
   your release to a package registry, deploy to a server, or publish a release on GitHub. Because the assets are all
   staged in one single archive without making any modifications to repository state, this process is portable and
   repeatable, as well as discardable if a validation step fails.

Although these two stages are the typical workflow, **vpr** abstracts away from any specific workflow and simply allows
you to run a set of commands in the context of your previous "staged" release. In practice, this means you can have
5, 6, or even 10 stages prior to the final step, if you need to run a complex release process. For example, CI workflows
that build artifacts against multiple platforms might use **vpr** to stage the release artifacts for each platform.

### 🍳 Preparing a Release

Generally you would run `npx vpr run <prepare_command>` like:

```sh
npx vpr run make build git-tag
```

The above command will:

1. Create a temporary directory to stage the release,
2. Clone the current repository into the temporary directory,
3. Run `make build git-tag` in the temporary directory, which in this example will build your artifacts and tag the
   repository with the new version.
4. Archive the staged changes into a zip archive (`rel-archive.zip`) in the original working directory which includes
   the git repository and any generated artifacts.

> [!TIP]
> You can use `--overwrite` (alias: `-f`) to avoid the confirmation prompt when overwriting an existing archive.

This archive can be inspected manually to verify the contents at any time. The modifications to the repository and any
generated artifacts will live only in the staged package archive (`rel-archive.zip`) and thus will have no effect on
your workspace until you decide to release the staged package.
**If something goes wrong, you can simply delete the staged package and start over.**

### 🚀 Releasing a ...Release

Now that you have your packaged artifacts (including git repository) staged in `rel-archive.zip`, you can release it
using the same `vpr run` command, passing the artifact archive as your stage directory. You can combine multiple
archives into one staged directory, but in this case we only use one:

```sh
npx vpr run --continue make validate publish
```

> [!TIP]
> The `--continue` (alias: `-c`) option above is shorthand for `--initial-archive rel-archive.zip`.

The above command will:

1. Create a temporary directory to stage the release with the contents of `rel-archive.zip`,
2. Run `make validate publish` in the temporary directory, which in this example will validate the release and publish
   the artifacts to a package registry, including running `git push origin main --tags` to push the new tag to the
   repository.

## 🤔 Why **vpr**?

_The problem is simple_: most modern release processes rely heavily on GitHub Actions, or other CI systems to manage
the actual release. While this might be a very hands-off approach and wonderful when it works, it can also be nearly
impossible to test and debug locally, causing scenarios where a release might be completely broken and blocked due to CI
issues that require multiple commits to fix and test... _and then fix and test because the job failed again_,
_and then fix and test because the job failed again_. Tools like [act](https://github.com/nektos/act) can help in
some cases, but come with plenty of caveats and limitations.

**vpr** abstracts the problem by allowing you to stage your release in a way that is portable and repeatable within your
own existing development environment and workflow. It works _with_ your CI system by building the release process on top
rather than using your CI as the release tool. This means that you can develop locally, test locally, and release
locally, and, when everything works, migrate those changes to CI.

**vpr** is a spiritual successor to [**samus**](https://github.com/lsegal/samus) but without the strict and rigid
manifest system that can make it hard to get started without prior tool knowledge. **vpr** abstracts only the repository
staging portion of samus and leaves the remaining execution flow up to the user to define. This makes **vpr** more
flexible in cases where a release might have multiple non-standard release steps (uploading assets to S3, creating some
release announcement somewhere other than GitHub, etc.).

## ⚙️ Advanced Usage

### Ignoring and Un-ignoring Artifacts from the Output Archive (`.relignore`)

By default, **vpr** will archive all files generated during the `run` command that are not ignored by git. In other words,
any "untracked" files will be included in the staged archive. This means that if you `vpr run touch tmpfile`, the `tmpfile`
will be included in the staged archive.

If you want to ignore a specific file from the staged archive, you can either add it to your `.gitignore` file, or, if
you only want it ignored from **vpr**, you can add it to a separate `.relignore` file.

#### `.relignore` Syntax

The `.relignore` file uses the same syntax as `.gitignore` and is located in the root of your repository. For example:

```sh
# .relignore
tmpfile
!importantfile
```

This will ignore the `tmpfile` but include the `importantfile` in the staged archive (if it was created).

#### Un-ignoring Ignored Files

Occasionally you will have compiled assets ignored by git that you want to include in the staged archive. You can
un-ignore these files by adding them to the `.relignore` file prefixed with an exclamation mark `!`. For example:

```sh
# .relignore
!dist/
!target/release/my-binary*
```

This will include the `dist/` directory and any files matching `target/release/my-binary*` in the staged archive.

### Generating Release Commit Messages and Tags

**vpr** also comes with a helpful `vpr release-commit` command to collect GitHub issues into a single release commit:

```sh
npx vpr release-commit 1.2.0
```

The above will run a `git commit` and `git tag v1.2.0` with a commit message that includes all issues closed since the
last release tag in the form:

```text
Release v1.2.0

References: #123, #124, #125
```

You can use this command from within your prepare stage to generate a release commit message and tag for your release:

```sh
npx vpr run npx vpr release-commit v1.2.0
```

**TODO**: This command will eventually generate a full changelog capable of being used in a GitHub release (or equivalent).

## 📖 License & Author

**vpr** was created by <ins>Loren Segal</ins> and is licensed under the <ins>MIT License</ins>. See [LICENSE](LICENSE) for more information.
