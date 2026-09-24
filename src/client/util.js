/* Shared client helpers: labels, dates, CSV, text. */

export let LABELS = {};
export let ENUMS = {};
let TODAY = new Date().toISOString().slice(0, 10);

export function initConfig(config) {
  LABELS = config.labels || {};
  ENUMS = config.enums || {};
  if (config.today) TODAY = config.today;
}

export function today() { return TODAY; }

export function label(kind, value) {
  if (value == null || value === '') return '';
  return (LABELS[kind] && LABELS[kind][value]) || String(value);
}

export const ROLE_LABELS = {
  ADVISOR: 'Advisor', PREPARER: 'Preparer', PEER_REVIEWER: 'Peer Reviewer', OS: 'OS', BK: 'BK', BK_LEAD: 'BK Lead',
  BK_TEAM_LEAD: 'BK Team Lead', EXEC: 'Exec', ADMIN: 'Admin',
};

export const ANCHOR_LABELS = {
  CLAIMED_AT: 'Onboarding claimed', PROJECT_START: 'Project start', FILING_DEADLINE: 'Filing deadline', EFILE_DATE: 'E-file date', NONE: 'No due date',
};

export function sectionLabel(s) {
  return label('TASK_SECTION', s) || (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'General');
}

function dayDiff(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  const t = new Date(TODAY + 'T12:00:00');
  return Math.round((d - t) / 86400000);
}

export function dueClass(iso) {
  if (!iso) return '';
  const diff = dayDiff(iso);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return '';
}

export function fmtDue(iso, withYear) {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  if (isNaN(d)) return String(iso);
  const diff = dayDiff(iso);
  if (!withYear) {
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  if (withYear || diff < -30 || diff > 300) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysFromToday(iso) { return iso ? dayDiff(iso) : null; }

export function fmtTs(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtTsShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Yesterday · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return fmtTs(iso);
}

export function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  return Math.floor(min / 60) + 'h ago';
}

export function fmtMinutes(min) {
  min = Math.round(min || 0);
  return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
}

export function fmtElapsed(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h > 0 ? h + ':' : '') + String(m).padStart(h > 0 ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
}

export function initialsOf(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function toCSV(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    let s = String(v);
    // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a text cell).
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function safeUrl(u) {
  return /^https:\/\//i.test(String(u || '')) ? u : '';
}

export function cx(...parts) { return parts.filter(Boolean).join(' '); }
