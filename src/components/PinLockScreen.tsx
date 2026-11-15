import React, { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { sha256Pin } from '../lib/format';

export function PinLockScreen() {
  const { settings, unlockApp } = useFinance();
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (digits.length !== 4) return;
    let active = true;
    (async () => {
      const hashed = await sha256Pin(digits);
      if (!active) return;
      if (hashed === settings.pinCodeHash) {
        setDigits('');
        unlockApp();
      } else {
        setShake(true);
        setTimeout(() => {
          if (active) {
            setDigits('');
            setShake(false);
          }
        }, 450);
      }
    })();
    return () => {
      active = false;
    };
  }, [digits, settings.pinCodeHash, unlockApp]);

  const pressDigit = (d: string) => {
    if (digits.length < 4) setDigits((prev) => prev + d);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-emerald-300" />
      </div>
      <h1 className="text-xl font-extrabold tracking-tight">Siki Budget</h1>
      <p className="text-xs text-slate-400 mt-1">Inserisci il tuo PIN a 4 cifre</p>

      {/* 4 Dots */}
      <div
        className={`flex items-center gap-4 my-8 transition-transform ${
          shake ? 'translate-x-2 text-rose-400' : ''
        }`}
      >
        {[0, 1, 2, 3].map((idx) => {
          const filled = digits.length > idx;
          return (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all ${
                shake
                  ? 'bg-rose-500 scale-110'
                  : filled
                  ? 'bg-amber-400 scale-110'
                  : 'bg-white/20'
              }`}
            />
          );
        })}
      </div>

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pressDigit(n)}
            className="h-16 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-2xl font-bold flex items-center justify-center transition"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => pressDigit('0')}
          className="h-16 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-2xl font-bold flex items-center justify-center transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setDigits((d) => d.slice(0, -1))}
          className="h-16 rounded-full hover:bg-white/10 active:scale-95 flex items-center justify-center transition"
        >
          <Delete className="w-6 h-6 text-slate-300" />
        </button>
      </div>
    </div>
  );
}
