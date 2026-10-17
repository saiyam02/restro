"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Table = {
  id: string;
  name: string;
  status: "empty" | "occupied";
};

export default function WaiterDashboard() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTables();
  }, []);

  async function fetchTables() {
    const { data, error } = await supabase.from("tables").select("*");
    if (error) {
      console.error("Error fetching tables:", error);
    } else if (data) {
      const sortedData = data.sort((a, b) => {
        const numA = parseInt(a.name.replace("T", ""));
        const numB = parseInt(b.name.replace("T", ""));
        return numA - numB;
      });
      setTables(sortedData);
    }
    setLoading(false);
  }

  async function handleOpenTable(tableId: string) {
    // 1. Mark table as occupied
    await supabase.from("tables").update({ status: "occupied" }).eq("id", tableId);
    
    // 2. Create the active order session immediately
    await supabase.from("orders").insert([{ table_id: tableId, status: "active" }]);

    fetchTables(); // Refresh the grid
  }

  async function routeWithOrder(tableId: string, path: "table" | "checkout") {
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("table_id", tableId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (error || !data || data.length === 0) {
      alert("Error: No active order found for this table.");
      return;
    }

    router.push(`/${path}/${tableId}?orderId=${data[0].id}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Restaurant POS</h1>
        <p className="text-slate-500 mt-1 font-medium">Fast action dashboard</p>
      </header>

      {/* Grid showing tables with INLINE buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`flex flex-col justify-between p-4 rounded-3xl border-2 transition-all shadow-sm bg-white ${
              table.status === "empty"
                ? "border-emerald-100 hover:border-emerald-300"
                : "border-rose-100 bg-rose-50/30 hover:border-rose-300"
            }`}
          >
            {/* Table Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`text-3xl font-black block leading-none ${
                  table.status === "empty" ? "text-slate-800" : "text-rose-700"
                }`}>
                  {table.name}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 block ${
                  table.status === "empty" ? "text-emerald-500" : "text-rose-500"
                }`}>
                  {table.status}
                </span>
              </div>
              <div className={`w-3 h-3 rounded-full shadow-inner ${
                table.status === "empty" ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
              }`}></div>
            </div>

            {/* Inline Action Buttons */}
            <div className="mt-auto">
              {table.status === "empty" ? (
                <button
                  onClick={() => handleOpenTable(table.id)}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-2xl transition-colors text-sm border border-emerald-200 shadow-sm active:scale-95"
                >
                  Occupy Table
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => routeWithOrder(table.id, "table")}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-2xl transition-colors text-sm border border-slate-200 shadow-sm active:scale-95"
                  >
                    📝 Menu
                  </button>
                  <button
                    onClick={() => routeWithOrder(table.id, "checkout")}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl transition-colors text-sm shadow-sm active:scale-95"
                  >
                    🧾 Bill
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}