"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  menu_items: { name: string };
};

function CheckoutContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const tableId = params.id as string;
  const orderId = searchParams.get("orderId");

  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettle, setIsSettle] = useState(false);

  useEffect(() => {
    if (!orderId) {
      alert("Invalid Order ID");
      router.push("/");
      return;
    }
    fetchOrderDetails();
  }, [orderId, router]);

  async function fetchOrderDetails() {
    const { data, error } = await supabase
      .from("order_items")
      .select(`id, quantity, price, menu_items ( name )`)
      .eq("order_id", orderId);

    if (data) setItems(data as any);
    setLoading(false);
  }

  async function handleSettleBill() {
    setIsSettle(true);
    
    const { error: orderError } = await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);
    const { error: tableError } = await supabase.from("tables").update({ status: "empty" }).eq("id", tableId);

    if (orderError || tableError) {
      alert("Database Error! Bill settle nahi hua.");
      setIsSettle(false);
      return;
    }
    setIsSettle(false);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const gst = subtotal * 0.05;
  const grandTotal = subtotal + gst;

  return (
    <div className="max-w-md mx-auto print:max-w-full">
      
      {/* Header - Hides on Print */}
      <header className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Checkout</h1>
          <p className="text-sm font-medium text-slate-500">Billing details</p>
        </div>
        <button onClick={() => router.push("/")} className="text-slate-600 font-bold bg-slate-200 px-4 py-2 rounded-xl">
          Back
        </button>
      </header>

      {/* Bill Receipt Area */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 print:shadow-none print:border-none print:p-0">
        
        {/* Print Header (Shows nicely on paper) */}
        <div className="text-center mb-6 border-b-2 border-dashed border-slate-300 pb-4">
          <h2 className="text-2xl font-black text-slate-900">RESTRO</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Table {tableId?.slice(0,4).toUpperCase()}</p>
          <p className="text-xs text-slate-400 mt-1">{new Date().toLocaleString()}</p>
        </div>
        
        {items.length === 0 ? (
          <p className="text-slate-500 italic text-center">No items ordered yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start text-slate-800 font-medium text-sm">
                <span className="flex-1 pr-4">{item.quantity} x {item.menu_items?.name}</span>
                <span className="font-bold whitespace-nowrap">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Bill Totals */}
        <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-300 space-y-2 text-sm font-medium">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (5%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-black text-slate-900 mt-4 pt-4 border-t-2 border-slate-800">
            <span>Grand Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="text-center mt-8 text-xs font-bold text-slate-400 print:block">
          <p>Thank you for visiting!</p>
        </div>
      </div>

      {/* Action Buttons - Hide on Print */}
      <div className="space-y-3 print:hidden">
        {/* Print Button */}
        <button 
          onClick={() => window.print()}
          className="w-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 font-bold text-lg py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          🖨️ Print Receipt
        </button>

        {/* Settle Button */}
        <button 
          onClick={handleSettleBill}
          disabled={isSettle}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-lg py-4 rounded-2xl shadow-md transition-all"
        >
          {items.length === 0 ? "Clear Empty Table" : "Mark as Paid & Clear Table"}
        </button>
      </div>

    </div>
  );
}

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 print:bg-white print:p-0">
      <Suspense fallback={<div className="text-center mt-20 font-bold text-slate-500">Loading Bill...</div>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}