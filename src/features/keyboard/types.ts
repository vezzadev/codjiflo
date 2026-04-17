export interface Shortcut {
  key: string;
  description: string;
  action: () => void;
}

export interface ShortcutConfig {
  shortcuts: Shortcut[];
}
