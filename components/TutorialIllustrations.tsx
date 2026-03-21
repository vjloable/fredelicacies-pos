'use client';

// ── Store ──────────────────────────────────────────────────────────────

export function IllMixMatchCard() {
  return (
    <div className="flex items-center justify-center gap-2 p-4 w-full h-full">
      {[1,2].map(i => (
        <div key={i} className="w-16 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="h-10 bg-gray-100" />
          <div className="p-1.5">
            <div className="h-1.5 bg-gray-200 rounded mb-1 w-4/5" />
            <div className="flex justify-between items-center">
              <div className="h-1.5 bg-yellow-200 rounded w-2/5" />
              <div className="text-[5px] px-0.5 rounded bg-green-50 text-green-600">5 left</div>
            </div>
          </div>
        </div>
      ))}
      <div className="w-16 bg-white rounded-xl border-2 border-accent overflow-hidden shadow-md scale-110">
        <div className="h-10 bg-accent/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div className="p-1.5">
          <div className="h-1.5 bg-gray-200 rounded mb-1 w-4/5" />
          <div className="bg-orange-100 text-orange-600 text-[5px] font-bold px-0.5 py-px rounded inline-block">Mix &amp; Match</div>
        </div>
      </div>
    </div>
  );
}

export function IllMixMatchPicker() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-52 overflow-hidden">
        <div className="bg-accent px-3 py-2">
          <div className="text-[8px] font-bold text-primary">Pick your items</div>
          <div className="text-[6px] text-primary/70 mb-1">3 / 5 pieces selected</div>
          <div className="h-1 bg-primary/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-3/5" />
          </div>
        </div>
        {[
          { name: 'Cheese Danish', checked: true },
          { name: 'Blueberry Muffin', checked: true },
          { name: 'Croissant', checked: true },
          { name: 'Cinnamon Roll', checked: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
            <div className={`w-3 h-3 rounded flex items-center justify-center shrink-0 ${item.checked ? 'bg-accent' : 'border border-gray-300'}`}>
              {item.checked && <svg className="w-2 h-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
            </div>
            <div className="text-[7px] text-secondary">{item.name}</div>
          </div>
        ))}
        <div className="px-2 py-1.5">
          <div className="bg-accent rounded-lg text-center text-[7px] font-bold text-primary py-1">Confirm (3 items)</div>
        </div>
      </div>
    </div>
  );
}

export function IllMixMatchCart() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-60 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <div className="text-[8px] font-semibold text-secondary">Current Order</div>
          <div className="text-[7px] text-secondary/50">2 items</div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-dashed border-gray-100">
          <div className="w-8 h-8 bg-gray-100 rounded shrink-0" />
          <div className="flex-1">
            <div className="text-[7px] font-medium text-secondary">Caramel Latte</div>
            <div className="text-[6px] text-secondary/50">₱120 × 2</div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[7px]">−</div>
            <div className="text-[7px] font-bold">2</div>
            <div className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[7px]">+</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50">
          <div className="w-8 h-8 bg-amber-50 rounded shrink-0 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <div className="text-[7px] font-medium text-secondary">Pastry Bundle</div>
              <div className="bg-amber-100 text-amber-700 text-[5px] font-bold px-0.5 rounded">Custom</div>
            </div>
            <div className="text-[6px] text-secondary/50">3 items · ₱240</div>
          </div>
          <div className="text-[6px] text-secondary/30 italic pr-1">×1 only</div>
        </div>
      </div>
    </div>
  );
}

// ── Discounts ──────────────────────────────────────────────────────────

