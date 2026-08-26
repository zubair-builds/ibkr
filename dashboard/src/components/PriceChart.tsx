import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { CandlestickData, Time, UTCTimestamp } from 'lightweight-charts';

export interface Bar {
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
}

/**
 * The service sends two different date shapes depending on bar size, because it
 * requests IB data with formatDate=2 (see bot/ib_service.py):
 *
 *   daily+    -> "2026-08-26"                  -> a BusinessDay string
 *   intraday  -> "2026-08-26T14:30:00+00:00"   -> needs a UTCTimestamp (seconds)
 *
 * lightweight-charts throws if one series mixes the two, so every point in a
 * given series must go through this one mapper.
 */
function toTime(date: string): Time {
    if (!date.includes('T')) return date;
    return Math.floor(Date.parse(date) / 1000) as UTCTimestamp;
}

/** Sort key for a Time, so both shapes order consistently. */
function timeKey(t: Time): number {
    return typeof t === 'string' ? Date.parse(t) / 1000 : (t as number);
}

function toCandles(bars: Bar[]): CandlestickData<Time>[] {
    const points = bars
        .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null)
        .map((b) => ({
            time: toTime(b.date),
            open: b.open as number,
            high: b.high as number,
            low: b.low as number,
            close: b.close as number,
        }));

    // lightweight-charts throws an uncaught assertion -- taking the whole panel
    // down, since there's no error boundary -- if points are out of order or
    // share a timestamp. IB returns ascending, distinct bars, so this never
    // fires in practice; it's here so bad data degrades into a correct chart
    // instead of a crash.
    points.sort((a, b) => timeKey(a.time) - timeKey(b.time));
    return points.filter((p, i) => i === 0 || timeKey(p.time) !== timeKey(points[i - 1].time));
}

const PriceChart = ({ bars, height = 320 }: { bars: Bar[]; height?: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Chart and series are built together in one effect, on purpose.
    //
    // Splitting them across two effects is a trap: React runs effect cleanups in
    // declaration order, so the chart's cleanup (chart.remove()) fires before the
    // series' cleanup (chart.removeSeries), which then asserts on a destroyed
    // chart -- "Value is undefined". StrictMode's mount/unmount/remount hits this
    // on the very first render.
    //
    // Rebuilding the whole chart when `bars` changes also means a daily ->
    // intraday switch can never mix the two time formats in one series.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const candles = toCandles(bars);
        if (candles.length === 0) return;

        const chart = createChart(el, {
            width: el.clientWidth,
            height,
            layout: {
                background: { color: 'transparent' },
                textColor: 'rgba(255,255,255,0.6)',
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.06)' },
                horzLines: { color: 'rgba(255,255,255,0.06)' },
            },
            rightPriceScale: { borderColor: 'rgba(255,255,255,0.15)' },
            timeScale: { borderColor: 'rgba(255,255,255,0.15)' },
        });
        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });
        series.setData(candles);
        chart.timeScale().fitContent();

        const observer = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
        observer.observe(el);

        return () => {
            observer.disconnect();
            chart.remove();
        };
    }, [bars, height]);

    return <div ref={containerRef} style={{ width: '100%', height }} />;
};

export default PriceChart;
