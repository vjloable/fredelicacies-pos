'use client';

// ── Dashboard ──────────────────────────────────────────────────────────

export function IllDashboard() {
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full items-center justify-center">
      {/* Stat cards row */}
      <div className="flex gap-1.5 w-64">
        {[
          { label: 'Revenue', value: '₱12,450', color: 'text-accent' },
          { label: 'Orders', value: '38', color: 'text-secondary' },
          { label: 'Avg Order', value: '₱327', color: 'text-secondary' },
          { label: 'Active', value: '2/3', color: 'text-success' },
        ].map((s, i) => (
          <div key={i} className="flex-1 bg-white rounded-lg border border-gray-200 px-1.5 py-1">
            <div className="text-[5px] text-secondary/40">{s.label}</div>
            <div className={`text-[8px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Branch cards */}
      <div className="flex gap-1.5 w-64">
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-1.5">
          <div className="flex items-center gap-1 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[7px] font-bold text-secondary">Main Branch</span>
          </div>
          <div className="text-[9px] font-bold text-secondary">₱8,200</div>
          <div className="text-[5px] text-secondary/40">24 orders</div>
          <div className="flex gap-0.5 mt-1">
            <span className="text-[4px] bg-secondary/5 rounded px-0.5">Cash ₱5.2k</span>
            <span className="text-[4px] bg-secondary/5 rounded px-0.5">GCash ₱3k</span>
          </div>
        </div>
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-1.5">
          <div className="flex items-center gap-1 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-[7px] font-bold text-secondary">Sub Branch</span>
          </div>
          <div className="text-[9px] font-bold text-secondary">₱4,250</div>
          <div className="text-[5px] text-secondary/40">14 orders</div>
          <div className="mt-1">
            <span className="text-[4px] bg-amber-50 text-amber-600 rounded px-0.5">3 low stock</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cash Monitoring ────────────────────────────────────────────────────

export function IllCashMonitoring() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="flex gap-3 items-end">
        {/* TopBar shift button */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-28">
          <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-100">
            <div className="text-[6px] text-secondary/40">Top Bar</div>
          </div>
          <div className="p-2 flex items-center gap-1.5">
            <div className="h-5 px-1.5 flex items-center gap-1 bg-accent/10 rounded-md border border-accent/30">
              <svg className="w-2 h-2 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
              <span className="text-[6px] font-bold text-accent">Open Shift</span>
            </div>
          </div>
        </div>
        {/* Shift report */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-36">
          <div className="px-2 py-1 bg-success/10 border-b border-gray-100 flex items-center gap-1">
            <svg className="w-2.5 h-2.5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-[7px] font-bold text-success">Shift Report</span>
          </div>
          <div className="px-2 py-1 space-y-0.5">
            <div className="flex justify-between"><span className="text-[5px] text-secondary/50">Beginning</span><span className="text-[6px] font-bold text-secondary">₱1,000</span></div>
            <div className="flex justify-between"><span className="text-[5px] text-secondary/50">+ Cash Sales</span><span className="text-[6px] text-secondary">₱5,200</span></div>
            <div className="flex justify-between"><span className="text-[5px] text-secondary/50">- Safe Drops</span><span className="text-[6px] text-secondary">₱3,000</span></div>
            <div className="border-t border-dashed border-gray-200 my-0.5" />
            <div className="flex justify-between"><span className="text-[5px] font-bold text-secondary">Expected</span><span className="text-[6px] font-bold text-secondary">₱3,200</span></div>
            <div className="flex justify-between"><span className="text-[5px] font-bold text-secondary">Actual</span><span className="text-[6px] font-bold text-secondary">₱3,200</span></div>
            <div className="flex justify-between"><span className="text-[5px] font-bold text-success">Over/Short</span><span className="text-[6px] font-bold text-success">₱0</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auto Clock-Out ─────────────────────────────────────────────────────

export function IllAutoClockOut() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="flex flex-col items-center gap-2">
        {/* Close shift action */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-2">
          <div className="h-5 px-2 flex items-center gap-1 bg-secondary/10 rounded-md">
            <svg className="w-2.5 h-2.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span className="text-[7px] font-bold text-secondary">Close Shift</span>
          </div>
        </div>
        {/* Arrow */}
        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        {/* Workers auto-clocked out */}
        <div className="flex gap-1.5">
          {['Maria', 'Juan', 'Ana'].map((name, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 px-2 py-1.5 flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-error/10 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <div className="text-[7px] font-medium text-secondary">{name}</div>
                <div className="text-[5px] text-error">Clocked out</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Safe Drop ──────────────────────────────────────────────────────────

export function IllSafeDrop() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-52 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <div className="w-5 h-5 bg-accent/10 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <span className="text-[8px] font-bold text-secondary">Safe Drop</span>
        </div>
        <div className="p-3 space-y-2">
          <div>
            <div className="text-[6px] text-secondary/50 mb-0.5">Amount</div>
            <div className="h-6 bg-gray-50 rounded-lg border border-secondary/20 flex items-center px-2">
              <span className="text-[7px] text-secondary/40">₱</span>
              <span className="text-[9px] font-bold text-secondary ml-0.5">3,000</span>
            </div>
          </div>
          <div className="flex gap-1">
            {['₱500', '₱1k', '₱2k', '₱3k'].map((a, i) => (
              <span key={i} className={`text-[5px] font-bold px-1.5 py-0.5 rounded ${i === 3 ? 'bg-accent text-white' : 'bg-secondary/10 text-secondary'}`}>{a}</span>
            ))}
          </div>
          <div>
            <div className="text-[6px] text-secondary/50 mb-0.5">Received by</div>
            <div className="flex gap-1">
              <span className="text-[6px] px-1.5 py-0.5 rounded bg-accent text-white font-medium">Manager</span>
              <span className="text-[6px] px-1.5 py-0.5 rounded bg-gray-100 text-secondary">Owner</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Write Off ──────────────────────────────────────────────────────────

export function IllWriteOff() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-52 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <div className="w-5 h-5 bg-error/10 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <span className="text-[8px] font-bold text-secondary">Write Off</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex gap-1">
            <span className="flex-1 text-center text-[7px] font-bold py-1 rounded-lg bg-accent text-white">Free Item</span>
            <span className="flex-1 text-center text-[7px] font-bold py-1 rounded-lg bg-gray-100 text-secondary">Near Expiry</span>
          </div>
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-1.5 flex items-center justify-between">
            <div>
              <div className="text-[7px] font-bold text-secondary">Ensaymada</div>
              <div className="text-[5px] text-secondary/40">₱35 × unit · 12 in stock</div>
            </div>
            <span className="text-[6px] text-accent font-bold">Change</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[6px] text-secondary/50">Qty</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center text-[8px] text-secondary">-</span>
              <span className="w-6 h-4 border border-secondary/20 rounded flex items-center justify-center text-[8px] font-bold text-secondary">2</span>
              <span className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center text-[8px] text-secondary">+</span>
            </div>
            <span className="text-[6px] text-secondary/40 ml-auto">= ₱70</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reset Branch ───────────────────────────────────────────────────────

export function IllResetBranch() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-52 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
          <div className="w-5 h-5 bg-error/10 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <span className="text-[8px] font-bold text-secondary">Reset Branch Data</span>
        </div>
        <div className="p-2 space-y-1">
          {[
            { label: 'Reset Sales', active: false },
            { label: 'Reset Inventory', active: false },
            { label: 'Reset Everything', active: true },
          ].map((opt, i) => (
            <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${opt.active ? 'border-error bg-error/5' : 'border-gray-200'}`}>
              <div className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${opt.active ? 'border-error' : 'border-gray-300'}`}>
                {opt.active && <div className="w-1 h-1 rounded-full bg-error" />}
              </div>
              <span className="text-[6px] font-bold text-secondary">{opt.label}</span>
            </div>
          ))}
          <div className="mt-1 h-4 bg-gray-50 rounded border border-secondary/20 flex items-center px-1.5">
            <span className="text-[6px] text-secondary/30">Type branch name to confirm...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cleaner Nav ────────────────────────────────────────────────────────

export function IllCleanerNav() {
  return (
    <div className="flex items-center justify-center p-3 w-full h-full gap-4">
      {/* Before */}
      <div className="text-center">
        <div className="text-[6px] text-error font-bold mb-1">Before</div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-20 overflow-hidden">
          {['Store', 'Inventory', 'Distribution', 'Settings'].map((item, i) => (
            <div key={i} className="px-2 py-1 border-b border-gray-100 text-[6px] text-secondary">{item}</div>
          ))}
          <div className="px-2 py-0.5 bg-gray-50 text-[5px] text-secondary/30">Manager</div>
          {['Management', 'Distribution', 'Settings'].map((item, i) => (
            <div key={i} className={`px-2 py-1 border-b border-gray-100 text-[6px] ${item === 'Distribution' || item === 'Settings' ? 'text-error line-through' : 'text-secondary'}`}>{item}</div>
          ))}
        </div>
      </div>
      {/* Arrow */}
      <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
      {/* After */}
      <div className="text-center">
        <div className="text-[6px] text-success font-bold mb-1">After</div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-20 overflow-hidden">
          {['Store', 'Inventory'].map((item, i) => (
            <div key={i} className="px-2 py-1 border-b border-gray-100 text-[6px] text-secondary">{item}</div>
          ))}
          <div className="px-2 py-0.5 bg-gray-50 text-[5px] text-secondary/30">Manager</div>
          {['Management', 'Distribution', 'Settings'].map((item, i) => (
            <div key={i} className="px-2 py-1 border-b border-gray-100 text-[6px] text-secondary">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
