import { memo } from 'react';

const BLOBS = [
  { className: '-top-48 -left-48 h-[500px] w-[500px] bg-[#e0d5f0] opacity-35 blur-[120px]' },
  { className: '-bottom-40 -right-40 h-[450px] w-[450px] bg-[#f0ddd5] opacity-35 blur-[120px]' },
  { className: 'top-1/3 -right-32 h-[350px] w-[350px] bg-[#d5e8f0] opacity-30 blur-[120px]' },
  { className: 'top-2/3 left-1/4 h-[250px] w-[250px] bg-[#e8dde8] opacity-25 blur-[100px]' },
];

const BLOB_PAIRS = [
  { className: 'top-1/4 left-1/3 h-[200px] w-[200px] bg-[#dde0f0] opacity-20 blur-[80px]' },
  { className: 'bottom-1/3 right-1/5 h-[180px] w-[180px] bg-[#f0e0dd] opacity-20 blur-[80px]' },
];

function MeshBackground() {
  return (
    <div className="noise-overlay fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Primary mesh gradient blobs */}
      {BLOBS.map((blob, i) => (
        <div
          key={`blob-${i}`}
          className={`absolute rounded-full ${blob.className}`}
          style={{ willChange: 'transform' }}
        />
      ))}

      {/* Secondary subtle blobs for depth */}
      {BLOB_PAIRS.map((blob, i) => (
        <div
          key={`sub-${i}`}
          className={`absolute rounded-full ${blob.className}`}
          style={{ willChange: 'transform' }}
        />
      ))}

      {/* Extra depth layer — a very faint radial gradient over everything */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 30%, rgba(45,43,85,0.3) 0%, transparent 100%), radial-gradient(ellipse 60% 50% at 80% 70%, rgba(98,95,154,0.2) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

export default memo(MeshBackground);
