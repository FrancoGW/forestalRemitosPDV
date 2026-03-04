import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { DatesProvider } from '@mantine/dates';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import App from './App';

const theme = createTheme({
  primaryColor: 'green',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSizes: { xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '18px' },
  defaultRadius: 'xs',
  colors: {
    green: [
      '#f2faf3', '#e0f2e3', '#b8e0be', '#8ecb97',
      '#63b56e', '#3d9e4a', '#2d8a39', '#1f6e2a',
      '#165520', '#0e3c17',
    ],
  },
  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.06)',
    sm: '0 1px 4px rgba(0,0,0,0.08)',
    md: '0 2px 8px rgba(0,0,0,0.08)',
    lg: '0 4px 16px rgba(0,0,0,0.10)',
  },
  components: {
    Button: {
      defaultProps: { radius: 'xs' },
      styles: { root: { fontWeight: 500, letterSpacing: '0.01em' } },
    },
    Paper: { defaultProps: { radius: 'xs' } },
    Modal: { defaultProps: { radius: 'xs' } },
    Input: { defaultProps: { radius: 'xs' } },
    Select: { defaultProps: { radius: 'xs' } },
    TextInput: { defaultProps: { radius: 'xs' } },
    NumberInput: { defaultProps: { radius: 'xs' } },
    PasswordInput: { defaultProps: { radius: 'xs' } },
    DatePickerInput: { defaultProps: { radius: 'xs' } },
    Badge: { defaultProps: { radius: 'xs' } },
    Avatar: { defaultProps: { radius: 'xs' } },
    NavLink: { styles: { root: { borderRadius: 3 } } },
    Table: {
      styles: {
        th: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#868e96' },
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1 }}>
        <Notifications position="top-right" autoClose={3500} />
        <App />
      </DatesProvider>
    </MantineProvider>
  </StrictMode>
);
