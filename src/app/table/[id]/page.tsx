"use client";

import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category_id: string;
};

function MenuContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const orderId = searchParams.get("orderId");
  const tableId = params.id as string;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      alert("Invalid Order Session");
      router.push("/");
      return;
    }
    fetchMenu();
  }, [orderId, router]);

  async function fetchMenu() {
    const { data, error } = await supabase.from("menu_items").select("*");
    if (error) {
      console.error("Error fetching menu:", error);
    } else if (data) {
      setMenuItems(data);
    }
    setLoading(false);
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [id, qty]) => {
      const item = menuItems.find(i => i.id === id);
      return total + (item?.price || 0) * qty;
    }, 0);
  };

  const sendKOT = async () => {
    if (!orderId || Object.keys(cart).length === 0) return;
    setIsSubmitting(true);

    const itemsToInsert = Object.entries(cart).map(([id, qty]) => {
      const item = menuItems.find(i => i.id === id);
      return {
        order_id: orderId,
        item_id: id,
        quantity: qty,
        price: item?.price || 0,
      };
    });

    const { error } = await supabase.from("order_items").insert(itemsToInsert);

    if (error) {
      alert("Error sending KOT to kitchen!");
      console.error(error);
      setIsSubmitting(false);
      return;
    }

    setCart({});
    setIsSubmitting(false);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = getCartTotal();

  return (
    <>
      <header className="mb-6 flex items-center justify-between sticky top-0 bg-slate-50 py-4 z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Take Order</h1>
          <p className="text-sm font-medium text-slate-500">Table ID: {tableId?.slice(0,4)}...</p>
        </div>
        <button 
          onClick={() => router.push("/")}
          className="text-slate-500 font-bold bg-slate-200 px-4 py-2 rounded-xl"
        >
          Back
        </button>
      </header>

      <div className="space-y-4 pb-32">
        {menuItems.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                <p className="text-slate-500 font-medium">₹{item.price}</p>
              </div>
              
              {qty === 0 ? (
                <button 
                  onClick={() => updateQty(item.id, 1)}
                  className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  ADD
                </button>
              ) : (
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-1">
                  <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-600 font-bold bg-white rounded-lg shadow-sm">-</button>
                  <span className="font-bold w-4 text-center">{qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-emerald-600 font-bold bg-white rounded-lg shadow-sm">+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
          <button 
            onClick={sendKOT}
            disabled={isSubmitting}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-400 text-white font-bold text-lg py-4 rounded-2xl shadow-sm transition-colors flex justify-between items-center px-6"
          >
            <span>{totalItems} Items</span>
            <span>Send KOT (₹{cartTotal}) ➔</span>
          </button>
        </div>
      )}
    </>
  );
}

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 relative">
      <Suspense fallback={<div className="text-center mt-20 font-bold text-slate-500">Loading Menu...</div>}>
        <MenuContent />
      </Suspense>
    </main>
  );
}