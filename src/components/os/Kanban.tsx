"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { setTaskStatus } from "@/lib/os/actions/work";
import { label } from "@/lib/os/format";

type Card = { id: string; title: string; status: string; sub?: string; due?: string; late?: boolean; updated_at: string; waiting?: boolean };

const COLUMNS = ["todo", "in_progress", "blocked", "done"] as const;
// Older tasks can still be in a review state. They sit with the work they are closest to.
// A task waiting on an earlier one hasn't started, which is different from someone being stuck.
const columnOf = (c: Pick<Card, "status" | "waiting">) => (c.waiting || c.status === "revisions_requested" ? "todo" : c.status === "submitted" ? "in_progress" : c.status);

/** Drag between columns, or use the select on any card: keyboard users get the same move. */
export function Kanban({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  function move(card: Card, status: string) {
    if (columnOf(card) === status) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", card.id);
      fd.set("status", status);
      fd.set("expected", card.updated_at);
      const result = await setTaskStatus(null, fd);
      if (!result.ok) setError(result.error ?? "That move did not work.");
      router.refresh();
    });
  }

  const unassigned = cards.filter(c => c.status === "unassigned");
  return (
    <div aria-busy={pending}>
      {error ? <p className="os-form-error" role="alert">{error}</p> : null}
      {unassigned.length ? <p className="os-muted">{unassigned.length} waiting for someone to take: {unassigned.slice(0, 5).map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link className="os-link" href={`/os/tasks/${c.id}`}>{c.title}</Link></span>)}</p> : null}
      <div className="os-kanban" tabIndex={0} role="group" aria-label="Task board">
        {COLUMNS.map(column => {
          const list = cards.filter(c => columnOf(c) === column);
          return (
            <section
              key={column}
              className={`os-kanban-col is-${column}`}
              aria-label={label(column)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                const card = cards.find(c => c.id === dragging);
                if (card && card.status !== "unassigned" && !card.waiting) move(card, column);
                setDragging(null);
              }}
            >
              <h3>{label(column)} <span>{list.length}</span></h3>
              {list.map(card => (
                <article key={card.id} className="os-card" draggable={!card.waiting} onDragStart={() => setDragging(card.id)}>
                  <Link href={`/os/tasks/${card.id}`}>{card.title}</Link>
                  {card.sub ? <p>{card.sub}</p> : null}
                  <p className={card.late ? "os-overdue" : undefined}>{card.due ?? "No date"}</p>
                  {card.waiting ? <p>Waiting on an earlier task</p> : null}
                  <label className="os-card-move">
                    <span className="sr-only">Move {card.title} to</span>
                    <select value={columnOf(card)} onChange={e => move(card, e.target.value)} disabled={pending || card.waiting}>
                      {COLUMNS.map(s => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </label>
                </article>
              ))}
              {list.length === 0 ? <p className="os-kanban-empty">Nothing here</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
