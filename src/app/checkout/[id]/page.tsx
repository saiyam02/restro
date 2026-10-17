"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  menu_items: {
    name: string;
  };
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
      .select(`
        id,
        quantity,
        price,
        menu_items ( name )
      `)
      .eq("order_id", orderId);

    if (error) {
      console.error("Error fetching bill:", error);
    } else if (data) {
      // @ts-ignore
      setItems(data);
    }
    setLoading(false);
  }

  async function handleSettleBill() {
    setIsSettle(true);
    
    await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);
    await supabase.from("tables").update({ status: "empty" }).eq("id", tableId);

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
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
          <p className="text-sm font-medium text-slate-500">Billing details</p>
        </div>
        <button 
          onClick={() => router.push("/")}
          className="text-slate-500 font-bold bg-slate-200 px-4 py-2 rounded-xl"
        >
          Back
        </button>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Order Items</h3>
        
        {items.length === 0 ? (
          <p className="text-slate-500 italic">No items ordered yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-slate-700">
                <span>{item.quantity} x {item.menu_items?.name}</span>
                <span className="font-semibold">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>GST (5%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-slate-900 mt-2 pt-2 border-t">
            <span>Grand Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSettleBill}
        disabled={isSettle}
        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-lg py-4 rounded-2xl shadow-md transition-all"
      >
        {items.length === 0 ? "Clear Empty Table" : "Mark as Paid & Clear Table"}
      </button>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 relative">
      <Suspense fallback={<div className="text-center mt-20 font-bold text-slate-500">Loading Bill...</div>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}