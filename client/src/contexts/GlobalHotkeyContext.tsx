import React, { createContext, ReactNode, useContext } from 'react';

interface GlobalHotkeyContextType {
  registerHotkey: (key: string, callback: () => void) => void;
  unregisterHotkey: (key: string) => void;
}

const GlobalHotkeyContext = createContext<GlobalHotkeyContextType | undefined>(undefined);

export const useGlobalHotkey = () => {
  const context = useContext(GlobalHotkeyContext);
  if (!context) {
    throw new Error('useGlobalHotkey must be used within a GlobalHotkeyProvider');
  }
  return context;
};

interface GlobalHotkeyProviderProps {
  children: ReactNode;
}

export const GlobalHotkeyProvider: React.FC<GlobalHotkeyProviderProps> = ({ children }) => {
  const registerHotkey = (key: string, _callback: () => void) => {
    // TODO: Implement hotkey registration
    console.log(`Registering hotkey: ${key}`);
  };

  const unregisterHotkey = (key: string) => {
    // TODO: Implement hotkey unregistration
    console.log(`Unregistering hotkey: ${key}`);
  };

  const value = {
    registerHotkey,
    unregisterHotkey,
  };

  return <GlobalHotkeyContext.Provider value={value}>{children}</GlobalHotkeyContext.Provider>;
};
