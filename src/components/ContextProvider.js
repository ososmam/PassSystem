import React, { createContext, useContext, useReducer, useMemo } from 'react';
import reducer from './reducer';

const initialState = {
  currentUser: null,
  usersData: null,
  openLogin: false,
  loading: false,
  alert: { open: false, severity: 'info', message: '' },
};

const Context = createContext(initialState);

export const useValue = () => useContext(Context);

const ContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Memoize context value to avoid unnecessary re-renders
  const memoizedValue = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <Context.Provider value={memoizedValue}>{children}</Context.Provider>
  );
};

export default ContextProvider;
