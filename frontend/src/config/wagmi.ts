import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'Krexa',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'tcredit-dev',
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});
