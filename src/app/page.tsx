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
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  
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

  // 1. Strict 'One Active Order' logic
  async function handleOpenTable(table: Table) {
    if (table.status !== "empty") return;

    // Pehle check karo ki galti se koi purana active order atka toh nahi hai
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("table_id", table.id)
      .eq("status", "active")
      .maybeSingle(); // .maybeSingle() crash nahi karta agar order na mile

    // Agar active order nahi hai, sirf tabhi NAYA order banao
    if (!existingOrder) {
      await supabase.from("orders").insert([{ table_id: table.id, status: "active" }]);
    }

    // Table ko occupied mark karo
    await supabase.from("tables").update({ status: "occupied" }).eq("id", table.id);
    setSelectedTable(null);
    fetchTables();
  }

  // 2. Route helper
  async function routeWithOrder(path: "table" | "checkout") {
    if (!selectedTable) return;
    
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("table_id", selectedTable.id)
      .eq("status", "active")
      .single(); // Ab hum confidently .single() use kar sakte hain
    
    if (error || !data) {
      alert("Error: Is table ka koi active order nahi hai.");
      return;
    }

    router.push(`/${path}/${selectedTable.id}?orderId=${data.id}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Syncing tables...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Restaurant POS</h1>
        <p className="text-slate-500 mt-1 font-medium">Select a table to manage orders</p>
        
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-sm font-medium text-slate-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            <span className="text-sm font-medium text-slate-600">Occupied</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
        {tables.map((table) => (
          <button
            key={table.id}
            onClick={() => setSelectedTable(table)}
            className={`relative h-32 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 border-2 ${
              table.status === "empty"
                ? "bg-white border-emerald-100 hover:border-emerald-300"
                : "bg-rose-50 border-rose-200 hover:border-rose-300"
            }`}
          >
            <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${table.status === "empty" ? "bg-emerald-500" : "bg-rose-500"}`}></div>
            <span className={`text-4xl font-bold ${table.status === "empty" ? "text-slate-700" : "text-rose-700"}`}>{table.name}</span>
            <span className={`text-xs font-semibold mt-2 uppercase tracking-wider ${table.status === "empty" ? "text-emerald-600" : "text-rose-600"}`}>{table.status}</span>
          </button>
        ))}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-xl relative">
            <button 
              onClick={() => setSelectedTable(null)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold"
            >✕</button>
            
            <h2 className="text-3xl font-bold text-slate-900">{selectedTable.name}</h2>
            <p className={`text-sm font-semibold uppercase tracking-wider mt-1 mb-6 ${selectedTable.status === "empty" ? "text-emerald-600" : "text-rose-600"}`}>
              {selectedTable.status}
            </p>
            
            {selectedTable.status === "empty" ? (
              <button
                onClick={() => handleOpenTable(selectedTable)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg py-4 rounded-2xl shadow-sm transition-colors"
              >
               Mark as Occupied
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => routeWithOrder("table")}
                  className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300 font-bold text-lg py-4 rounded-2xl shadow-sm transition-colors"
                >
                  Open Menu / Send KOT
                </button>
                <button
                  onClick={() => routeWithOrder("checkout")}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-lg py-4 rounded-2xl shadow-sm transition-colors"
                >
                  View Bill & Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}