"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Graphiques du tableau de bord.
 * Recharts est isolé dans un composant client : les pages restent rendues
 * côté serveur et n'expédient que les données agrégées.
 */

const formatK = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)} M`
    : value >= 1000
      ? `${Math.round(value / 1000)} k`
      : String(value);

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  const series = data.map((row) => ({
    month: row.month.slice(5) + "/" + row.month.slice(2, 4),
    revenue: Number(row.revenue),
  }));

  return (
    <div className="mt-4 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#7C8CB6" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "#7C8CB6" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            formatter={(value: number) => [`${formatK(value)} FCFA`, "Revenus"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #D8DEED", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revenueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnrollmentChart({ data }: { data: { school: string; total: number }[] }) {
  const series = data
    .map((row) => ({ school: row.school.replace(/ &.*/, ""), total: Number(row.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return (
    <div className="mt-4 h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F9" vertical={false} />
          <XAxis dataKey="school" tick={{ fontSize: 10, fill: "#7C8CB6" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7C8CB6" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            formatter={(value: number) => [`${value} inscription(s)`, ""]}
            contentStyle={{ borderRadius: 12, border: "1px solid #D8DEED", fontSize: 12 }}
          />
          <Bar dataKey="total" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
