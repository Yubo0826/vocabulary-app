/**
 * 複習完成時的 🎉：彈出放大，同時往外噴出彩帶再落下（純 CSS，關鍵影格在 globals.css）。
 * 彩帶的方向、距離、顏色由索引算出固定值，伺服器與瀏覽器渲染結果一致；系統設定「減少動態效果」時不播。
 */
const PIECES = 28;
const COLORS = ["bg-primary", "bg-amber-400", "bg-pink-400", "bg-sky-400", "bg-emerald-400"];

const pieces = Array.from({ length: PIECES }, (_, i) => {
  const t = i / (PIECES - 1) - 0.5; // -0.5 ~ 0.5，左右散開
  return {
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
    style: {
      "--x": `${Math.round(t * 320 + ((i * 37) % 40) - 20)}px`,
      "--up": `${-(70 + ((i * 53) % 60))}px`,
      "--down": `${110 + ((i * 71) % 90)}px`,
      "--r": `${((i * 97) % 720) - 360}deg`,
      animation: `confetti-burst ${1100 + ((i * 29) % 500)}ms ${(i * 13) % 120}ms both`,
    } as React.CSSProperties,
  };
});

export function Celebration() {
  return (
    <span className="relative inline-block">
      <span className="inline-block motion-safe:animate-[celebrate-pop_600ms_ease-out_both]" aria-hidden>
        🎉
      </span>
      <span className="pointer-events-none absolute top-1/2 left-1/2 motion-reduce:hidden" aria-hidden>
        {pieces.map((p, i) => (
          <span
            key={i}
            className={`absolute -mt-1 -ml-0.5 ${p.round ? "size-1.5 rounded-full" : "h-2.5 w-1.5 rounded-[1px]"} ${p.color}`}
            style={p.style}
          />
        ))}
      </span>
    </span>
  );
}
