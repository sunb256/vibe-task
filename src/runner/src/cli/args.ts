export type CliArgs = {
  configPath: string;
  taskProjectName?: string;
  hasTaskProjectOption: boolean;
  verbose: boolean;
  showHelp: boolean;
};

const DEFAULT_CONFIG_PATH = "config/config.yml";
const CONFIG_OPTION_NAME = "--config";
const CONFIG_SHORT_OPTION_NAME = "-c";
const TASK_OPTION_NAME = "--task";
const TASK_SHORT_OPTION_NAME = "-t";
const HELP_OPTION_NAME = "--help";
const HELP_SHORT_OPTION_NAME = "-h";
const VERBOSE_OPTION_NAME = "--verbose";

// 設定ファイル引数として有効な値だけを返す。
function getConfigValue(value: string | undefined): string | undefined {
  if (!value || value.startsWith("-")) {
    return undefined;
  }
  return value;
}

export function buildUsageText(): string {
  return [
    "Usage: npx tsx src/run.ts [-c <config>] [-t <project>] [--verbose] [-h]",
    "",
    "Options:",
    "  -c, --config <path>    config file path (default: config/config.yml)",
    "  -t, --task <project>   use ../../tasks/projects/<project>/runner.yml",
    "      --verbose          enable verbose event logs",
    "  -h, --help             show this help",
  ].join("\n");
}

export function hasHelpOption(args: string[]): boolean {
  return args.includes(HELP_SHORT_OPTION_NAME) || args.includes(HELP_OPTION_NAME);
}

export function isUsageError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.startsWith("Unsupported option:") ||
    error.message.startsWith("Positional arguments are not supported:") ||
    error.message.includes("option requires")
  );
}

export function parseCliArgs(args: string[]): CliArgs {
  if (hasHelpOption(args)) {
    return {
      configPath: DEFAULT_CONFIG_PATH,
      hasTaskProjectOption: false,
      verbose: false,
      showHelp: true,
    };
  }

  let configPath = DEFAULT_CONFIG_PATH;
  let taskProjectName: string | undefined;
  let hasTaskProjectOption = false;
  let verbose = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith(`${CONFIG_OPTION_NAME}=`)) {
      const value = getConfigValue(arg.split("=")[1]);
      if (!value) throw new Error(`${CONFIG_OPTION_NAME} option requires a path`);
      configPath = value;
      continue;
    }
    if (arg === CONFIG_OPTION_NAME || arg === CONFIG_SHORT_OPTION_NAME) {
      const value = getConfigValue(args[i + 1]);
      if (!value) throw new Error(`${arg} option requires a path`);
      configPath = value;
      i += 1;
      continue;
    }
    if (arg.startsWith(`${TASK_OPTION_NAME}=`)) {
      const value = getConfigValue(arg.split("=")[1]);
      if (!value) throw new Error(`${TASK_OPTION_NAME} option requires a project name`);
      taskProjectName = value;
      hasTaskProjectOption = true;
      continue;
    }
    if (arg === TASK_OPTION_NAME || arg === TASK_SHORT_OPTION_NAME) {
      const value = getConfigValue(args[i + 1]);
      if (!value) throw new Error(`${arg} option requires a project name`);
      taskProjectName = value;
      hasTaskProjectOption = true;
      i += 1;
      continue;
    }
    if (arg === VERBOSE_OPTION_NAME) {
      verbose = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unsupported option: ${arg}`);
    }
    throw new Error(`Positional arguments are not supported: ${arg}`);
  }

  return {
    configPath,
    taskProjectName,
    hasTaskProjectOption,
    verbose,
    showHelp: false,
  };
}

// CLI引数から設定ファイルパスを抽出する。
export function parseConfigPathOption(args: string[]): string {
  return parseCliArgs(args).configPath;
}
