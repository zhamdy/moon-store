import type { ReactNode, ComponentType } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  shortcut?: string;
  keywords?: string[];
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: string | boolean }> | ReactNode;
  onSelect: () => void | Promise<void>;
}

class CommandRegistryStore {
  private commands: Map<string, CommandItem> = new Map();
  private listeners: Set<() => void> = new Set();

  register(command: CommandItem): () => void {
    this.commands.set(command.id, command);
    this.notify();
    return () => {
      this.commands.delete(command.id);
      this.notify();
    };
  }

  registerMany(commands: CommandItem[]): () => void {
    commands.forEach((cmd) => this.commands.set(cmd.id, cmd));
    this.notify();
    return () => {
      commands.forEach((cmd) => this.commands.delete(cmd.id));
      this.notify();
    };
  }

  getAll(): CommandItem[] {
    return Array.from(this.commands.values());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const commandRegistry = new CommandRegistryStore();
