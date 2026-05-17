import type { ReactElement } from 'react';

export type IconName =
  | 'plus' | 'minus' | 'search' | 'close' | 'x' | 'trash' | 'edit'
  | 'drag' | 'routes' | 'builder' | 'home' | 'nl' | 'export' | 'qr'
  | 'play' | 'sparkle' | 'chevron' | 'arrow' | 'check' | 'warn'
  | 'save' | 'copy' | 'link' | 'swap' | 'sun' | 'moon';

const PATHS: Record<IconName, ReactElement> = {
  plus:    <><path d="M12 5v14M5 12h14"/></>,
  minus:   <><path d="M5 12h14"/></>,
  search:  <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  close:   <><path d="M18 6 6 18M6 6l18 18" transform="scale(0.66) translate(3 3)"/></>,
  x:       <><path d="M18 6 6 18M6 6l12 12"/></>,
  trash:   <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>,
  edit:    <><path d="M14 4l6 6L9 21H3v-6L14 4z"/></>,
  drag:    <><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" strokeWidth="2.5"/></>,
  routes:  <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 0 1 4 4v6"/></>,
  builder: <><path d="M4 6h16M4 12h10M4 18h16"/></>,
  home:    <><path d="M3 11 12 4l9 7v9h-6v-6h-6v6H3z"/></>,
  nl:      <><path d="M4 7h16M4 12h10M4 17h16"/><path d="M16 14l3 3-3 3"/></>,
  export:  <><path d="M12 4v12M7 9l5-5 5 5M4 19h16"/></>,
  qr:      <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></>,
  play:    <><path d="M6 4l14 8-14 8z"/></>,
  sparkle: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2"/></>,
  chevron: <><path d="m15 6-6 6 6 6"/></>,
  arrow:   <><path d="M5 12h14M13 5l7 7-7 7"/></>,
  check:   <><path d="m4 12 5 5L20 6"/></>,
  warn:    <><path d="M12 3 2 21h20zM12 10v5M12 18h.01" strokeWidth="2"/></>,
  save:    <><path d="M5 4h12l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6"/></>,
  copy:    <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V4H4v12h4"/></>,
  link:    <><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/></>,
  swap:    <><path d="M7 4v12m0 0-3-3m3 3 3-3M17 20V8m0 0 3 3m-3-3-3 3"/></>,
  sun:     <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.4 1.4M17.66 17.66l1.4 1.4M2 12h2M20 12h2M4.93 19.07l1.4-1.4M17.66 6.34l1.4-1.4"/></>,
  moon:    <><path d="M21 13a8 8 0 1 1-9-9 7 7 0 0 0 9 9z"/></>,
};

type Props = { name: IconName; size?: number };

export function Icon({ name, size = 16 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
