"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { CategoryComparisonResult, CategoryComparisonItem } from "@/lib/expenseAnalytics";

export interface ExpenseCategoryComparisonChartProps {
  data: CategoryComparisonResult;
  height?: string | number;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onCategoryClick?: (item: CategoryComparisonItem) => void;
}

export function ExpenseCategoryComparisonChart({
  data,
  height,
  loading = false,
  error = null,
  emptyMessage = "No category data to rank for the selected period.",
  onCategoryClick,
}: ExpenseCategoryComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  const hasItems = data && data.items && data.items.length > 0;
  const hasSpend = hasItems && data.totalCents > BigInt(0);

  // Dynamic height if not explicitly provided
  const computedHeight = height ?? Math.min(480, Math.max(260, (data?.items?.length || 0) * 36 + 70));

  useEffect(() => {
    if (!containerRef.current || loading || error || !hasSpend) return;

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

      const axisColor = isDark ? "#9CD4D2" : "#506867";
      const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#D7E6E5";
      const tooltipBg = isDark ? "rgba(14, 41, 45, 0.96)" : "rgba(6, 44, 47, 0.96)";
      const tooltipBorder = isDark ? "#1F545C" : "rgba(255, 255, 255, 0.15)";

      // Reverse items for ECharts horizontal bar so highest is at the top
      const reversedItems = [...data.items].reverse();
      const categoryNames = reversedItems.map((it) => it.name);
      const values = reversedItems.map((it) => it.amount);
      const colors = reversedItems.map((it) => it.color);

      const option = {
        animationDuration: 450,
        animationEasing: "cubicOut",
        grid: {
          left: 12,
          right: 32,
          top: 16,
          bottom: 12,
          containLabel: true,
        },
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
            shadowStyle: {
              color: isDark ? "rgba(45, 212, 191, 0.08)" : "rgba(13, 148, 136, 0.06)",
            },
          },
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
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            const idx = p?.dataIndex ?? 0;
            const item = reversedItems[idx];
            if (!item) return "";

            return `
              <div style="font-weight: 700; margin-bottom: 6px; color: #E9F6F6; font-size: 12px; letter-spacing: -0.1px;">
                ${item.name}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 4px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #9CD4D2; font-size: 12px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${item.color};"></span>
                  Total Spend
                </span>
                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">
                  ${item.formatted}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A; margin-bottom: 2px;">
                <span>Share of Spend</span>
                <span style="font-weight: 600; color: #5EEAD4;">${item.percentage.toFixed(1)}%</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A;">
                <span>Transactions</span>
                <span style="font-weight: 500; color: #E9F6F6;">${item.count}</span>
              </div>
            `;
          },
        },
        xAxis: {
          type: "value",
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
        yAxis: {
          type: "category",
          data: categoryNames,
          axisLine: {
            lineStyle: { color: gridColor },
          },
          axisTick: { show: false },
          axisLabel: {
            color: axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            margin: 10,
            formatter: (val: string) => {
              if (val.length > 18) return `${val.slice(0, 16)}…`;
              return val;
            },
          },
        },
        series: [
          {
            name: "Category Spend",
            type: "bar",
            barMaxWidth: 20,
            data: values.map((val, i) => ({
              value: val,
              itemStyle: {
                color: colors[i],
                borderRadius: [0, 6, 6, 0],
              },
            })),
          },
        ],
      };

      chart.setOption(option, true);
      chart.resize();
      setInternalError(null);

      if (onCategoryClick) {
        chart.off("click");
        chart.on("click", (params: any) => {
          const idx = params?.dataIndex;
          if (typeof idx === "number" && reversedItems[idx]) {
            onCategoryClick(reversedItems[idx]);
          }
        });
      }
    } catch (err: any) {
      console.error("ExpenseCategoryComparisonChart init error:", err);
      setInternalError(err?.message || "Failed to initialize category comparison chart");
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
  }, [data, loading, error, hasSpend, onCategoryClick]);

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
        height: typeof computedHeight === "number" ? `${computedHeight}px` : computedHeight,
        minHeight: "240px",
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
            Comparison Chart Error
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
            <path d="M7 16h8" />
            <path d="M7 11h12" />
            <path d="M7 6h4" />
          </svg>
          <p
            style={{
              margin: "0 0 4px 0",
              fontWeight: 650,
              fontSize: "14px",
              color: "var(--color-text-secondary, #506867)",
            }}
          >
            No Category Spending
          </p>
          <p style={{ margin: 0, fontSize: "12px", maxWidth: "320px", lineHeight: "1.4" }}>
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
