'use client';
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { moveQuestion } from '../services/question-order';

type Drag = { id: string; target: string; after: boolean; y: number };
export function useQuestionDrag(ids: string[], disabled: boolean, onReorder: (ids: string[]) => void) {
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const preview = useRef<{ element: HTMLElement; x: number; y: number } | null>(null);
  const latest = useRef({ ids, disabled, onReorder }); latest.current = { ids, disabled, onReorder };
  const [state, setState] = useState<Drag | null>(null);
  const locate = (x: number, y: number) => {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-question-id]');
    if (!drag.current || !card?.dataset.questionId) return;
    const rect = card.getBoundingClientRect();
    const target = card.dataset.questionId, after = y > rect.top + rect.height / 2;
    if (drag.current.target !== target || drag.current.after !== after) { drag.current = { ...drag.current, target, after }; setState({ ...drag.current }); }
  };
  const pointer = useRef({ x: 0, y: 0 });
  const tick = () => {
    if (!drag.current) return;
    const { x, y } = pointer.current;
    const delta = y > window.innerHeight - 72 ? 12 : y < 100 ? -12 : 0;
    if (delta) { window.scrollBy(0, delta); locate(x, y); }
    frame.current = requestAnimationFrame(tick);
  };
  const stop = () => { preview.current?.element.remove(); preview.current = null; if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; drag.current = null; setState(null); };
  useEffect(() => () => { preview.current?.element.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return {
    draggedId: state?.id, target: state,
    handleProps(id: string) {
      return {
        onPointerDown(event: PointerEvent<HTMLButtonElement>) {
          if (latest.current.disabled || !event.isPrimary || event.button !== 0) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const card = event.currentTarget.closest<HTMLElement>('[data-question-id]');
          if (card) {
            const rect = card.getBoundingClientRect();
            const element = card.cloneNode(true) as HTMLElement;
            element.removeAttribute('data-question-id');
            element.removeAttribute('id');
            element.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
            element.setAttribute('aria-hidden', 'true');
            element.inert = true;
            element.classList.add('question-drag-preview');
            Object.assign(element.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
            document.body.appendChild(element);
            preview.current = { element, x: event.clientX, y: event.clientY };
          }
          pointer.current = { x: event.clientX, y: event.clientY };
          drag.current = { id, target: id, after: false, y: event.clientY }; setState({ ...drag.current });
          frame.current = requestAnimationFrame(tick);
        },
        onPointerMove(event: PointerEvent<HTMLButtonElement>) {
          if (!drag.current) return;
          pointer.current = { x: event.clientX, y: event.clientY };
          const ghost = preview.current;
          if (ghost) ghost.element.style.transform = `translate3d(${event.clientX - ghost.x}px, ${event.clientY - ghost.y}px, 0) scale(1.015)`;
          locate(event.clientX, event.clientY);
        },
        onPointerUp(event: PointerEvent<HTMLButtonElement>) {
          const current = drag.current; if (!current) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          const next = moveQuestion(latest.current.ids, current.id, current.target, current.after);
          stop();
          if (next.some((value, index) => value !== latest.current.ids[index])) latest.current.onReorder(next);
        },
        onPointerCancel: stop,
        onLostPointerCapture: () => { if (drag.current) stop(); },
        onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
          if (latest.current.disabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const index = latest.current.ids.indexOf(id), direction = event.key === 'ArrowUp' ? -1 : 1;
          const target = latest.current.ids[index + direction];
          if (target) latest.current.onReorder(moveQuestion(latest.current.ids, id, target, direction > 0));
        }
      };
    }
  };
}
