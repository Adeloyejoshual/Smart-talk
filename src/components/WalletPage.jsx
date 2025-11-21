// src/components/WalletPage.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { onSnapshot, doc, collection, query, where, orderBy, limit } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowLeft, Download, Printer, Copy } from "lucide-react";
import { format } from "date-fns";

/*
  WalletPage - features:
  - light-blue professional style
  - realtime Firestore listener (wallet doc & transactions)
  - pagination / 'load more' (increase limit)
  - framer-motion animations
  - skeleton loader
  - transaction modal (click outside to close)
  - CSV export and print
  - copy tx id to clipboard
*/

const PAGE_STEP = 12; // how many transactions to fetch initially and per 'load more'

export default function WalletPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [pageSize, setPageSize] = useState(PAGE_STEP);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [modalTx, setModalTx] = useState(null);
  const modalRef = useRef(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [userUid, setUserUid] = useState(null);

  // Helper: format date
  const fmt = (d) => (d ? format(new Date(d), "MMM d, yyyy - h:mm a") : "-");

  // Status color mapping
  const statusClass = (status) =>
    status === "Success" ? "text-green-600" : status === "Pending" ? "text-yellow-600" : "text-red-600";

  // Amount color
  const amountColor = (amt) => (amt > 0 ? "text-green-600" : amt < 0 ? "text-red-600" : "text-yellow-600");

  // Month label
  const monthLabel = selectedMonth.toLocaleString("default", { month: "long", year: "numeric" });

  // Realtime: subscribe to wallet doc for balance + transactions (with limit)
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        navigate("/");
        return;
      }
      setUserUid(u.uid);

      // wallet doc listener
      const walletRef = doc(db, "wallets", u.uid);
      const unsubWallet = onSnapshot(walletRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBalance(typeof data.balance === "number" ? data.balance : 0);

          // If transactions array stored on doc (fallback), set them; prefer separate collection though
          if (Array.isArray(data.transactions)) {
            setTransactions(data.transactions.slice(0, pageSize));
          }
        } else {
          // initialize doc if missing (optional)
          // setBalance(0);
        }
        setLoading(false);
        setInitialLoaded(true);
      });

      // transactions collection listener with limit
      const txCol = collection(db, "transactions");
      const txQ = query(
        txCol,
        where("uid", "==", u.uid),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
      const unsubTx = onSnapshot(txQ, (snap) => {
        const txs = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type || data.description || "Transaction",
            amount: typeof data.amount === "number" ? data.amount : Number(data.amount || 0),
            createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
            status: data.status || (data.amount > 0 ? "Success" : "Success"),
            description: data.description || "",
            transactionId: data.transactionId || d.id,
            balanceAfter: data.balanceAfter,
          };
        });
        setTransactions(txs);
        setLoading(false);
        setInitialLoaded(true);
      });

      // cleanup
      return () => {
        unsubWallet();
        unsubTx();
      };
    });

    return () => unsubAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // Increase page size -> triggers onSnapshot query update (re-run effect)
  const loadMore = () => setPageSize((s) => s + PAGE_STEP);

  // Month filter (client-side)
  const filtered = transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
  });

  // Click outside modal to close
  useEffect(() => {
    const onDocClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setModalTx(null);
      }
    };
    if (modalTx) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [modalTx]);

  // Export CSV (simple)
  const exportCSV = () => {
    if (!transactions.length) return alert("No transactions to export.");
    const rows = [["Type", "Amount", "Date", "Status", "Description", "Transaction ID", "Balance After"]];
    transactions.forEach((t) =>
      rows.push([
        t.type,
        t.amount,
        new Date(t.createdAt).toLocaleString(),
        t.status,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        t.transactionId || t.id,
        t.balanceAfter ?? "",
      ])
    );
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print modal content (open print dialog)
  const printTx = (tx) => {
    const printWindow = window.open("", "_blank", "width=600,height=800");
    const html = `
      <html><head><title>Transaction ${tx.transactionId || tx.id}</title>
      <style>
        body { font-family: system-ui, Arial; padding: 20px; color: #111; }
        .card { border-radius: 12px; padding: 16px; border: 1px solid #eee; }
        h2 { margin-top: 0; color: #0f172a; }
        p { margin: 6px 0; }
      </style>
      </head><body>
      <div class="card">
        <h2>Transaction Details</h2>
        <p><strong>Type:</strong> ${tx.type}</p>
        <p><strong>Amount:</strong> ${tx.amount > 0 ? "+" : ""}${tx.amount}</p>
        <p><strong>Date:</strong> ${new Date(tx.createdAt).toLocaleString()}</p>
        <p><strong>Status:</strong> ${tx.status}</p>
        <p><strong>ID:</strong> ${tx.transactionId || tx.id}</p>
        <p><strong>Description:</strong> ${tx.description || ""}</p>
      </div>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Copy transaction id
  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      alert("Transaction ID copied to clipboard");
    } catch {
      alert("Copy failed");
    }
  };

  // Skeleton placeholder rows
  const SkeletonRow = () => (
    <div className="animate-pulse flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
      <div className="w-2/3">
        <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-28" />
      </div>
      <div className="text-right">
        <div className="h-4 bg-gray-200 rounded w-20 ml-auto mb-2" />
        <div className="h-3 bg-gray-200 rounded w-16 ml-auto" />
      </div>
    </div>
  );

  // When scroll top of list -> update selectedMonth label based on first visible transaction (optional)
  // (Not implemented complexly here to keep code readable.)

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-full bg-white shadow-sm hover:bg-gray-50"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Wallet</h1>
            <p className="text-sm text-slate-500">Manage balance, top-up & history</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-sm hover:bg-gray-50"
              title="Export CSV"
            >
              <Download className="w-4 h-4 text-slate-700" />
              <span className="text-sm text-slate-700">Export</span>
            </button>
          </div>
        </div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-lg flex flex-col items-center"
        >
          <p className="text-sm text-slate-500">Current Balance</p>

          <div className="mt-2 mb-4 flex items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 flex flex-col items-center justify-center shadow-md">
              <span className="text-xs text-slate-500">Balance</span>
              <span className="text-2xl font-bold text-slate-900">${(balance || 0).toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate("/topup")}
                className="px-4 py-3 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold shadow-sm"
              >
                💳 Top-Up
              </button>
              <button
                onClick={() => navigate("/withdraw")}
                className="px-4 py-3 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold shadow-sm"
              >
                💸 Withdraw
              </button>
              <button
                onClick={() => {
                  // daily check-in quick client feedback; server route should also be called
                  // For UX show small animation; actual crediting occurs via server or wallet doc update
                  const reward = 0.25;
                  alert(`Daily check-in claimed: +$${reward.toFixed(2)}`);
                }}
                className="px-4 py-2 rounded-full bg-white hover:bg-gray-50 text-slate-700 font-medium shadow-sm"
              >
                🧩 Check-In
              </button>
            </div>
          </div>

          {/* Month selector */}
          <div className="w-full flex items-center justify-between mt-3">
            <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full shadow-sm">
              <span className="text-sm font-medium text-slate-700">{monthLabel}</span>
              <button
                onClick={() => setMonthPickerOpen((s) => !s)}
                className="p-1 rounded-full hover:bg-white"
                aria-label="Choose month"
              >
                <ChevronDown className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // print all (simple)
                  window.print();
                }}
                className="p-2 rounded-full bg-white shadow-sm hover:bg-gray-50"
                title="Print"
              >
                <Printer className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* month picker dropdown */}
        <div className="relative">
          <AnimatePresence>
            {monthPickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 bg-white shadow rounded-xl p-3 w-64"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(i);
                  const label = d.toLocaleString("default", { month: "long", year: "numeric" });
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedMonth(d);
                        setMonthPickerOpen(false);
                      }}
                      className="px-3 py-2 rounded hover:bg-blue-50 cursor-pointer"
                    >
                      {label}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* transaction history */}
        <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
            <div className="text-sm text-slate-500">{filtered.length} items</div>
          </div>

          <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-2">
            {loading && !initialLoaded ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No transactions for this month.</div>
            ) : (
              filtered.map((tx) => (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-50 p-3 rounded-lg flex justify-between items-center hover:shadow-md cursor-pointer"
                  onClick={() => setModalTx(tx)}
                >
                  <div>
                    <div className="font-medium text-slate-800">{tx.type}</div>
                    <div className="text-sm text-slate-500">{fmt(tx.createdAt)}</div>
                  </div>

                  <div className="text-right">
                    <div className={`font-semibold ${amountColor(tx.amount)}`}>
                      {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)}
                    </div>
                    <div className={`text-sm ${statusClass(tx.status)}`}>{tx.status}</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Load more */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              className="px-4 py-2 rounded-full bg-white shadow-sm hover:bg-gray-50"
            >
              Load more
            </button>
          </div>
        </div>

        {/* Transaction Modal */}
        <AnimatePresence>
          {modalTx && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                ref={modalRef}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-6 w-[min(520px,92%)] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-1">Transaction Details</h3>
                    <div className="text-sm text-slate-500">ID: {modalTx.transactionId || modalTx.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyId(modalTx.transactionId || modalTx.id)}
                      className="p-2 rounded-full bg-slate-50 hover:bg-slate-100"
                      title="Copy ID"
                    >
                      <Copy className="w-4 h-4 text-slate-700" />
                    </button>
                    <button
                      onClick={() => printTx(modalTx)}
                      className="p-2 rounded-full bg-slate-50 hover:bg-slate-100"
                      title="Print"
                    >
                      <Printer className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-slate-500">Type</div>
                    <div className="font-medium text-slate-900">{modalTx.type}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Amount</div>
                    <div className={`font-medium ${amountColor(modalTx.amount)}`}>
                      {modalTx.amount > 0 ? `+${modalTx.amount.toFixed(2)}` : modalTx.amount.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">Date</div>
                    <div className="font-medium text-slate-900">{fmt(modalTx.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Status</div>
                    <div className={`font-medium ${statusClass(modalTx.status)}`}>{modalTx.status}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-slate-500">Description</div>
                    <div className="font-medium text-slate-700">{modalTx.description || "-"}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-slate-500">Balance After</div>
                    <div className="font-medium text-slate-700">
                      {modalTx.balanceAfter !== undefined ? `$${modalTx.balanceAfter.toFixed(2)}` : "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => setModalTx(null)}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}