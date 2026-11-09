// Slice 102 — ProofCaption (Uncopyable Set, part 5). The
// shared receipt line for counted surfaces: every figure a
// panel shows gets a caption naming the records it was counted
// from. A number without a receipt is a claim; a number with
// one is evidence. Captions state only what the loaders
// actually do — each was checked against its loader before
// being written.

export default function ProofCaption({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>🧾 {children}</p>
  );
}
