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

export function LabSubgroupChart({ data }: { data: LabChartDatum[] }) {
  return (
    <div className="mt-4 h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "#4c5d52" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={82}
            tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
          />
          <Tooltip
            formatter={(val) => [`${val}%`, "Índice"]}
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#d6d3c7",
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
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11, fill: "#4c5d52" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
          />
          <Tooltip
            formatter={(val, key) => [
              `${val}%`,
              key === "wilson" ? "Wilson CT%" : "Química",
            ]}
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#d6d3c7",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="wilson"
            fill="#0a4a28"
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
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#4c5d52" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
          />
          <ReferenceLine x={0} stroke="#b8b4a5" />
          <Tooltip
            formatter={(val) => [
              Number(val) > 0 ? `+${val}` : `${val}`,
              "Balance V − D",
            ]}
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#d6d3c7",
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
                    ? "#0a4a28"
                    : entry.balance < 0
                      ? "#c4202b"
                      : "#b8b4a5"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
