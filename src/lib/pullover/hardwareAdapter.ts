import type { AnswerKey } from "./types";

/**
 * Hardware abstraction layer.
 *
 * Today: the "virtual" adapter only logs; the actual sweep is rendered by the
 * VirtualWiper components driven by game state.
 * Later: swap in a WebSocket / serial adapter that talks to the ESP32 / PLC
 * driving the real wiper motors. No game logic or UI has to change.
 */
export interface WiperCommand {
  wrongAnswers: AnswerKey[];
  /** ms the physical sweep is expected to take */
  durationMs: number;
}

export interface HardwareAdapter {
  readonly name: string;
  triggerWipers(cmd: WiperCommand): void | Promise<void>;
  park(): void | Promise<void>;
}

export const WIPE_DURATION_MS = 1500;

export const virtualAdapter: HardwareAdapter = {
  name: "virtual",
  triggerWipers({ wrongAnswers, durationMs }) {
    console.info("[hardware:virtual] WIPE", wrongAnswers.join(","), `${durationMs}ms`);
  },
  park() {
    console.info("[hardware:virtual] PARK");
  },
};

let active: HardwareAdapter = virtualAdapter;

export function setHardwareAdapter(adapter: HardwareAdapter) {
  active = adapter;
}

export function hardware(): HardwareAdapter {
  return active;
}
