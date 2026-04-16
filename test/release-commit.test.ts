import { describe, test } from "vitest";
import { mockProgram } from "./util.js";

describe("release-commit", () => {
  test("release-commit --dry-run", async () => {
    const result = mockProgram();
    await result.program.parseAsync([
      "_",
      "__",
      "release-commit",
      "--dry-run",
      "v1.0.0",
    ]);
  });
});
