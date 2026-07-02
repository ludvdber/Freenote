// Minimal ambient types for frappe-gantt v1 (the package ships no .d.ts). We only use the
// constructor + refresh + change_view_mode; the rest is intentionally loose.
declare module 'frappe-gantt' {
  export interface FrappeTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
  }
  export interface FrappeOptions {
    view_mode?: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year';
    date_format?: string;
    language?: string;
    readonly?: boolean;
    bar_height?: number;
    column_width?: number;
    [key: string]: unknown;
  }
  export default class Gantt {
    constructor(wrapper: string | HTMLElement | SVGElement, tasks: FrappeTask[], options?: FrappeOptions);
    refresh(tasks: FrappeTask[]): void;
    change_view_mode(mode: string): void;
  }
}
