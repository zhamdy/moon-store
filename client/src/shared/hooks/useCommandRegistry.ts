import { useState, useEffect } from 'react';
import { commandRegistry, type CommandItem } from '../lib/commandRegistry';

export function useCommandRegistry(
  commandsToRegister?: CommandItem[] | CommandItem
): CommandItem[] {
  const [commands, setCommands] = useState<CommandItem[]>(() => commandRegistry.getAll());

  useEffect(() => {
    const unsubscribe = commandRegistry.subscribe(() => {
      setCommands(commandRegistry.getAll());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!commandsToRegister) return;

    if (Array.isArray(commandsToRegister)) {
      return commandRegistry.registerMany(commandsToRegister);
    }
    return commandRegistry.register(commandsToRegister);
  }, [commandsToRegister]);

  return commands;
}

export { commandRegistry, type CommandItem };
