import React, { useState, useEffect } from "react";

interface Department {
  id: number;
  name: string;
}

interface AuditCycle {
  id: number;
  name: string;
  department_id: number;
  department_name: string;
  start_date: string;
  end_date: string;
  auditors: string;
  status: "open" | "closed";
  created_at: string;
}

interface AuditItem {
  id: number;
  audit_id: number;
  asset_id: number;
  asset_tag: string;
  asset_name: string;
  expected_location: string;
  verification_status: "pending" | "verified" | "missing" | "damaged";
  updated_at: string;
}

const API_BASE = "http://localhost:8000/api";

export default function AssetAudit() {
  // Master lists
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Selected cycle and its items
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State: Create Audit Cycle
  const [cycleName, setCycleName] = useState("");
  const [targetDeptId, setTargetDeptId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [auditorsList, setAuditorsList] = useState("");

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submittingCycle, setSubmittingCycle] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load initial cycles and departments
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [cycleRes, deptRes] = await Promise.all([
          fetch(`${API_BASE}/audits`),
          fetch(`${API_BASE}/departments`)
        ]);

        if (cycleRes.ok) {
          const cyclesData = await cycleRes.json();
          setCycles(cyclesData);
          if (cyclesData.length > 0) {
            setSelectedCycleId(cyclesData[0].id.toString());
          }
        }
        if (deptRes.ok) setDepartments(await deptRes.json());
      } catch (err: any) {
        setError(err.message || "Failed to load audit cycles.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Load audit items when selected cycle changes
  useEffect(() => {
    if (!selectedCycleId) {
      setAuditItems([]);
      return;
    }

    async function fetchItems() {
      setLoadingItems(true);
      try {
        const response = await fetch(`${API_BASE}/audits/${selectedCycleId}/items`);
        if (response.ok) {
          setAuditItems(await response.json());
        }
      } catch (err) {
        console.error("Failed to load audit items:", err);
      } finally {
        setLoadingItems(false);
      }
    }
    fetchItems();
  }, [selectedCycleId]);

  // Create new audit cycle
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!targetDeptId) {
      setFeedback({ type: "error", message: "Please select a department." });
      return;
    }

    setSubmittingCycle(true);

    try {
      const response = await fetch(`${API_BASE}/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cycleName,
          department_id: parseInt(targetDeptId),
          start_date: startDate,
          end_date: endDate,
          auditors: auditorsList
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create audit cycle.");
      }

      setFeedback({ type: "success", message: "Audit cycle initiated!" });
      setCycleName("");
      setTargetDeptId("");
      
      // Refresh cycles list
      const cycleRes = await fetch(`${API_BASE}/audits`);
      if (cycleRes.ok) {
        const refreshedCycles = await cycleRes.json();
        setCycles(refreshedCycles);
        // Select the newly created cycle
        if (refreshedCycles.length > 0) {
          setSelectedCycleId(refreshedCycles[refreshedCycles.length - 1].id.toString());
        }
      }

      setTimeout(() => {
        setIsCreateOpen(false);
        setFeedback(null);
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to submit request." });
    } finally {
      setSubmittingCycle(false);
    }
  };

  // Toggle item verification status
  const handleToggleVerification = async (
    itemId: number,
    newStatus: AuditItem["verification_status"]
  ) => {
    const cycle = getSelectedCycle();
    if (cycle?.status === "closed") return; // Read-only once closed

    try {
      const response = await fetch(`${API_BASE}/audit-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_status: newStatus })
      });

      if (response.ok) {
        // Optimistic UI or local update
        setAuditItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, verification_status: newStatus } : item
          )
        );
      }
    } catch (err) {
      console.error("Failed to update verification status:", err);
    }
  };

  // Close audit cycle
  const handleCloseCycle = async () => {
    if (!selectedCycleId) return;

    const confirmClose = window.confirm(
      "Are you sure you want to close this audit cycle? This will lock all verification records and update missing assets to 'Lost'."
    );
    if (!confirmClose) return;

    try {
      const response = await fetch(`${API_BASE}/audits/${selectedCycleId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        // Refresh cycles
        const cycleRes = await fetch(`${API_BASE}/audits`);
        if (cycleRes.ok) setCycles(await cycleRes.json());
        
        // Refresh items
        const itemsRes = await fetch(`${API_BASE}/audits/${selectedCycleId}/items`);
        if (itemsRes.ok) setAuditItems(await itemsRes.json());

        alert("Audit cycle closed and locked successfully.");
      } else {
        const data = await response.json();
        alert(data.detail || "Failed to close cycle.");
      }
    } catch (err) {
      console.error("Failed to close cycle:", err);
    }
  };

  const getSelectedCycle = () => {
    return cycles.find((c) => c.id.toString() === selectedCycleId);
  };

  // Discrepancy count (Missing + Damaged)
  const getDiscrepancyCount = () => {
    return auditItems.filter((i) => i.verification_status === "missing" || i.verification_status === "damaged").length;
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f3f4f6] p-6 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Asset Auditing
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Conduct department physical inventory checks and resolve discrepancies</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-900 font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Cycle
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-neutral-400">
          <svg className="animate-spin h-8 w-8 text-emerald-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p>Loading audit cycles...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 text-center text-rose-400">
          <p className="font-bold">Error Loading View</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-[#15191f] border border-[#232a35] rounded-2xl p-16 text-center text-neutral-500">
          <svg className="w-12 h-12 text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-base font-semibold">No audit cycles active</p>
          <p className="text-xs text-neutral-600 mt-1">Initiate a physical inventory check cycle to verify your active assets.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cycle Selector & Header Details */}
          <div className="bg-[#15191f] border border-[#232a35] rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Select Audit Cycle</label>
              <select
                value={selectedCycleId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCycleId(e.target.value)}
                className="bg-[#1c222b] border border-[#2d3746] text-neutral-300 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer min-w-[280px]"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {getSelectedCycle() && (
              <div className="flex-1 md:text-right space-y-1">
                <h3 className="text-lg font-bold text-white">
                  {getSelectedCycle()?.name}
                </h3>
                <p className="text-xs text-neutral-400">
                  Auditors: <span className="text-white font-semibold">{getSelectedCycle()?.auditors || "Unassigned"}</span>
                </p>
                <div className="flex flex-wrap md:justify-end gap-3 text-[10px] uppercase font-bold tracking-wider pt-1">
                  <span className="text-neutral-500">
                    Dept: <span className="text-white">{getSelectedCycle()?.department_name}</span>
                  </span>
                  <span className="text-neutral-500">
                    Period: <span className="text-white">{getSelectedCycle()?.start_date} to {getSelectedCycle()?.end_date}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Discrepancy Banner */}
          {auditItems.length > 0 && getDiscrepancyCount() > 0 && (
            <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 text-amber-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-semibold">
                  {getDiscrepancyCount()} assets flagged – discrepancy report generated automatically
                </span>
              </div>
            </div>
          )}

          {/* Checklist Table */}
          <div className="bg-[#15191f] border border-[#232a35] rounded-2xl overflow-hidden shadow-md">
            {loadingItems ? (
              <div className="p-16 text-center text-neutral-400">
                <svg className="animate-spin h-6 w-6 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p>Loading checklist items...</p>
              </div>
            ) : auditItems.length === 0 ? (
              <div className="p-16 text-center text-neutral-500">
                <p className="text-base font-semibold">No assets populated in this audit</p>
                <p className="text-xs text-neutral-600 mt-1">This department might not have any active allocations registered.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1c222b] text-[11px] font-bold text-neutral-400 uppercase tracking-wider border-b border-[#232a35]">
                      <th className="p-4 pl-6">Asset Details</th>
                      <th className="p-4">Expected Location</th>
                      <th className="p-4">Verification Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232a35]">
                    {auditItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1a2029]">
                        <td className="p-4 pl-6">
                          <span className="font-mono font-bold text-emerald-400 block">{item.asset_tag}</span>
                          <span className="text-xs text-neutral-300 font-semibold">{item.asset_name}</span>
                        </td>
                        <td className="p-4 text-xs text-neutral-400 font-medium">
                          {item.expected_location || "Not specified"}
                        </td>
                        <td className="p-4">
                          {getSelectedCycle()?.status === "closed" ? (
                            /* Read-only badges once closed */
                            <span
                              className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                                item.verification_status === "verified"
                                  ? "bg-emerald-950/40 border border-emerald-900/60 text-emerald-400"
                                  : item.verification_status === "missing"
                                  ? "bg-rose-950/40 border border-rose-900/60 text-rose-400"
                                  : item.verification_status === "damaged"
                                  ? "bg-amber-950/40 border border-amber-900/60 text-amber-400"
                                  : "bg-neutral-900 border border-neutral-800 text-neutral-500"
                              }`}
                            >
                              {item.verification_status}
                            </span>
                          ) : (
                            /* 3-way toggle for active audits */
                            <div className="flex gap-1.5 max-w-xs">
                              <button
                                onClick={() => handleToggleVerification(item.id, "verified")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                                  item.verification_status === "verified"
                                    ? "bg-emerald-900/65 border-emerald-600 text-white"
                                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white"
                                }`}
                              >
                                Verified
                              </button>
                              <button
                                onClick={() => handleToggleVerification(item.id, "missing")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                                  item.verification_status === "missing"
                                    ? "bg-rose-900/65 border-rose-600 text-white"
                                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white"
                                }`}
                              >
                                Missing
                              </button>
                              <button
                                onClick={() => handleToggleVerification(item.id, "damaged")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                                  item.verification_status === "damaged"
                                    ? "bg-amber-900/65 border-amber-600 text-white"
                                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white"
                                }`}
                              >
                                Damaged
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Row */}
          {getSelectedCycle()?.status === "open" && auditItems.length > 0 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleCloseCycle}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-900 font-bold px-6 py-3 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Close Audit Cycle
              </button>
            </div>
          )}
        </div>
      )}

      {/* Initiate Cycle Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#15191f] border border-[#232a35] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-[#1c222b] p-5 border-b border-[#232a35]">
              <h2 className="text-lg font-bold text-white">Initiate Physical Inventory Cycle</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateCycle} className="p-6 space-y-4">
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold border ${
                    feedback.type === "success"
                      ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-400"
                      : "bg-rose-950/40 border-rose-800/80 text-rose-400"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {/* Cycle Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Cycle Name *</label>
                <input
                  type="text"
                  required
                  value={cycleName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCycleName(e.target.value)}
                  placeholder="e.g. Q3 audit: Engineering dept"
                  className="w-full px-3.5 py-2.5 bg-[#1c222b] border border-[#2d3746] rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white placeholder-neutral-600"
                />
              </div>

              {/* Target Department Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Scope Department *</label>
                <select
                  required
                  value={targetDeptId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetDeptId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1c222b] border border-[#2d3746] rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white cursor-pointer"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1c222b] border border-[#2d3746] rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#1c222b] border border-[#2d3746] rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
              </div>

              {/* Auditors */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Auditors *</label>
                <input
                  type="text"
                  required
                  value={auditorsList}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuditorsList(e.target.value)}
                  placeholder="e.g. A. Rao, S. Iqbal"
                  className="w-full px-3.5 py-2.5 bg-[#1c222b] border border-[#2d3746] rounded-xl text-sm focus:outline-none focus:border-emerald-500 text-white placeholder-neutral-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-[#232a35]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCycle}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-900 font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingCycle ? "Initiating..." : "Start Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
