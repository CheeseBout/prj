"use client";

import { FormEvent, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { Search, Volume2, Edit2, Plus, X, Tag as TagIcon, Filter } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { getVocabList, VocabItem, getTags, TagOption, getPracticeSpecializations, SpecializationOption, syncTags, overrideSpecialization } from "@/lib/api";

const getTagColor = (tag: string) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 40%)`;
};

type StatusFilter = "all" | "unseen" | "learning" | "mastered";

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unseen", label: "Unseen" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
];

const statusIndicator: Record<string, string> = {
  unseen: "#999",
  learning: "#E85D04",
  mastered: "#1A1A1A",
};

export const VocabClient = () => {
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");

  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTag ? [initialTag] : []);
  const [selectedSpec, setSelectedSpec] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters data
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [allSpecs, setAllSpecs] = useState<SpecializationOption[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VocabItem | null>(null);
  const [modalWord, setModalWord] = useState("");
  const [modalSpec, setModalSpec] = useState("");
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [specInputFocused, setSpecInputFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load filter options
    getTags().then(res => setAllTags(res.data || [])).catch(() => {});
    getPracticeSpecializations().then(res => setAllSpecs(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const tag = searchParams.get("tag");
    if (tag) {
      setSelectedTags([tag]);
      setPage(1); // reset pagination when filter changes from URL
    } else {
      setSelectedTags([]);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getVocabList(
        page,
        20,
        searchQuery,
        status === "all" ? undefined : status,
        selectedSpec === "all" ? undefined : selectedSpec,
        undefined,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setItems(response.data);
      setTotal(response.total);
    } catch (loadError: unknown) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("Could not load vocabulary list.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, status, selectedSpec, selectedTags]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const totalPages = Math.max(Math.ceil(total / 20), 1);

  const handleOpenModal = (item?: VocabItem) => {
    if (item) {
      setEditingItem(item);
      setModalWord(item.word);
      setModalSpec(item.specialization || "");
      setModalTags(item.tags || []);
    } else {
      setEditingItem(null);
      setModalWord("");
      setModalSpec("");
      setModalTags([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = async () => {
    setIsSaving(true);
    try {
      if (editingItem) {
        await Promise.all([
          overrideSpecialization(modalWord, modalSpec),
          syncTags(modalWord, modalTags)
        ]);
        
        // Update local state to reflect changes instantly
        const updated = items.map(it => {
          if (it.word === modalWord) {
            return { ...it, specialization: modalSpec, tags: modalTags };
          }
          return it;
        });
        setItems(updated);
      }
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setIsSaving(false);
      setIsModalOpen(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,$/, '');
      if (val && !modalTags.includes(val)) {
        setModalTags([...modalTags, val]);
      }
      setTagInput("");
    } else if (e.key === 'Backspace' && !tagInput && modalTags.length > 0) {
      setModalTags(modalTags.slice(0, -1));
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header>
        <p className="editorial-meta">Collection</p>
        <h1 className="mt-2 font-serif text-4xl md:text-5xl">
          Vocabulary <em className="italic">Hub.</em>
        </h1>
        <p className="mt-2 text-sm text-foreground/50">
          Manage saved words with context, status, and learning priorities.
        </p>
      </header>

      {/* ── Filter Toolbar ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-foreground/10 pb-6 md:flex-row md:items-center md:justify-between">
        {/* Status tabs */}
        <div className="flex gap-0 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                status === tab.value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative">
            <select
              value={selectedSpec}
              onChange={(e) => { setSelectedSpec(e.target.value); setPage(1); }}
              className="appearance-none border border-foreground/15 bg-transparent px-3 py-1.5 pr-8 text-sm outline-none transition focus:border-accent"
            >
              <option value="all">All Specs</option>
              {allSpecs.map(s => (
                <option key={s.specialization} value={s.specialization}>{s.specialization}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
              className={`flex items-center gap-2 border border-foreground/15 bg-transparent px-3 py-1.5 text-sm transition hover:border-accent ${selectedTags.length > 0 ? "border-accent text-accent" : ""}`}
            >
              <Filter size={14} />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>
            {isTagFilterOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 border border-foreground/10 bg-white p-2 shadow-lg">
                {allTags.length === 0 ? (
                  <p className="text-xs text-foreground/50 p-2">No tags found.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                    {allTags.map(t => (
                      <label key={t.tag} className="flex items-center gap-2 px-2 py-1.5 hover:bg-foreground/5 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(t.tag)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTags([...selectedTags, t.tag]);
                            else setSelectedTags(selectedTags.filter(x => x !== t.tag));
                            setPage(1);
                          }}
                        />
                        {t.tag}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-foreground/25"
              size={16}
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full border-b border-foreground/15 bg-transparent pb-1.5 pl-7 text-sm outline-none transition focus:border-accent md:w-48"
            />
          </form>
          
          <button
            onClick={() => handleOpenModal()}
            className="flex h-8 w-8 items-center justify-center rounded-sm bg-foreground text-background transition hover:bg-foreground/80 md:h-auto md:w-auto md:px-3 md:py-1.5 md:text-sm font-medium"
            title="Add new word"
          >
            <Plus size={16} className="md:mr-1" />
            <span className="hidden md:inline">Add</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Word Grid ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="editorial-meta animate-pulse">Loading vocabulary...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-foreground/40">
            No entries match the current filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <article
              key={`${item.word}-${index}`}
              className="group relative border border-foreground/10 bg-white p-6 transition hover:border-foreground/20"
            >
              {/* Status indicator line */}
              <div
                className="absolute left-0 top-0 h-full w-0.5"
                style={{
                  backgroundColor: statusIndicator[item.status] ?? "#999",
                }}
              />

              {/* Top section: word + pronunciation */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-bold flex items-center gap-2">
                    {item.word}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground/50">
                    <span className="flex items-center gap-1 group/spec relative cursor-pointer" onClick={() => handleOpenModal(item)}>
                      {item.specialization
                        ? item.specialization.charAt(0).toUpperCase() +
                          item.specialization.slice(1)
                        : "General"}
                      <Edit2 size={10} className="opacity-0 transition-opacity group-hover/spec:opacity-100" />
                    </span>
                    <span>·</span>
                    <span>
                      {item.difficulty
                        ? item.difficulty.charAt(0).toUpperCase() +
                          item.difficulty.slice(1)
                        : "Intermediate"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground/30 transition hover:bg-foreground/5 hover:text-foreground/60"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground/30 transition hover:bg-foreground/5 hover:text-foreground/60"
                    title="Pronounce"
                  >
                    <Volume2 size={14} />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-foreground/8" />

              {/* Bottom section: Vietnamese meaning */}
              <p className="text-sm text-foreground/65">
                {item.translation || "No translation available"}
              </p>
              {item.context && (
                <p className="mt-2 line-clamp-2 text-xs text-foreground/35">
                  &ldquo;{item.context}&rdquo;
                </p>
              )}

              {/* Tags row */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags?.map(tag => (
                  <span 
                    key={tag} 
                    className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${getTagColor(tag)}15`, color: getTagColor(tag), border: `1px solid ${getTagColor(tag)}30` }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Status badge */}
              <div className="mt-4 flex items-center justify-between">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor:
                      item.status === "mastered"
                        ? "rgba(26,26,26,0.06)"
                        : item.status === "learning"
                        ? "rgba(232,93,4,0.08)"
                        : "rgba(153,153,153,0.1)",
                    color: statusIndicator[item.status] ?? "#999",
                  }}
                >
                  {item.status}
                </span>
                {item.next_review_date && (
                  <span className="text-[10px] text-foreground/30">
                    {new Date(item.next_review_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-foreground/10 pt-6">
        <p className="text-xs text-foreground/40">
          {total} total · Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="border border-foreground/10 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="border border-foreground/10 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>

      {/* ── Add / Edit Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
              <h2 className="font-serif text-2xl font-bold">
                {editingItem ? "Edit Vocabulary" : "Add Vocabulary"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            
            <div className="mt-6 space-y-5">
              {/* Word Input */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/50">Word</label>
                <input
                  type="text"
                  value={modalWord}
                  onChange={(e) => setModalWord(e.target.value)}
                  disabled={!!editingItem}
                  className="w-full border border-foreground/15 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
                  placeholder="e.g. ubiquitous"
                />
              </div>

              {/* Specialization Input */}
              <div className="relative">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  Specialization <span className="text-[10px] lowercase text-foreground/30 font-normal">(AI predicted)</span>
                </label>
                <input
                  type="text"
                  value={modalSpec}
                  onChange={(e) => setModalSpec(e.target.value)}
                  onFocus={() => setSpecInputFocused(true)}
                  onBlur={() => setTimeout(() => setSpecInputFocused(false), 200)}
                  className="w-full border border-foreground/15 px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="e.g. computer vision"
                />
                {specInputFocused && allSpecs.length > 0 && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-32 w-full overflow-y-auto border border-foreground/10 bg-white shadow-lg">
                    {allSpecs.filter(s => s.specialization.toLowerCase().includes(modalSpec.toLowerCase())).map(s => (
                      <div 
                        key={s.specialization} 
                        className="cursor-pointer px-3 py-2 text-sm hover:bg-foreground/5"
                        onClick={() => { setModalSpec(s.specialization); setSpecInputFocused(false); }}
                      >
                        {s.specialization}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Input */}
              <div className="relative">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/50">Tags</label>
                <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 border border-foreground/15 bg-white p-1.5 focus-within:border-accent transition">
                  {modalTags.map(tag => (
                    <span 
                      key={tag} 
                      className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium"
                      style={{ backgroundColor: `${getTagColor(tag)}15`, color: getTagColor(tag) }}
                    >
                      {tag}
                      <button type="button" onClick={() => setModalTags(modalTags.filter(t => t !== tag))} className="hover:opacity-70">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder={modalTags.length === 0 ? "Add tags..." : ""}
                    className="flex-1 min-w-[80px] bg-transparent text-sm outline-none px-1 py-0.5"
                  />
                </div>
                {/* Auto-complete dropdown */}
                {showTagSuggestions && (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-y-auto border border-foreground/10 bg-white shadow-lg">
                    {allTags
                      .filter(t => t.tag.toLowerCase().includes(tagInput.toLowerCase()) && !modalTags.includes(t.tag))
                      .map(t => (
                        <div 
                          key={t.tag} 
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-foreground/5 flex items-center justify-between"
                          onMouseDown={(e) => {
                            e.preventDefault(); // prevent blur
                            setModalTags([...modalTags, t.tag]);
                            setTagInput("");
                            setShowTagSuggestions(false);
                          }}
                        >
                          <span style={{ color: getTagColor(t.tag) }} className="font-medium">#{t.tag}</span>
                          <span className="text-xs text-foreground/30">{t.word_count} words</span>
                        </div>
                    ))}
                    {allTags.filter(t => t.tag.toLowerCase().includes(tagInput.toLowerCase()) && !modalTags.includes(t.tag)).length === 0 && tagInput.trim() && (
                      <div className="px-3 py-2 text-sm text-foreground/40 italic">
                        Press Enter to create &quot;{tagInput}&quot;
                      </div>
                    )}
                    {allTags.filter(t => !modalTags.includes(t.tag)).length === 0 && !tagInput.trim() && (
                      <div className="px-3 py-2 text-sm text-foreground/40 italic">
                        No tags available.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground/60 transition hover:text-foreground"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveModal}
                disabled={isSaving}
                className="bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/80 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
