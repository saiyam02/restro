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
    // 1. Fetch Menu with Category names
    const { data: menuData } = await supabase
      .from("menu_items")
      .select(`id, name, price, is_available, menu_categories(name)`);
    
    // 2. Fetch already ordered items for this table
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
    
    // UI instantly update (Optimistic update)
    setExistingOrders(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: newStatus } : item
    ));

    // Database update
    const { error } = await supabase
      .from("order_items")
      .update({ status: newStatus })
      .eq("id", itemId);

    if (error) {
      alert("Status update fail ho gaya!");
    }
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

  // Group items by category and filter by search query
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
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
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
      <header className="mb-6 flex items-center justify-between sticky top-0 bg-slate-50 py-4 z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Table {tableId?.slice(0,4)}...</h1>
          <p className="text-sm font-medium text-slate-500">Take Order</p>
        </div>
        <button onClick={() => router.push("/")} className="text-slate-500 font-bold bg-slate-200 px-4 py-2 rounded-xl">Back</button>
      </header>

      <div className="flex flex-col md:flex-row gap-6 pb-32">
        
        {/* LEFT SIDE: Menu & Search */}
        <div className="flex-1 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search items (e.g. Paneer...)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-900 font-medium py-3 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Categorized Menu */}
          {Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 border-b-2 border-slate-200 pb-1">{category}</h2>
              {items.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center ${!item.is_available ? 'opacity-50' : ''}`}>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">
                        {item.name} {(!item.is_available) && <span className="text-xs text-rose-500 bg-rose-50 px-2 py-1 rounded-md ml-2">Out of stock</span>}
                      </h3>
                      <p className="text-slate-500 font-medium">₹{item.price}</p>
                    </div>
                    
                    {item.is_available && (
                      qty === 0 ? (
                        <button onClick={() => updateQty(item.id, 1)} className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl font-bold hover:bg-emerald-100 border border-emerald-200">ADD</button>
                      ) : (
                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-1">
                          <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-600 font-bold bg-white rounded-lg shadow-sm">-</button>
                          <span className="font-bold w-4 text-center">{qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-emerald-600 font-bold bg-white rounded-lg shadow-sm">+</button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {Object.keys(groupedMenu).length === 0 && <p className="text-slate-500 text-center py-4">No items found.</p>}
        </div>

        {/* RIGHT SIDE: Already Ordered Items */}
        <div className="md:w-80 flex-shrink-0">
          <div className="bg-slate-200/50 p-4 rounded-2xl border border-slate-200 sticky top-24">
            <h2 className="font-bold text-slate-800 mb-3">Table Orders</h2>
            {existingOrders.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No items ordered yet.</p>
            ) : (
              <div className="space-y-2">
                {existingOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center text-sm font-medium bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100">
                    
                    {/* Item Name - Strike through agar served hai */}
                    <span className={order.status === 'served' ? 'line-through text-slate-400' : 'text-slate-800'}>
                      {order.quantity} x {order.menu_items?.name}
                    </span>
                    
                    {/* Mark Served Button */}
                    <button 
                      onClick={() => toggleServeStatus(order.id, order.status)}
                      className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all ${
                        order.status === 'served' 
                          ? 'bg-slate-100 text-slate-400' 
                          : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
          <button 
            onClick={sendKOT}
            disabled={isSubmitting}
            className="w-full max-w-4xl mx-auto bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-400 text-white font-bold text-lg py-4 rounded-2xl shadow-sm transition-colors flex justify-between items-center px-6"
          >
            <span>{totalItems} New Items</span>
            <span>Send KOT (₹{cartTotal}) ➔</span>
          </button>
        </div>
      )}
    </>
  );
}

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6 relative max-w-6xl mx-auto">
      <Suspense fallback={<div className="text-center mt-20 font-bold text-slate-500">Loading Menu...</div>}>
        <MenuContent />
      </Suspense>
    </main>
  );
}