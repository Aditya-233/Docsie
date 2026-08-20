"use client";

import { useState, useMemo } from "react";
import {
  History,
  X,
  RotateCcw,
  Check,
  Edit2,
  Loader2,
} from "lucide-react";

export interface DocumentSnapshot {
  id: string;
  timestamp: string;
  name?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    color?: string;
  };
  content?: any;
  changesCount?: number;
  isCurrent?: boolean;
}

export interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  ydoc?: any;
  snapshots?: DocumentSnapshot[];
  currentVersionId?: string;
  onSelectVersion?: (snapshot: DocumentSnapshot) => void;
  onRestoreVersion?: (snapshot: DocumentSnapshot) => Promise<void> | void;
  onNameVersion?: (snapshotId: string, customName: string) => void;
}

const DEFAULT_SNAPSHOTS: DocumentSnapshot[] = [
  {
    id: "ver-current",
    timestamp: new Date().toISOString(),
    name: "Current version",
    author: {
      id: "u1",
      name: "You",
      color: "#1A73E8",
    },
    isCurrent: true,
  },
  {
    id: "ver-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    name: "Initial Draft",
    author: {
      id: "u2",
      name: "Alice Smith",
      color: "#34A853",
    },
    changesCount: 42,
  },
  {
    id: "ver-0",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    name: "Document Created",
    author: {
      id: "u1",
      name: "You",
      color: "#1A73E8",
    },
    changesCount: 12,
  },
];

export function VersionHistoryDrawer({
  isOpen,
  onClose,
  snapshots: propSnapshots,
  currentVersionId,
  onSelectVersion,
  onRestoreVersion,
  onNameVersion,
}: VersionHistoryDrawerProps) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(
    currentVersionId || null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [onlyNamed, setOnlyNamed] = useState(false);

  const snapshots = useMemo(() => {
    return propSnapshots && propSnapshots.length > 0 ? propSnapshots : DEFAULT_SNAPSHOTS;
  }, [propSnapshots]);

  const filteredSnapshots = useMemo(() => {
    if (onlyNamed) {
      return snapshots.filter((s) => s.name && s.name.trim().length > 0);
    }
    return snapshots;
  }, [snapshots, onlyNamed]);

  const formatSnapshotDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Earlier";
    }
  };

  const formatSnapshotTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const handleStartRename = (s: DocumentSnapshot) => {
    setEditingId(s.id);
    setEditName(s.name || "");
  };

  const handleSaveRename = (snapshotId: string) => {
    if (onNameVersion && editName.trim()) {
      onNameVersion(snapshotId, editName.trim());
    }
    setEditingId(null);
  };

  const handleRestore = async (snapshot: DocumentSnapshot) => {
    if (!onRestoreVersion) return;
    setIsRestoring(true);
    try {
      await onRestoreVersion(snapshot);
      setRestoreSuccess(true);
      setTimeout(() => setRestoreSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className="w-80 md:w-96 bg-white border-l border-gray-200 h-full flex flex-col shadow-xl z-30 transition-all duration-200 animate-in slide-in-from-right"
      aria-label="Version History"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Version History</h2>
            <p className="text-[11px] text-gray-400">View and restore previous edits</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          title="Close version history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Options */}
      <div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyNamed}
            onChange={(e) => setOnlyNamed(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500"
          />
          <span>Only show named versions</span>
        </label>
        <span className="text-[11px] text-gray-400 font-medium">
          {filteredSnapshots.length} {filteredSnapshots.length === 1 ? "version" : "versions"}
        </span>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredSnapshots.map((snapshot) => {
          const isSelected = selectedSnapshotId === snapshot.id;
          const isCurrent = snapshot.isCurrent || snapshot.id === currentVersionId;

          return (
            <div
              key={snapshot.id}
              onClick={() => {
                setSelectedSnapshotId(snapshot.id);
                onSelectVersion?.(snapshot);
              }}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                isSelected
                  ? "border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-400"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
              }`}
            >
              {/* Top row: Name & timestamp */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingId === snapshot.id ? (
                    <div
                      className="flex items-center gap-1 mb-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(snapshot.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        placeholder="Version name..."
                        className="text-xs p-1 border border-blue-400 rounded focus:outline-none w-full bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(snapshot.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {snapshot.name || `${formatSnapshotDate(snapshot.timestamp)}, ${formatSnapshotTime(snapshot.timestamp)}`}
                      </span>
                      {onNameVersion && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(snapshot);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-0.5 transition-opacity"
                          title="Name this version"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                    <span>{formatSnapshotDate(snapshot.timestamp)}</span>
                    <span>•</span>
                    <span>{formatSnapshotTime(snapshot.timestamp)}</span>
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[10px] font-medium uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                    Current
                  </span>
                )}
              </div>

              {/* Author & changes */}
              <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold uppercase shadow-2xs shrink-0"
                    style={{ backgroundColor: snapshot.author.color || "#1A73E8" }}
                  >
                    {snapshot.author.avatar ? (
                      <img
                        src={snapshot.author.avatar}
                        alt={snapshot.author.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      snapshot.author.name.charAt(0)
                    )}
                  </div>
                  <span className="text-gray-700 text-xs truncate max-w-[120px]">
                    {snapshot.author.name}
                  </span>
                </div>

                {snapshot.changesCount !== undefined && (
                  <span className="text-[11px] text-gray-400">
                    {snapshot.changesCount} edits
                  </span>
                )}
              </div>

              {/* Restore action button (if selected and not current) */}
              {isSelected && !isCurrent && onRestoreVersion && (
                <div
                  className="mt-3 pt-2 border-t border-blue-200/60 flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleRestore(snapshot)}
                    disabled={isRestoring}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : restoreSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Restored!</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore this version</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
        <p className="text-[11px] text-gray-400">
          Versions are recorded automatically via CRDT snapshot intervals.
        </p>
      </div>
    </aside>
  );
}
