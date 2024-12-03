/* eslint-disable @typescript-eslint/no-unsafe-argument */
import clc from "cli-color";
import { default as createDebug } from "debug";

export class Logger {
  private debugLogger: ReturnType<typeof createDebug>;

  constructor(name: string) {
    this.debugLogger = createDebug(name);
  }

  info(...args: Parameters<typeof console.log>): void {
    console.log(...args);
  }

  debug(message: string): void {
    this.debugLogger(message);
  }

  warn(message: string): void {
    console.warn(clc.yellow(`⚠️ ${message}`));
  }

  error(obj: any): void {
    if (obj.exitCode) {
      this._error(
        `Command failed with exit code ${obj.exitCode}: ${obj.message}`
      );
      this.debug(obj);
    } else if (obj.message) {
      this._error(obj.message);
      this.debug(obj);
    } else {
      this._error(obj);
    }
  }

  private _error(message: string): void {
    console.error(clc.red(`❌ ${message}`));
  }
}
