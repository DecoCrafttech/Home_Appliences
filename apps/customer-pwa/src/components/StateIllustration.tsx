import type { EmptyStateKind } from "@home/ui";

/** Lightweight line illustrations for customer empty and recovery states. */
export function StateIllustration({ kind }: { kind: EmptyStateKind }) {
  const auth = kind === "auth";
  const network = kind === "network";
  const requests = ["requests", "completed", "booking"].includes(kind);
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden="true" focusable="false">
      <circle cx="100" cy="79" r="65" fill="#f3f0ff" />
      <g
        stroke="#8b7cf8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 131h156M32 137h17m103 0h12" stroke="#c9c1ff" />
        <path d="M31 61h6m-3-3v6m130-24h6m-3-3v6" stroke="#c9c1ff" />
        {auth ? (
          <>
            <rect x="53" y="46" width="94" height="69" rx="8" fill="white" />
            <path d="M53 101h94m-56 14-4 13h26l-4-13" />
            <circle cx="92" cy="70" r="10" fill="#ede9ff" />
            <path d="M74 94c2-14 34-14 36 0" />
            <rect x="119" y="78" width="27" height="28" rx="6" fill="#fff9e8" />
            <path d="M125 78v-6a8 8 0 0 1 16 0v6m-8 12v5" />
            <path d="m89 29 7 7 14-15" />
          </>
        ) : network ? (
          <>
            <rect x="52" y="57" width="96" height="63" rx="8" fill="white" />
            <path d="M52 107h96m-58 13-3 10h26l-3-10M77 41a39 39 0 0 1 47 0m-37 9a23 23 0 0 1 27 0" />
            <path d="m92 78 16 16m0-16L92 94" stroke="#a39acb" />
            <circle cx="101" cy="58" r="2" fill="#8b7cf8" />
          </>
        ) : requests ? (
          <>
            <rect x="66" y="37" width="72" height="91" rx="8" fill="white" />
            <rect x="85" y="29" width="34" height="17" rx="5" fill="#ede9ff" />
            <path d="M81 65h40M81 79h28M81 93h20" stroke="#c9c1ff" />
            <circle cx="132" cy="114" r="21" fill="#fff9e8" />
            {kind === "completed" ? (
              <path d="m122 114 7 7 13-14" />
            ) : (
              <path d="M124 114h16m-8-8v16" />
            )}
          </>
        ) : (
          <>
            <path
              d="M53 66a7 7 0 0 1 7-7h31l8 9h41a7 7 0 0 1 7 7v43a7 7 0 0 1-7 7H60a7 7 0 0 1-7-7Z"
              fill="white"
            />
            <path d="M88 29v21m-9-9 9 9 9-9" />
            <circle cx="104" cy="91" r="15" fill="#ede9ff" />
            <path d="m115 102 13 13" />
          </>
        )}
      </g>
      <circle cx="39" cy="99" r="3" fill="#ffdb78" />
      <circle cx="157" cy="69" r="3" fill="#d5cdff" />
    </svg>
  );
}
