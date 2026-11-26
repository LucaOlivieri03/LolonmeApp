"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LabChartDatum {
  name: string;
  value: number;
  fill: string;
}

export interface TeammateChartDatum {
  name: string;
  wilson: number;
  quimica: number;
  pj: number;
}

export interface RivalChartDatum {
  name: string;
  balance: number;
  record: string;
}

function truncateChartLabel(label: string, maxChars = 11): string {
  if (label.length <= maxChars) return label;
  return `${label.slice(0, maxChars - 1)}…`;
}

export function LabSubgroupChart({ data }: { data: LabChartDatum[] }) {
  return (
    <div className="mt-4 h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "var(--theme-ink-muted)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={76}
            tick={{ fontSize: 11, fill: "var(--theme-ink)", fontWeight: 600 }}
          />
          <Tooltip
            formatter={(val) => [`${val}%`, "Índice"]}
            contentStyle={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-rule)",
              color: "var(--theme-ink)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TeammatesChart({ data }: { data: TeammateChartDatum[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "var(--theme-ink-muted)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={78}
            tickFormatter={(value) => truncateChartLabel(String(value), 11)}
            tick={{ fontSize: 11, fill: "var(--theme-ink)", fontWeight: 600 }}
          />
          <Tooltip
            formatter={(val, key) => [
              `${val}%`,
              key === "wilson" ? "Wilson CT%" : "Química",
            ]}
            contentStyle={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-rule)",
              color: "var(--theme-ink)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="wilson"
            fill="var(--theme-chart-positive)"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RivalsChart({ data }: { data: RivalChartDatum[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
        >
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--theme-ink-muted)" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={78}
            tickFormatter={(value) => truncateChartLabel(String(value), 11)}
            tick={{ fontSize: 11, fill: "var(--theme-ink)", fontWeight: 600 }}
          />
          <ReferenceLine x={0} stroke="var(--theme-rule-strong)" />
          <Tooltip
            formatter={(val) => [
              Number(val) > 0 ? `+${val}` : `${val}`,
              "Balance V − D",
            ]}
            contentStyle={{
              backgroundColor: "var(--theme-surface)",
              borderColor: "var(--theme-rule)",
              color: "var(--theme-ink)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="balance" radius={[3, 3, 3, 3]} barSize={16}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={
                  entry.balance > 0
                    ? "var(--theme-chart-positive)"
                    : entry.balance < 0
                      ? "var(--theme-chart-negative)"
                      : "var(--theme-rule-strong)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
