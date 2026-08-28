interface VirtualWiperProps {
  /** restart key so the sweep replays on every trigger */
  seq: number;
  active: boolean;
}

/**
 * Virtual stand-in for one physical windshield wiper covering a single answer
 * lane. When real motors are wired in, hardwareAdapter drives them and this
 * component can simply be hidden on the program output.
 */
export function VirtualWiper({ seq, active }: VirtualWiperProps) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* wet smear behind the blade */}
      <div
        key={`smear-${seq}`}
        className="po-smear absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(100deg, oklch(1 0 0 / 10%) 0 6px, transparent 6px 18px)",
        }}
      />
      {/* blade + arm, pivoting from the bottom center like a real wiper */}
      <div
        key={`blade-${seq}`}
        className="po-blade absolute bottom-0 left-1/2 origin-bottom"
        style={{ height: "150%", width: "14px", marginLeft: "-7px" }}
      >
        {/* arm */}
        <div
          className="absolute bottom-0 left-1/2 h-full w-[6px] -translate-x-1/2 rounded-full"
          style={{
            background: "linear-gradient(180deg, oklch(0.62 0 0), oklch(0.32 0 0))",
            boxShadow: "0 0 12px oklch(0 0 0 / 60%)",
          }}
        />
        {/* pivot */}
        <div
          className="absolute bottom-[-10px] left-1/2 h-6 w-6 -translate-x-1/2 rounded-full"
          style={{ background: "linear-gradient(180deg, oklch(0.5 0 0), oklch(0.2 0 0))" }}
        />
        {/* rubber blade */}
        <div
          className="absolute left-1/2 top-[6%] h-[74%] w-[13px] -translate-x-1/2 rounded-sm"
          style={{
            background: "linear-gradient(90deg, oklch(0.1 0 0), oklch(0.28 0 0), oklch(0.08 0 0))",
            boxShadow: "0 0 24px oklch(0 0 0 / 70%)",
          }}
        />
      </div>
    </div>
  );
}
