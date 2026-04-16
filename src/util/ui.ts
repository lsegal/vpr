import ora from "ora";

export function spinner(message: string) {
  const spinner = ora({
    prefixText: `⏳ ${message}`,
    spinner: "simpleDots",
  }).start();
  return { cancel: () => spinner.stopAndPersist({ symbol: "..." }) };
}
