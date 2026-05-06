import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.js';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

const themeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00d992',
    colorBgBase: '#050507',
    colorBgContainer: '#101010',
    colorBgElevated: '#1a1a1a',
    colorBorder: '#3d3a39',
    colorBorderSecondary: '#3d3a39',
    colorText: '#f2f2f2',
    colorTextSecondary: '#b8b3b0',
    colorTextTertiary: '#8b949e',
    colorTextQuaternary: '#595959',
    borderRadius: 6,
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontFamilyCode: "'SFMono-Regular', 'JetBrains Mono', Consolas, monospace",
    colorSuccess: '#00d992',
    colorWarning: '#ffba00',
    colorError: '#fb565b',
    colorInfo: '#4cb3d4',
  },
  components: {
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(0, 217, 146, 0.1)',
      darkItemHoverBg: 'rgba(0, 217, 146, 0.05)',
      itemSelectedColor: '#00d992',
      itemHoverColor: '#00ffaa',
    },
    Card: {
      colorBgContainer: '#101010',
      colorBorderSecondary: '#3d3a39',
    },
    Modal: {
      contentBg: '#101010',
      headerBg: '#101010',
    },
    Table: {
      colorBgContainer: '#101010',
      headerBg: '#0a0a0c',
      rowHoverBg: 'rgba(0, 217, 146, 0.05)',
    },
    Input: {
      colorBgContainer: '#0a0a0c',
      colorBorder: '#3d3a39',
    },
    Tag: {
      defaultBg: 'rgba(61, 58, 57, 0.3)',
      defaultColor: '#b8b3b0',
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig} locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntApp>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>
);
