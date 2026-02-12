import React from 'react';
import ReactDOM from 'react-dom/client';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import '@mysten/dapp-kit/dist/index.css';
import './styles.css';

type SuiNetwork = 'testnet' | 'devnet' | 'mainnet';
type AppEnv = Record<string, string | undefined>;

const APP_ENV: AppEnv = (import.meta as ImportMeta & { env?: AppEnv }).env ?? {};

function normalizeNetwork(value: string | undefined): SuiNetwork {
  if (value === 'devnet' || value === 'mainnet' || value === 'testnet') {
    return value;
  }
  return 'testnet';
}

const defaultNetwork = normalizeNetwork(APP_ENV.VITE_SUI_NETWORK);
const { networkConfig } = createNetworkConfig({
  testnet: {
    network: 'testnet',
    url: APP_ENV.VITE_SUI_RPC_URL?.trim() || getJsonRpcFullnodeUrl('testnet'),
  },
  devnet: {
    network: 'devnet',
    url: getJsonRpcFullnodeUrl('devnet'),
  },
  mainnet: {
    network: 'mainnet',
    url: getJsonRpcFullnodeUrl('mainnet'),
  },
});
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
