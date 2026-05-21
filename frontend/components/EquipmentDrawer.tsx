'use client';
import { useEffect, useRef, useState } from 'react';
import { Wrench } from 'lucide-react';

interface Equipment {
  id: number;
  name: string;
  category: string | null;
}

interface Props {
  equipment: Equipment[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

const ITEM_HEIGHT = 48;
const VISIBLE = 7; // must be odd

export default function EquipmentDrawer({ equipment, selected, onSelect, onClose }: Props) {
  const items = [
    { id: null as number | null, name: 'ללא סוג מוצר' },
    ...equipment.map(e => ({ id: e.id as number | null, name: e.name })),
  ];

  const initialIndex = Math.max(0, items.findIndex(i => i.id === selected));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const padding = Math.floor(VISIBLE / 2); // 3

  // Scroll to selected item on open
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initialIndex * ITEM_HEIGHT;
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    setCurrentIndex(Math.max(0, Math.min(idx, items.length - 1)));
  }

  function scrollTo(idx: number) {
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    setCurrentIndex(clamped);
    scrollRef.current?.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
  }

  function confirm() {
    onSelect(items[currentIndex]?.id ?? null);
    onClose();
  }

  const containerH = VISIBLE * ITEM_HEIGHT;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 100,
          animation: 'fadein 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderRadius: '20px 20px 0 0',
        animation: 'slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--border)' }} />
        </div>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 20px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontWeight: 600, fontSize: '0.95rem' }}>
            ביטול
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Wrench size={17} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>סוג מוצר</span>
          </div>
          <button onClick={confirm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem' }}>
            בחר
          </button>
        </div>

        {/* ── Drum-roll wheel ── */}
        <div style={{ position: 'relative', height: containerH, overflow: 'hidden', userSelect: 'none' }}>

          {/* Center highlight band */}
          <div style={{
            position: 'absolute', left: 16, right: 16,
            top: padding * ITEM_HEIGHT,
            height: ITEM_HEIGHT,
            background: 'rgba(59,130,246,0.13)',
            borderTop: '1.5px solid rgba(59,130,246,0.4)',
            borderBottom: '1.5px solid rgba(59,130,246,0.4)',
            pointerEvents: 'none', zIndex: 2,
            borderRadius: 6,
          }} />

          {/* Fade — top */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: padding * ITEM_HEIGHT,
            background: 'linear-gradient(to bottom, var(--surface) 10%, rgba(0,0,0,0))',
            pointerEvents: 'none', zIndex: 3,
          }} />

          {/* Fade — bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: padding * ITEM_HEIGHT,
            background: 'linear-gradient(to top, var(--surface) 10%, rgba(0,0,0,0))',
            pointerEvents: 'none', zIndex: 3,
          }} />

          {/* Scroll container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              height: '100%',
              overflowY: 'scroll',
              scrollSnapType: 'y mandatory',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              paddingTop: padding * ITEM_HEIGHT,
              paddingBottom: padding * ITEM_HEIGHT,
            } as React.CSSProperties}
          >
            {items.map((item, idx) => {
              const dist = Math.abs(idx - currentIndex);
              const opacity = dist === 0 ? 1 : dist === 1 ? 0.52 : dist === 2 ? 0.25 : 0.08;
              const scale   = dist === 0 ? 1 : dist === 1 ? 0.88 : 0.78;
              const rotateX = dist === 0 ? 0 : dist === 1 ? 24 : dist === 2 ? 42 : 58;
              const sign    = idx < currentIndex ? 1 : -1;

              return (
                <div
                  key={String(item.id)}
                  onClick={() => scrollTo(idx)}
                  style={{
                    height: ITEM_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    scrollSnapAlign: 'center',
                    cursor: 'pointer',
                    fontSize: dist === 0 ? '1.1rem' : '0.93rem',
                    fontWeight: dist === 0 ? 700 : 400,
                    color: dist === 0 ? 'var(--primary)' : 'var(--text)',
                    opacity,
                    transform: `perspective(280px) rotateX(${sign * rotateX}deg) scale(${scale})`,
                    transition: 'all 0.1s ease',
                  }}
                >
                  {item.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm button */}
        <div style={{ padding: '12px 20px 28px' }}>
          <button
            onClick={confirm}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 14,
              background: 'var(--primary)', color: 'white',
              border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '1rem',
              boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
            }}
          >
            {items[currentIndex]?.name ?? 'ללא סוג מוצר'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadein  { from { opacity: 0; } to { opacity: 1; } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
