import { BarChart3, FileUp, Tags, WalletCards } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartData = [
  { category: "Transporte", amount: 420 },
  { category: "Alimentacao", amount: 980 },
  { category: "Saude", amount: 310 },
  { category: "Casa", amount: 760 },
];

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-500">aws-smart-cash-flow</p>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
            Visao financeira
          </h1>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={<WalletCards size={20} />} label="Transacoes" value="0" />
          <MetricCard icon={<FileUp size={20} />} label="Importacoes" value="0" />
          <MetricCard icon={<Tags size={20} />} label="Categorias" value="0" />
          <MetricCard icon={<BarChart3 size={20} />} label="Regras" value="0" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-950">Gastos por categoria</h2>
              <p className="text-sm text-slate-500">Dados reais entram apos a API.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-950">Importar arquivo</h2>
            <p className="mt-1 text-sm text-slate-500">MVP 1 aceita TXT e CSV.</p>
            <button className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white">
              <FileUp size={18} />
              Selecionar arquivo
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm font-medium">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default App;
