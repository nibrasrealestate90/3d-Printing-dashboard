"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ChartMonthData } from "./types";
import * as echarts from "echarts";

interface MonthlySalesChartProps {
  data: ChartMonthData[];
}

export function MonthlySalesChart({ data }: MonthlySalesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  const hasAnyData = data.length > 0 && data.some((d) => d.sales > 0 || d.orderCount > 0);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!hasAnyData) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.clear();
      }
      return;
    }

    try {
      const echartsLib = (typeof window !== "undefined" && (window as any).echarts) || echarts;

      let chart = echartsLib.getInstanceByDom(containerRef.current);
      if (!chart) {
        chart = echartsLib.init(containerRef.current, undefined, {
          renderer: "canvas",
        });
      }
      chartInstanceRef.current = chart;

      const categories = data.map((d) => d.monthLabel);
      const values = data.map((d) => d.sales);
      const orders = data.map((d) => d.orderCount);

      const option = {
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(32, 33, 31, 0.95)",
          borderColor: "rgba(255, 255, 255, 0.15)",
          borderWidth: 1,
          borderRadius: 8,
          padding: [10, 14],
          textStyle: {
            color: "#FFFFFF",
            fontFamily: "inherit",
            fontSize: 12,
          },
          axisPointer: {
            type: "line",
            lineStyle: {
              color: "#F0643D",
              width: 1.5,
              type: "dashed",
            },
          },
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params;
            const val = typeof p?.value === "number" ? p.value : 0;
            const dataIndex = p?.dataIndex ?? 0;
            const count = orders[dataIndex] || 0;
            return `
              <div style="font-weight: 700; margin-bottom: 6px; color: #E8E9E6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${p.name}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 4px;">
                <span style="display: flex; align-items: center; gap: 6px; color: #D9DBD6; font-size: 12px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #F0643D;"></span>
                  Invoiced Sales
                </span>
                <span style="font-weight: 700; color: #FFFFFF; font-size: 13px;">
                  AED ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; font-size: 11px; color: #92948F;">
                <span>Confirmed Orders</span>
                <span style="font-weight: 600; color: #E8E9E6;">${count}</span>
              </div>
            `;
          },
        },
        grid: {
          left: "2%",
          right: "3%",
          top: "14%",
          bottom: "6%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: categories,
          boundaryGap: false,
          axisLine: {
            lineStyle: { color: "#E8E9E6" },
          },
          axisTick: { show: false },
          axisLabel: {
            color: "#686A66",
            fontSize: 11,
            margin: 12,
          },
        },
        yAxis: {
          type: "value",
          min: 0,
          splitLine: {
            lineStyle: {
              color: "#F0F0ED",
              type: "dashed",
            },
          },
          axisLabel: {
            color: "#686A66",
            fontSize: 11,
            formatter: (val: number) => {
              if (val >= 1000) return `AED ${(val / 1000).toFixed(1)}k`;
              return `AED ${val}`;
            },
          },
        },
        series: [
          {
            name: "Invoiced Sales",
            type: "line",
            smooth: true,
            showSymbol: data.length <= 24,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: {
              color: "#F0643D",
              borderColor: "#FFFFFF",
              borderWidth: 2,
            },
            lineStyle: {
              width: 3,
              color: "#F0643D",
              shadowColor: "rgba(240, 100, 61, 0.25)",
              shadowBlur: 10,
              shadowOffsetY: 4,
            },
            areaStyle: {
              color: new echartsLib.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(240, 100, 61, 0.28)" },
                { offset: 1, color: "rgba(240, 100, 61, 0.01)" },
              ]),
            },
            data: values,
            animationDuration: 800,
            animationEasing: "cubicOut",
          },
        ],
      };

      chart.setOption(option, true);
      chart.resize();
      setChartError(null);
    } catch (err: any) {
      console.error("Failed to render ECharts chart:", err);
      setChartError(err?.message || "Failed to initialize chart");
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

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, hasAnyData]);

  // Clean up chart instance when component unmounts
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "340px",
      }}
    >
      {chartError ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "var(--bm-surface-muted)",
            borderRadius: "var(--bm-radius-md)",
            border: "1px dashed var(--bm-border)",
            color: "var(--bm-text-muted)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p
            style={{
              margin: "0 0 4px 0",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--bm-accent)",
            }}
          >
            Unable to Render Visualization
          </p>
          <p style={{ margin: 0, fontSize: "12px" }}>{chartError}</p>
        </div>
      ) : !hasAnyData ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "var(--bm-surface-muted)",
            borderRadius: "var(--bm-radius-md)",
            border: "1px dashed var(--bm-border)",
            color: "var(--bm-text-muted)",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <p
            style={{
              margin: "0 0 4px 0",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--bm-text-secondary)",
            }}
          >
            No Sales Data for Selected Period
          </p>
          <p style={{ margin: 0, fontSize: "12px" }}>
            Confirmed commercial orders created within this date range will display here.
          </p>
        </div>
      ) : null}

      <div
        ref={containerRef}
        id="monthly-sales-chart-container"
        style={{
          width: "100%",
          height: "100%",
          minHeight: "340px",
          display: !chartError && hasAnyData ? "block" : "none",
        }}
      />
    </div>
  );
}
