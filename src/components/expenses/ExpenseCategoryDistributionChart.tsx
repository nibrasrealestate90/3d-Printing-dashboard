"use client";

import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { CategoryDistributionResult, CategoryDistributionItem } from "@/lib/expenseAnalytics";

export interface ExpenseCategoryDistributionChartProps {
  data: CategoryDistributionResult;
  height?: string | number;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onCategoryClick?: (item: CategoryDistributionItem) => void;
  showLegendList?: boolean;
}

export function ExpenseCategoryDistributionChart({
  data,
  height = "320px",
  loading = false,
  error = null,
  emptyMessage = "No expense categories recorded for the selected period.",
  onCategoryClick,
  showLegendList = true,
}: ExpenseCategoryDistributionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [internalError, setInternalError] = useState<string | null>(null);

  const hasItems = data && data.items && data.items.length > 0;
  const hasSpend = hasItems && data.totalCents > BigInt(0);

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

      const tooltipBg = isDark ? "rgba(14, 41, 45, 0.96)" : "rgba(6, 44, 47, 0.96)";
      const tooltipBorder = isDark ? "#1F545C" : "rgba(255, 255, 255, 0.15)";
      const surfaceColor = isDark ? "#0E292D" : "#EFF9F9";

      const seriesData = data.items.map((it) => ({
        name: it.name,
        value: it.amount,
        itemStyle: {
          color: it.color,
          borderRadius: 6,
          borderColor: surfaceColor,
          borderWidth: 2,
        },
        _rawItem: it,
      }));

      const option = {
        animationDuration: 500,
        animationEasing: "cubicOut",
        tooltip: {
          trigger: "item",
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
            const raw = params?.data?._rawItem as CategoryDistributionItem | undefined;
            const name = params?.name || "";
            const val = typeof params?.value === "number" ? params.value : 0;
            const pct = raw?.percentage ?? params?.percent ?? 0;
            const count = raw?.count || 1;
            const color = params?.color || "#0D9488";

            return `
              <div style="font-weight: 700; margin-bottom: 6px; color: #E9F6F6; font-size: 12px; letter-spacing: -0.1px;">
                ${name}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 4px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #9CD4D2; font-size: 12px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color};"></span>
                  Amount
                </span>
                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">
                  AED ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A; margin-bottom: 2px;">
                <span>Share of Spend</span>
                <span style="font-weight: 600; color: #5EEAD4;">${pct.toFixed(1)}%</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 18px; font-size: 11px; color: #628B8A;">
                <span>Transactions</span>
                <span style="font-weight: 500; color: #E9F6F6;">${count}</span>
              </div>
            `;
          },
        },
        series: [
          {
            name: "Category Spending",
            type: "pie",
            radius: ["52%", "76%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            label: {
              show: false,
            },
            emphasis: {
              scale: true,
              scaleSize: 6,
              label: {
                show: false,
              },
            },
            data: seriesData,
          },
        ],
      };

      chart.setOption(option, true);
      chart.resize();
      setInternalError(null);

      if (onCategoryClick) {
        chart.off("click");
        chart.on("click", (params: any) => {
          const raw = params?.data?._rawItem as CategoryDistributionItem | undefined;
          if (raw) onCategoryClick(raw);
        });
      }
    } catch (err: any) {
      console.error("ExpenseCategoryDistributionChart init error:", err);
      setInternalError(err?.message || "Failed to initialize category distribution chart");
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
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: typeof height === "number" ? `${height}px` : height,
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      {effectiveError ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "220px",
            background: "var(--color-surface-secondary, #E5F4F3)",
            borderRadius: "var(--radius-md, 16px)",
            border: "1px dashed var(--color-border-strong, #C4D9D7)",
            color: "var(--color-text-muted, #819493)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: "14px", color: "#F43F5E" }}>
            Category Chart Error
          </p>
          <p style={{ margin: 0, fontSize: "12px" }}>{effectiveError}</p>
        </div>
      ) : !hasSpend ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "220px",
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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 10 10h-10z" />
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
      ) : (
        <>
          {/* Donut Chart Container */}
          <div
            style={{
              position: "relative",
              flex: "1 1 240px",
              minWidth: "220px",
              height: typeof height === "number" ? `${height}px` : height,
              maxHeight: "340px",
            }}
          >
            <div
              ref={containerRef}
              style={{
                width: "100%",
                height: "100%",
              }}
            />
            {/* Center Summary Label */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--color-text-muted, #819493)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Total
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 750,
                  color: "var(--color-text-primary, #062C2F)",
                  letterSpacing: "-0.3px",
                }}
              >
                {data.totalFormatted}
              </div>
            </div>
          </div>

          {/* Legend / Breakdown List */}
          {showLegendList && (
            <div
              style={{
                flex: "1 1 240px",
                minWidth: "220px",
                maxHeight: typeof height === "number" ? `${height}px` : height,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "4px 0",
              }}
            >
              {data.items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => onCategoryClick?.(it)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    background: "var(--color-surface-secondary, #E5F4F3)",
                    border: "1px solid var(--color-border, #D7E6E5)",
                    cursor: onCategoryClick ? "pointer" : "default",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: it.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--color-text-primary, #062C2F)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "130px",
                      }}
                      title={it.name}
                    >
                      {it.name}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 650,
                        color: "var(--color-text-primary, #062C2F)",
                      }}
                    >
                      {it.formatted}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: "rgba(13, 148, 136, 0.12)",
                        color: "var(--color-focus, #397F7C)",
                        minWidth: "38px",
                        textAlign: "right",
                      }}
                    >
                      {it.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
