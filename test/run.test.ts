import { describe, expect, test } from "vitest";
import { mockProgram } from "./util.js";

describe("run", () => {
  test("run --help", async () => {
    const result = mockProgram();
    await expect(result.program.parseAsync(["run"])).rejects.toThrowError();
  });
});
