"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { TrendAnalyticsResult, TrendBucket } from "@/lib/expenseAnalytics";

export interface ExpenseTrendChartProps {
  data: TrendAnalyticsResult;
  height?: string | number;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onBucketClick?: (bucket: TrendBucket) => void;
}

export function ExpenseTrendChart({
  data,
  height = "320px",
  loading = false,
  error = null,
  emptyMessage = "No expense transactions recorded for the selected period.",
  onBucketClick,
}: ExpenseTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  const hasData = data && data.buckets && data.buckets.length > 0;
  const hasSpend = hasData && data.buckets.some((b) => b.cents > BigInt(0));

  useEffect(() => {
    if (!containerRef.current || loading || error || !hasData) return;

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const echartsLib = (typeof window !== "undefined" && (window as any).echarts) || echarts;

      let chart = echartsLib.getInstanceByDom(containerRef.current);
      if (!chart) {
        chart = echartsLib.init(containerRef.current, undefined, {
          renderer: "canvas",
        });
      }
      chartInstanceRef.current = chart;

      const labels = data.buckets.map((b) => b.label);
      const values = data.buckets.map((b) => b.amount);
      const counts = data.buckets.map((b) => b.count);

      // Theme colors
      const axisColor = isDark ? "#9CD4D2" : "#506867";
      const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#D7E6E5";
      const tooltipBg = isDark ? "rgba(14, 41, 45, 0.96)" : "rgba(6, 44, 47, 0.96)";
      const tooltipBorder = isDark ? "#1F545C" : "rgba(255, 255, 255, 0.15)";
      const primaryColor = isDark ? "#2DD4BF" : "#0D9488";

      const option = {
        animationDuration: 450,
        animationEasing: "cubicOut",
        grid: {
          left: 12,
          right: 20,
          top: 24,
          bottom: 12,
          containLabel: true,
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          borderRadius: 12,
          padding: [10, 14],
          textStyle: {
            color: "#FFFFFF",
            fontFamily: "'General Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 12,
          },
          axisPointer: {
            type: "line",
            lineStyle: {
              color: primaryColor,
              width: 1.5,
              type: "dashed",
            },
          },
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            const idx = p?.dataIndex ?? 0;
            const bucket = data.buckets[idx];
            const val = typeof p?.value === "number" ? p.value : 0;
            const count = counts[idx] || 0;
            const avgStr =
              count > 0
                ? (val / count).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "0.00";

            return `
              <div style="font-weight: 700; margin-bottom: 6px; color: #E9F6F6; font-size: 12px; letter-spacing: -0.1px;">
                ${p.name || bucket?.label || ""}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 4px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #9CD4D2; font-size: 12px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${primaryColor};"></span>
                  Total Spend
                </span>
                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">
                  AED ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A;">
                <span>Transactions</span>
                <span style="font-weight: 600; color: #E9F6F6;">${count}</span>
              </div>
              ${
                count > 1
                  ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A; margin-top: 2px;">
                      <span>Avg / Transaction</span>
                      <span style="font-weight: 500; color: #9CD4D2;">AED ${avgStr}</span>
                    </div>`
                  : ""
              }
            `;
          },
        },
        xAxis: {
          type: "category",
          data: labels,
          boundaryGap: false,
          axisLine: {
            lineStyle: { color: gridColor },
          },
          axisTick: { show: false },
          axisLabel: {
            color: axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            margin: 10,
            interval: labels.length > 20 ? "auto" : 0,
          },
        },
        yAxis: {
          type: "value",
          min: 0,
          splitLine: {
            lineStyle: {
              color: gridColor,
              type: "dashed",
            },
          },
          axisLabel: {
            color: axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            formatter: (val: number) => {
              if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
              if (val >= 1000) return `AED ${(val / 1000).toFixed(1)}k`;
              return `AED ${val}`;
            },
          },
        },
        series: [
          {
            name: "Expenses",
            type: "line",
            smooth: 0.25,
            showSymbol: labels.length <= 31,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: {
              color: primaryColor,
              borderColor: isDark ? "#0E292D" : "#FFFFFF",
              borderWidth: 2,
            },
            lineStyle: {
              width: 3,
              color: primaryColor,
              shadowColor: isDark ? "rgba(45, 212, 191, 0.25)" : "rgba(13, 148, 136, 0.25)",
              shadowBlur: 8,
              shadowOffsetY: 3,
            },
            areaStyle: {
              color: new echartsLib.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: isDark ? "rgba(45, 212, 191, 0.32)" : "rgba(13, 148, 136, 0.25)",
                },
                {
                  offset: 1,
                  color: isDark ? "rgba(45, 212, 191, 0.01)" : "rgba(13, 148, 136, 0.01)",
                },
              ]),
            },
            data: values,
          },
        ],
      };

      chart.setOption(option, true);
      chart.resize();
      setInternalError(null);

      // Click handler
      if (onBucketClick) {
        chart.off("click");
        chart.on("click", (params: any) => {
          const idx = params?.dataIndex;
          if (typeof idx === "number" && data.buckets[idx]) {
            onBucketClick(data.buckets[idx]);
          }
        });
      }
    } catch (err: any) {
      console.error("ExpenseTrendChart init error:", err);
      setInternalError(err?.message || "Failed to initialize trend chart");
    }

    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", handleResize);

    // Watch for theme toggles
    const mutationObserver = new MutationObserver(() => {
      handleResize();
    });
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, loading, error, hasData, onBucketClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  const effectiveError = error || internalError;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        minHeight: "260px",
      }}
    >
      {effectiveError ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "var(--color-surface-secondary, #E5F4F3)",
            borderRadius: "var(--radius-md, 16px)",
            border: "1px dashed var(--color-border-strong, #C4D9D7)",
            color: "var(--color-text-muted, #819493)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: "14px", color: "#F43F5E" }}>
            Trend Chart Error
          </p>
          <p style={{ margin: 0, fontSize: "12px" }}>{effectiveError}</p>
        </div>
      ) : !hasSpend ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "var(--color-surface-secondary, #E5F4F3)",
            borderRadius: "var(--radius-md, 16px)",
            border: "1px dashed var(--color-border, #D7E6E5)",
            color: "var(--color-text-muted, #819493)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: "12px", opacity: 0.7 }}
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          <p
            style={{
              margin: "0 0 4px 0",
              fontWeight: 650,
              fontSize: "14px",
              color: "var(--color-text-secondary, #506867)",
            }}
          >
            No Expense Data for Selected Period
          </p>
          <p style={{ margin: 0, fontSize: "12px", maxWidth: "340px", lineHeight: "1.4" }}>
            {emptyMessage}
          </p>
        </div>
      ) : null}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: !effectiveError && hasSpend ? "block" : "none",
        }}
      />
    </div>
  );
}
