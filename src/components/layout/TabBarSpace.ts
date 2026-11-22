import { createContext, useContext } from 'react';

/**
 * Space the floating tab bar covers at the bottom of a screen. Zero outside
 * the tabs, and with the side rail or strip.
 */
export const TabBarSpaceContext = createContext(0);

export const useTabBarSpace = () => useContext(TabBarSpaceContext);
