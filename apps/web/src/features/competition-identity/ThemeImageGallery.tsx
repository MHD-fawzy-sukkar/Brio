'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { SaveIdentityRequest } from '@brio/contracts';
import { Avatar } from '../../components/Avatar';
import type { PendingIdentityImage } from './use-identity-uploads';
import { accentPalette } from './theme-palette';

export type DraftThemeImage = SaveIdentityRequest['images'][number] & { src: string; uploadKey?: string };
export type ThemeGalleryItem = { key: string; image?: DraftThemeImage; pending?: PendingIdentityImage };
type Props = {
  items: ThemeGalleryItem[];
  accent: SaveIdentityRequest['accent'];
  uploading: boolean;
  onAssign: (role: 'logo' | 'character', id: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onRemovePending: (id: string) => void;
};

function menuPosition(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect();
  return {
    left: Math.max(12, Math.min(rect.right - 208, window.innerWidth - 220)),
    top: rect.bottom + 164 > window.innerHeight ? Math.max(12, rect.top - 164) : rect.bottom + 6,
  };
}

/** Uses the same artwork and square frame as the player avatar picker. */
export function ThemeImageGallery({
  items,
  accent,
  uploading,
  onAssign,
  onRemove,
  onRetry,
  onRemovePending,
}: Props) {
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const selected = items.find((item) => item.image?.mediaId === menu?.id)?.image;
  const palette = accentPalette(accent);
  const close = () => {
    setMenu(null);
    trigger.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector('button')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        trigger.current?.focus({ preventScroll: true });
      }
    };
    const dismiss = () => setMenu(null);
    const reposition = () => {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setMenu(null);
        return;
      }
      const position = menuPosition(trigger.current);
      setMenu((current) => (current ? { ...current, ...position } : null));
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [menu?.id]);

  return (
    <div
      style={
        {
          '--theme-accent': palette.color,
          '--theme-soft': palette.soft,
          '--theme-ink': palette.text,
        } as CSSProperties
      }
    >
      <ul className="identity-image-gallery grid grid-cols-3 gap-3" aria-label="صور الهوية">
        {items.map(({ key, image, pending }) => {
          const src = image?.src ?? pending?.preview;
          const role = image?.roles.includes('logo')
            ? 'logo'
            : image?.roles.includes('character')
              ? 'character'
              : undefined;
          return (
            <li key={key} className="theme-avatar-tile min-w-0" data-image-role={role}>
              <div className="avatar-choice" title={image?.label ?? pending?.file.name}>
                {src ? (
                  <Avatar src={src} lazy className="w-full rounded-xl" />
                ) : (
                  <span className="grid aspect-square place-items-center text-2xl text-slate-300">▧</span>
                )}
                {role && !pending && (
                  <span className="theme-avatar-tile__role">{role === 'logo' ? '◇ شعار' : '★ رئيسية'}</span>
                )}
                {image && (
                  <button
                    type="button"
                    disabled={uploading}
                    className="theme-avatar-tile__more"
                    aria-label={`خيارات ${image.label}`}
                    aria-expanded={menu?.id === image.mediaId}
                    aria-controls={menu?.id === image.mediaId ? menuId : undefined}
                    onClick={(event) => {
                      if (menu?.id === image.mediaId) {
                        close();
                        return;
                      }
                      trigger.current = event.currentTarget;
                      setMenu({ id: image.mediaId, ...menuPosition(event.currentTarget) });
                    }}
                  >
                    ⋯
                  </button>
                )}
                {pending && (
                  <span role="status" className="theme-avatar-tile__progress">
                    {pending?.status === 'failed'
                      ? 'تعذّر الرفع'
                      : pending?.status === 'staged'
                        ? 'على جهازك فقط'
                        : 'جاري الرفع…'}
                  </span>
                )}
              </div>
              {pending?.status === 'failed' && (
                <div className="mt-2 space-y-1">
                  <p role="alert" className="text-xs leading-5 text-rose-700">
                    {pending.error}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      disabled={uploading}
                      className="font-bold text-brand-700"
                      onClick={() => onRetry(pending.id)}
                    >
                      المحاولة مع الحفظ
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => onRemovePending(pending.id)}
                      className="text-rose-700"
                    >
                      إزالة
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {menu && selected && (
        <div
          ref={menuRef}
          id={menuId}
          role="group"
          aria-label={`خيارات ${selected.label}`}
          className="theme-image-menu"
          style={{ left: menu.left, top: menu.top }}
        >
          <button
            type="button"
            onClick={() => {
              onAssign('character', selected.roles.includes('character') ? '' : selected.mediaId);
              close();
            }}
          >
            {selected.roles.includes('character') ? 'إلغاء تعيين الرئيسية' : 'تعيين كشخصية رئيسية'}
          </button>
          <button
            type="button"
            onClick={() => {
              onAssign('logo', selected.roles.includes('logo') ? '' : selected.mediaId);
              close();
            }}
          >
            {selected.roles.includes('logo') ? 'إلغاء تعيين الشعار' : 'تعيين كشعار'}
          </button>
          <button
            type="button"
            className="text-rose-700"
            onClick={() => {
              onRemove(selected.mediaId);
              setMenu(null);
            }}
          >
            حذف الصورة
          </button>
        </div>
      )}
    </div>
  );
}
