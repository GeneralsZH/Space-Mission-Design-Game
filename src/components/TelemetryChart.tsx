import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Language, Telemetry } from "../types";
export default function TelemetryChart({
  data,
  language,
}: {
  data: Telemetry[];
  language: Language;
}) {
  return (
    <div className="telemetry-charts">
      {(
        [
          {
            key: "chargeWh",
            unit: "Wh",
            color: "#31d6e5",
            label: language === "ru" ? "Заряд батареи" : "Battery charge",
          },
          {
            key: "storedGbit",
            unit: "Gbit",
            color: "#b6a1f8",
            label: language === "ru" ? "Данные в памяти" : "Stored data",
          },
        ] as const
      ).map((item) => (
        <div key={item.key} className="chart-frame">
          <p className="tiny muted">
            {item.label} · {item.unit}
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -15 }}
            >
              <CartesianGrid
                stroke="#24384b"
                strokeDasharray="3 6"
                vertical={false}
              />
              <XAxis
                dataKey="orbit"
                tick={{ fill: "#8ba3b5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#8ba3b5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#13243a",
                  border: "1px solid #35516a",
                  borderRadius: 8,
                }}
                labelFormatter={(value) =>
                  `${language === "ru" ? "Виток" : "Orbit"} ${value}`
                }
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey={item.key}
                name={item.unit}
                stroke={item.color}
                fill={item.color}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
