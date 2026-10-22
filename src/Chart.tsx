import { useEffect, useRef } from "react";
import Charts from "./vendor/charts.js";
import { monthly, money, type AppData } from "./model";

export function CostChart({
  data,
  year,
  selectedMonth,
  onSelect,
}: {
  data: AppData;
  year: number;
  selectedMonth: number;
  onSelect: (month: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const values = Array.from(
    { length: 12 },
    (_, i) => monthly(data, `${year}-${String(i + 1).padStart(2, "0")}`).cost,
  );
  const labels = [
    "sty",
    "lut",
    "mar",
    "kwi",
    "maj",
    "cze",
    "lip",
    "sie",
    "wrz",
    "paź",
    "lis",
    "gru",
  ];
  useEffect(() => {
    const el = ref.current;
    if (!el || !values.some((v) => v > 0)) return;
    Charts.bars(el, {
      labels,
      values,
      highlight: selectedMonth - 1,
      format: money,
      height: 185,
      xAt: [0, 2, 4, 6, 8, 10],
    });
    return () => Charts.destroy(el);
    // The serialized integer values avoid redrawing for unrelated settings changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join(","), year, selectedMonth]);
  return (
    <>
      {values.some((v) => v > 0) ? (
        <div className="chart" ref={ref} />
      ) : (
        <div className="chart-empty">
          <p>Brak kosztów przejazdów w tym roku.</p>
          <div className="chart-zero">
            <span>0 zł</span>
            <span />
          </div>
          <div className="chart-months">
            {["sty", "mar", "maj", "lip", "wrz", "lis"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
      <details className="chart-data">
        <summary>Koszty w poszczególnych miesiącach</summary>
        <div className="chart-data-grid">
          {values.map((cost, i) => (
            <button
              key={i}
              onClick={() => onSelect(i + 1)}
              aria-pressed={selectedMonth === i + 1}
            >
              <span>{labels[i]}</span>
              <strong>{money(cost)}</strong>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
