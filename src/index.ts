import readline from 'node:readline';
import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process';

interface InputLogger {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
}

interface InputManagerOptions {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  logger?: InputLogger;
}

interface YesNoPromptOptions {
  defaultValue?: boolean;
}

interface TextPromptOptions {
  defaultValue?: string;
  allowEmpty?: boolean;
}

export interface ManualControlHandlers {
  onExit: () => void;
  onAdvance: () => void | Promise<void>;
}

export class InputManager {
  private readonly stdin: NodeJS.ReadStream | null;
  private readonly stdout: NodeJS.WriteStream | null;
  private readonly logger: InputLogger | undefined;
  private rawInputHandler: ((data: Buffer) => void) | null = null;
  private rawModeEnabled = false;

  constructor(options: InputManagerOptions = {}) {
    this.stdin = options.stdin ?? defaultStdin ?? null;
    this.stdout = options.stdout ?? defaultStdout ?? null;
    this.logger = options.logger;
  }

  /**
   * Checks whether interactive input is available.
   */
  public isInteractive(): boolean {
    return Boolean(this.stdin?.isTTY && this.stdout);
  }

  /**
   * Prompt the user for a yes/no answer. If no TTY is available and no default
   * is provided, an error is thrown to avoid silent fallbacks.
   */
  public async promptYesNo(
    question: string,
    options: YesNoPromptOptions = {}
  ): Promise<boolean> {
    if (!this.isInteractive()) {
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }

      throw new Error('TTY input is not available for yes/no prompt.');
    }

    const stdin = this.stdin;
    const stdout = this.stdout;

    if (!stdin || !stdout) {
      throw new Error('TTY input is not available for yes/no prompt.');
    }

    const trimmedQuestion = question.trim().replace(/\s+$/, '');
    const promptText = `${trimmedQuestion} (y/n): `;

    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });

    try {
      while (true) {
        const answer = await new Promise<string>(resolve =>
          rl.question(promptText, resolve)
        );
        const normalized = answer.trim().toLowerCase();

        if (normalized === '' && options.defaultValue !== undefined) {
          return options.defaultValue;
        }

        if (normalized === 'y' || normalized === 'yes') {
          return true;
        }

        if (normalized === 'n' || normalized === 'no') {
          return false;
        }

        this.logger?.warn?.('Please answer with y or n.');
      }
    } finally {
      rl.close();
    }
  }

  /**
   * Prompt the user for free text input. If no TTY is available and no default
   * is provided, an error is thrown to avoid silent fallbacks.
   */
  public async promptText(
    question: string,
    options: TextPromptOptions = {}
  ): Promise<string> {
    if (!this.isInteractive()) {
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }

      throw new Error('TTY input is not available for text prompt.');
    }

    const stdin = this.stdin;
    const stdout = this.stdout;

    if (!stdin || !stdout) {
      throw new Error('TTY input is not available for text prompt.');
    }

    const promptText = question.trim().replace(/\s*$/, ': ');
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });

    try {
      while (true) {
        const answer = await new Promise<string>(resolve =>
          rl.question(promptText, resolve)
        );
        const trimmed = answer.trim();

        if (trimmed.length === 0) {
          if (options.defaultValue !== undefined) {
            return options.defaultValue;
          }

          if (options.allowEmpty) {
            return '';
          }

          this.logger?.warn?.('Input cannot be empty.');
          continue;
        }

        return trimmed;
      }
    } finally {
      rl.close();
    }
  }

  /**
   * Attach a raw key handler for TTY environments. Returns true if attached.
   */
  public enableRawMode(handler: (key: string) => void): boolean {
    if (!this.stdin?.isTTY) {
      return false;
    }

    try {
      this.stdin.setRawMode?.(true);
      this.stdin.resume();
      this.rawModeEnabled = true;
    } catch (error) {
      this.logger?.error?.('Failed to enable raw mode input:', error);
      return false;
    }

    this.rawInputHandler = (data: Buffer) => {
      handler(data.toString());
    };

    this.stdin.on('data', this.rawInputHandler);
    return true;
  }

  /**
   * Detach any active raw key handler and restore stdin.
   */
  public disableRawMode(): void {
    if (!this.stdin) {
      return;
    }

    if (this.rawInputHandler) {
      this.stdin.off('data', this.rawInputHandler);
      this.rawInputHandler = null;
    }

    if (this.rawModeEnabled) {
      try {
        this.stdin.setRawMode?.(false);
        this.stdin.pause();
      } catch (error) {
        this.logger?.warn?.('Failed to disable raw mode cleanly:', error);
      }

      this.rawModeEnabled = false;
    }
  }
}

/**
 * Higher-level helper to bind common manual controls (advance turn, exit)
 * using InputManager's raw mode handling.
 */
export class GameInputController {
  private readonly inputManager: InputManager;

  constructor(inputManager?: InputManager) {
    this.inputManager = inputManager ?? new InputManager();
  }

  public attachManualControls(handlers: ManualControlHandlers): boolean {
    return this.inputManager.enableRawMode(key => {
      if (key === '\u001b') {
        handlers.onExit();
        return;
      }

      if (key === '\r' || key === '\n') {
        void handlers.onAdvance();
      }
    });
  }

  public detachManualControls(): void {
    this.inputManager.disableRawMode();
  }
}