export function IllDiscountAllItems() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full gap-5">
      <div className="w-44">
        <div className="text-[7px] text-secondary/50 mb-1.5 font-medium uppercase tracking-wide">Applies To</div>
        <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden text-[7px] font-medium">
          <div className="flex-1 py-1.5 text-center bg-accent text-primary font-bold">All Items</div>
          <div className="flex-1 py-1.5 text-center text-secondary/40">Include</div>
          <div className="flex-1 py-1.5 text-center text-secondary/40">Exclude</div>
        </div>
        <div className="mt-2 text-[6px] text-secondary/40 text-center">Discount applies to everything in the cart</div>
      </div>
      <div className="space-y-1.5">
        {['Caramel Latte','Croissant','Muffin'].map(name => (
          <div key={name} className="flex items-center gap-1.5">
            <div className="h-1.5 bg-gray-200 rounded w-16" />
            <div className="text-[5px] px-1 py-px rounded bg-green-100 text-green-700 font-bold">✓ disc</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IllDiscountInclude() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full gap-4">
      <div className="w-44">
        <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden text-[7px] font-medium mb-2">
          <div className="flex-1 py-1.5 text-center text-secondary/40">All Items</div>
          <div className="flex-1 py-1.5 text-center bg-accent text-primary font-bold">Include</div>
          <div className="flex-1 py-1.5 text-center text-secondary/40">Exclude</div>
        </div>
        <div className="space-y-1">
          {[{name:'Drinks',on:true},{name:'Pastries',on:true},{name:'Cakes',on:false}].map(cat => (
            <div key={cat.name} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded shrink-0 flex items-center justify-center ${cat.on ? 'bg-accent' : 'border border-gray-300'}`}>
                {cat.on && <svg className="w-1.5 h-1.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <div className="text-[7px] text-secondary">{cat.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {[{n:'Latte',d:true},{n:'Croissant',d:true},{n:'B-Day Cake',d:false}].map(item => (
          <div key={item.n} className="flex items-center gap-1">
            <div className="h-1.5 bg-gray-200 rounded w-14" />
            {item.d
              ? <div className="text-[5px] px-0.5 rounded bg-green-100 text-green-700 font-bold">Discounted</div>
              : <div className="text-[5px] px-0.5 rounded bg-gray-100 text-gray-400">No discount</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function IllDiscountExclude() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full gap-4">
      <div className="w-44">
        <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden text-[7px] font-medium mb-2">
          <div className="flex-1 py-1.5 text-center text-secondary/40">All Items</div>
          <div className="flex-1 py-1.5 text-center text-secondary/40">Include</div>
          <div className="flex-1 py-1.5 text-center bg-accent text-primary font-bold">Exclude</div>
        </div>
        <div className="space-y-1">
          {[{name:'Drinks',on:false},{name:'Pastries',on:false},{name:'Promos',on:true}].map(cat => (
            <div key={cat.name} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded shrink-0 flex items-center justify-center ${cat.on ? 'bg-accent' : 'border border-gray-300'}`}>
                {cat.on && <svg className="w-1.5 h-1.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <div className="text-[7px] text-secondary">{cat.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {[{n:'Latte',d:true},{n:'Croissant',d:true},{n:'Promo Bundle',d:false}].map(item => (
          <div key={item.n} className="flex items-center gap-1">
            <div className="h-1.5 bg-gray-200 rounded w-14" />
            {item.d
              ? <div className="text-[5px] px-0.5 rounded bg-green-100 text-green-700 font-bold">Discounted</div>
              : <div className="text-[5px] px-0.5 rounded bg-gray-100 text-gray-400">No discount</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sales ──────────────────────────────────────────────────────────────

export function IllSalesVoidButton() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-60 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] font-bold text-secondary">Order #0042</div>
              <div className="text-[6px] text-secondary/50">Mar 20 · 2:30 PM</div>
            </div>
            <div className="px-2 py-0.5 bg-green-100 text-green-700 text-[6px] font-bold rounded-full">PAID</div>
          </div>
        </div>
        <div className="px-3 py-1.5 border-b border-gray-100 space-y-0.5">
          <div className="flex justify-between text-[6px] text-secondary/50"><span>Caramel Latte × 2</span><span>₱240</span></div>
          <div className="flex justify-between text-[6px] text-secondary/50"><span>Croissant × 1</span><span>₱80</span></div>
          <div className="flex justify-between text-[7px] font-semibold text-secondary pt-0.5"><span>Total</span><span>₱320</span></div>
        </div>
        <div className="px-3 py-2 flex gap-2">
          <div className="flex-1 py-1.5 rounded-xl bg-red-50 border-2 border-red-400 text-[7px] font-bold text-red-600 text-center ring-2 ring-red-300/40">
            Void
          </div>
          <div className="flex-1 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-[7px] text-secondary/40 text-center">
            Close
          </div>
        </div>
      </div>
    </div>
  );
}

export function IllSalesVoidReason() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-60 overflow-hidden">
        <div className="px-3 py-2 border-b border-red-100 bg-red-50">
          <div className="text-[8px] font-bold text-red-700">Confirm Void — Order #0042</div>
          <div className="text-[6px] text-red-500/80 mt-0.5">This action will be logged and cannot be undone.</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[7px] text-secondary/60 mb-1 font-medium">Reason <span className="text-secondary/30">(optional)</span></div>
          <div className="border-2 border-gray-200 rounded-lg px-2 py-1.5 text-[7px] text-secondary/30 italic">
            e.g. Wrong order, customer cancelled...
          </div>
        </div>
        <div className="px-3 pb-2 flex gap-2">
          <div className="flex-1 py-1 rounded-lg bg-gray-100 text-[7px] text-secondary/50 text-center font-medium">Cancel</div>
          <div className="flex-1 py-1 rounded-lg bg-red-500 text-[7px] text-white text-center font-bold">Confirm Void</div>
        </div>
      </div>
    </div>
  );
}

export function IllSalesCannotUndo() {
  return (
    <div className="flex items-center justify-center p-4 w-full h-full">
      <div className="text-center w-52">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-[9px] font-bold text-secondary mb-1">No Undo Available</div>
        <div className="text-[7px] text-secondary/50 mb-3 leading-relaxed">
          The order stays visible in the log for reference, but the void cannot be reversed.
        </div>
        <div className="flex gap-2">
          <div className="flex-1 py-1 rounded-lg bg-gray-100 text-[7px] text-secondary/50 text-center">Go back</div>
          <div className="flex-1 py-1 rounded-lg bg-red-500 text-[7px] text-white font-bold text-center">Confirm</div>
        </div>
      </div>
    </div>
  );
}

// ── Inventory ──────────────────────────────────────────────────────────

export function IllInventoryDestockBtn() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <div className="text-[8px] font-bold text-secondary">Inventory</div>
          <div className="flex gap-1.5">
            <div className="px-2 py-1 rounded-lg bg-red-50 border-2 border-red-400 text-[7px] font-bold text-red-600 ring-1 ring-red-300/50">DESTOCK</div>
            <div className="px-2 py-1 rounded-lg bg-gray-100 text-[7px] text-secondary/50">+ ADD</div>
          </div>
        </div>
        {[{name:'Cheese Danish',stock:8},{name:'Blueberry Muffin',stock:12},{name:'Croissant',stock:3}].map((item,i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50">
            <div className="w-7 h-7 bg-gray-100 rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="text-[7px] font-medium text-secondary">{item.name}</div>
              <div className="text-[6px] text-secondary/40">{item.stock} in stock</div>
            </div>
            <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-secondary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IllInventoryDestockMode() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 border-b border-red-100 bg-red-50 flex items-center justify-between">
          <div className="text-[7px] font-bold text-red-700">Select items to destock</div>
          <div className="px-2 py-1 rounded-lg bg-red-500 text-[7px] font-bold text-white">DESTOCK 2</div>
        </div>
        {[{name:'Cheese Danish',stock:8,checked:true},{name:'Blueberry Muffin',stock:12,checked:false},{name:'Croissant',stock:3,checked:true}].map((item,i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 ${item.checked ? 'bg-red-50/50' : ''}`}>
            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${item.checked ? 'bg-red-500' : 'border-2 border-gray-300'}`}>
              {item.checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
            </div>
            <div className="w-7 h-7 bg-gray-100 rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="text-[7px] font-medium text-secondary">{item.name}</div>
              <div className="text-[6px] text-secondary/40">{item.stock} in stock</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IllEODPanel() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 bg-accent/5 border-b border-accent/20">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[8px] font-bold text-secondary">End-of-Day Audit</div>
              <div className="text-[6px] text-secondary/50">Mar 20, 2026</div>
            </div>
            <div className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-[6px] font-bold text-yellow-700 rounded-full">DRAFT</div>
          </div>
          <div className="flex justify-between text-[6px] text-secondary/50 mb-0.5"><span>2 / 5 items locked</span></div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-accent w-2/5 rounded-full" />
          </div>
        </div>
        <div className="px-3 py-2 space-y-1">
          {[{name:'Cheese Danish',exp:8,locked:8,diff:0},{name:'Croissant',exp:10,locked:7,diff:-3}].map((item,i) => (
            <div key={i} className="flex items-center gap-2">
              <svg className="w-2.5 h-2.5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <div className="text-[6px] text-secondary flex-1">{item.name}</div>
              <div className="text-[6px] text-secondary/40">exp {item.exp} · act {item.locked}</div>
              <div className={`text-[6px] font-bold px-0.5 rounded ${item.diff === 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{item.diff === 0 ? '✓' : item.diff}</div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-2">
          <div className="py-1 rounded-lg bg-accent/20 text-[7px] text-center text-secondary/60">Submit End-of-Day</div>
        </div>
      </div>
    </div>
  );
}

export function IllEODLockItem() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <div className="w-8 h-8 bg-gray-100 rounded-lg shrink-0" />
          <div className="flex-1">
            <div className="text-[7px] font-medium text-secondary">Blueberry Muffin</div>
            <div className="text-[6px] text-secondary/40">12 in stock</div>
          </div>
          <div className="w-6 h-6 rounded-lg bg-accent/20 border-2 border-accent flex items-center justify-center ring-2 ring-accent/30">
            <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
        </div>
        <div className="px-3 py-2 bg-gray-50">
          <div className="text-[7px] font-bold text-secondary mb-2">Lock Item — Blueberry Muffin</div>
          <div className="text-[6px] text-secondary/50 mb-1">Expected stock count</div>
          <div className="border-2 border-accent rounded-lg px-2 py-1 text-[8px] font-bold text-secondary mb-2">12</div>
          <div className="flex gap-1.5">
            <div className="flex-1 py-1 bg-gray-200 rounded text-[6px] text-secondary/50 text-center">Cancel</div>
            <div className="flex-1 py-1 bg-accent rounded text-[6px] text-primary font-bold text-center">Lock</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IllEODDiscrepancy() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 bg-red-50/50">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[7px] font-semibold text-secondary">Croissant</div>
            <div className="flex items-center gap-1">
              <div className="text-[6px] text-secondary/40">exp 10 · act 7</div>
              <div className="bg-red-100 text-red-600 text-[7px] font-bold px-1 py-0.5 rounded">−3</div>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-2">
            <svg className="w-2.5 h-2.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <div className="text-[6px] text-red-600 font-medium">Discrepancy: expected 10, actual 7 (−3)</div>
          </div>
          <div className="space-y-1">
            {['Unlock to re-count','Force carry-over (requires reason)','Send to wastage'].map((opt,i) => (
              <div key={i} className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-white border border-gray-200">
                <div className="w-2 h-2 rounded-full border border-gray-400 shrink-0" />
                <div className="text-[6px] text-secondary">{opt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IllEODSubmit() {
  const items = [
    { name: 'Cheese Danish', locked: 8 },
    { name: 'Croissant', locked: 7 },
    { name: 'Muffin', locked: 12 },
  ];
  return (
    <div className="flex items-center justify-center gap-2 p-3 w-full h-full">
      {/* Today — locked counts */}
      <div className="bg-white rounded-xl border-2 border-accent/40 overflow-hidden w-29.5 shadow-sm">
        <div className="bg-accent/10 px-2 py-1.5 border-b border-accent/20">
          <div className="text-[6px] font-bold text-accent uppercase tracking-wide">Today · End-of-Day</div>
          <div className="text-[5px] text-secondary/50">Locked counts</div>
        </div>
        <div className="px-2 py-1.5 space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="text-[6px] text-secondary truncate w-16">{item.name}</div>
              <div className="text-[7px] font-bold text-accent bg-accent/10 px-1 rounded">{item.locked}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="text-[5px] text-secondary/40 font-medium text-center leading-tight">becomes<br/>opening</div>
        <svg className="w-6 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 16">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h13m0 0l-4-4m4 4l-4 4" />
        </svg>
      </div>

      {/* Tomorrow — opening stock */}
      <div className="bg-white rounded-xl border-2 border-green-300 overflow-hidden w-29.5 shadow-sm">
        <div className="bg-green-50 px-2 py-1.5 border-b border-green-200">
          <div className="text-[6px] font-bold text-green-700 uppercase tracking-wide">Tomorrow · Opening</div>
          <div className="text-[5px] text-secondary/50">Starting stock</div>
        </div>
        <div className="px-2 py-1.5 space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="text-[6px] text-secondary truncate w-16">{item.name}</div>
              <div className="flex items-center gap-0.5">
                <div className="text-[7px] font-bold text-green-700 bg-green-50 px-1 rounded">{item.locked}</div>
                <svg className="w-2 h-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function IllUncarriedItems() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2">
          <svg className="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-[7px] font-bold text-amber-700">Items with uncarried stock</div>
        </div>
        {[
          { name: 'Ube Cake', uncarried: 5, added: 3 },
          { name: 'Ensaymada', uncarried: 8, added: 0 },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50">
            <div className="w-7 h-7 bg-gray-100 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[7px] font-medium text-secondary">{item.name}</div>
            </div>
            <div className="text-[6px] font-bold text-amber-600">
              <span className="line-through opacity-50">{item.uncarried}</span>+{item.added}
            </div>
          </div>
        ))}
        <div className="px-3 py-1.5">
          <div className="text-[5px] text-secondary/40 text-center">Uncarried stock is frozen until resolved</div>
        </div>
      </div>
    </div>
  );
}

export function IllResolveUncarried() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-64 overflow-hidden">
        <div className="px-3 py-2 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
          <div className="text-[7px] font-bold text-amber-700">Select items to resolve</div>
          <div className="flex gap-1">
            <div className="px-1.5 py-0.5 rounded bg-green-500 text-[6px] font-bold text-white">CARRY OVER 2</div>
            <div className="px-1.5 py-0.5 rounded bg-red-500 text-[6px] font-bold text-white">DESTOCK 2</div>
          </div>
        </div>
        {[
          { name: 'Ube Cake', uncarried: 5, checked: true },
          { name: 'Ensaymada', uncarried: 8, checked: true },
          { name: 'Croissant', uncarried: 3, checked: false },
        ].map((item, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 ${item.checked ? 'bg-amber-50/50' : ''}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${item.checked ? 'bg-amber-500' : 'border-2 border-amber-300'}`}>
              {item.checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
            </div>
            <div className="w-7 h-7 bg-gray-100 rounded-lg shrink-0" />
            <div className="flex-1">
              <div className="text-[7px] font-medium text-secondary">{item.name}</div>
              <div className="text-[6px] text-amber-600">{item.uncarried} uncarried</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
