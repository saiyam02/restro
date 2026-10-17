"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  menu_categories: { name: string };
};

type ExistingItem = {
  id: string;
  quantity: number;
  status: string;
  menu_items: { name: string };
};

function MenuContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const orderId = searchParams.get("orderId");
  const tableId = params.id as string;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [existingOrders, setExistingOrders] = useState<ExistingItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [cart, setCart] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      alert("Invalid Order Session");
      router.push("/");
      return;
    }
    fetchData();
  }, [orderId, router]);

  async function fetchData() {
    const { data: menuData } = await supabase
      .from("menu_items")
      .select(`id, name, price, is_available, menu_categories(name)`);
    
    const { data: orderData } = await supabase
      .from("order_items")
      .select(`id, quantity, status, menu_items(name)`)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (menuData) setMenuItems(menuData as any);
    if (orderData) setExistingOrders(orderData as any);
    
    setLoading(false);
  }

  async function toggleServeStatus(itemId: string, currentStatus: string) {
    const newStatus = currentStatus === "served" ? "pending" : "served";
    setExistingOrders(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: newStatus } : item
    ));
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
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
      setIsSubmitting(false);
      return;
    }

    setCart({});
    setIsSubmitting(false);
    router.push("/");
  };

  const groupedMenu = useMemo(() => {
    const filtered = menuItems.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return filtered.reduce((acc, item) => {
      const catName = item.menu_categories?.name || "Others";
      if (!acc[catName]) acc[catName] = [];
      acc[catName].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    return total + ((menuItems.find(i => i.id === id)?.price || 0) * qty);
  }, 0);

  return (
    <>
      {/* Edge-to-edge Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900">Table {tableId?.slice(0,4)}...</h1>
          <p className="text-xs md:text-sm font-bold text-emerald-600 uppercase tracking-wide">Active Order</p>
        </div>
        <button onClick={() => router.push("/")} className="text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors">
          Back
        </button>
      </header>

      {/* Main Content Area - Fluid Width */}
      <div className="px-4 md:px-6 mt-6 flex flex-col lg:flex-row gap-6 xl:gap-10">
        
        {/* LEFT SIDE: Menu & Search */}
        <div className="flex-1 w-full max-w-4xl mx-auto lg:mx-0">
          <input 
            type="text" 
            placeholder="Search for Paneer, Dal, etc..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 font-medium py-3.5 px-5 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-8"
          />

          {Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category} className="mb-8">
              <h2 className="text-xl font-black text-slate-900 mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => {
                  const qty = cart[item.id] || 0;
                  return (
                    <div key={item.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start ${!item.is_available ? 'opacity-50 grayscale' : ''}`}>
                      <div className="pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800 leading-tight">{item.name}</h3>
                          {!item.is_available && <span className="text-[10px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded-sm">Sold Out</span>}
                        </div>
                        <p className="text-slate-500 font-semibold text-sm">₹{item.price}</p>
                      </div>
                      
                      {item.is_available && (
                        <div className="flex-shrink-0 mt-1">
                          {qty === 0 ? (
                            <button onClick={() => updateQty(item.id, 1)} className="bg-emerald-50 text-emerald-700 px-5 py-1.5 rounded-lg font-extrabold text-sm hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-sm w-20">
                              ADD
                            </button>
                          ) : (
                            <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm overflow-hidden w-20 h-8">
                              <button onClick={() => updateQty(item.id, -1)} className="flex-1 h-full flex items-center justify-center text-emerald-700 font-extrabold hover:bg-emerald-100 transition-colors">-</button>
                              <span className="font-black text-emerald-700 text-sm">{qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="flex-1 h-full flex items-center justify-center text-emerald-700 font-extrabold hover:bg-emerald-100 transition-colors">+</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(groupedMenu).length === 0 && <p className="text-slate-400 font-medium text-center py-10">No items match your search.</p>}
        </div>

        {/* RIGHT SIDE: Already Ordered Items */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 lg:sticky lg:top-24">
            <h2 className="font-black text-slate-900 mb-4 text-lg border-b border-slate-100 pb-3">Sent to Kitchen</h2>
            {existingOrders.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium">Table is currently empty.</p>
            ) : (
              <div className="space-y-3 mt-4">
                {existingOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center text-sm font-medium bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-100">
                    <span className={order.status === 'served' ? 'line-through text-slate-400' : 'text-slate-800'}>
                      <span className="font-black text-emerald-600 mr-2">{order.quantity} x</span>
                      {order.menu_items?.name}
                    </span>
                    <button 
                      onClick={() => toggleServeStatus(order.id, order.status)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                        order.status === 'served' 
                          ? 'bg-slate-200 text-slate-500' 
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-sm'
                      }`}
                    >
                      {order.status === 'served' ? 'Served' : 'Serve'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Floating KOT Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
          <button 
            onClick={sendKOT}
            disabled={isSubmitting}
            className="w-full max-w-7xl mx-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-400 text-white font-black text-lg py-4 rounded-2xl shadow-lg transition-transform active:scale-[0.98] flex justify-between items-center px-6"
          >
            <span>{totalItems} Items Added</span>
            <span>Send KOT (₹{cartTotal}) ➔</span>
          </button>
        </div>
      )}
    </>
  );
}

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-slate-50 relative pb-32">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <MenuContent />
      </Suspense>
    </main>
  );
}