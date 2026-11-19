import React from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  emptyMessage?: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  loading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = "id",
  emptyMessage = "No records found.",
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  toolbarActions,
  loading = false,
}: DataTableProps<T>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {/* Optional Table Toolbar */}
      {(onSearchChange || toolbarActions) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {onSearchChange && (
            <div style={{ position: "relative", minWidth: "240px", maxWidth: "340px", flex: 1 }}>
              <input
                type="text"
                value={searchQuery || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: "100%",
                  padding: "8px 14px 8px 34px",
                  fontSize: "12px",
                  borderRadius: "var(--bm-radius-pill)",
                  border: "1px solid var(--bm-border)",
                  background: "var(--bm-surface)",
                  color: "var(--bm-text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--bm-text-muted)",
                  pointerEvents: "none",
                }}
              >
                <HugeIcon icon={Search01Icon} size={15} />
              </div>
            </div>
          )}

          {toolbarActions && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              {toolbarActions}
            </div>
          )}
        </div>
      )}

      {/* Table Shell */}
      <div className="bm-table-container">
        <table className="bm-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    textAlign: col.align || "left",
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: "40px", color: "var(--bm-text-muted)" }}
                >
                  Loading data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: "40px", color: "var(--bm-text-muted)" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIdx) => (
                <tr key={item[keyField] ?? rowIdx}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        textAlign: col.align || "left",
                      }}
                    >
                      {col.render ? col.render(item) : item[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer item counter */}
      {!loading && data.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--bm-text-muted)",
            padding: "0 4px",
          }}
        >
          <span>
            Showing {data.length} {data.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}
    </div>
  );
}
