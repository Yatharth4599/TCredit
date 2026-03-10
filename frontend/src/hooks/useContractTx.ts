import { useState, useCallback } from 'react';
import { useSendTransaction } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import toast from 'react-hot-toast';
import type { UnsignedTx } from '../api/types';
import { txUrl } from '../config/contracts';
import { useStore } from '../store/useStore';
import { config } from '../config/wagmi';

export type TxStatus = 'idle' | 'signing' | 'submitted' | 'confirming' | 'confirmed' | 'failed';

export function useContractTx() {
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { sendTransactionAsync } = useSendTransaction();
  const setPendingTx = useStore((s) => s.setPendingTx);

  const isConfirming = status === 'confirming';
  const isConfirmed = status === 'confirmed';

  const execute = useCallback(async (unsignedTx: UnsignedTx): Promise<`0x${string}` | undefined> => {
    setStatus('signing');
    setError(null);
    setTxHash(undefined);
    setPendingTx({ description: unsignedTx.description, status: 'signing' });

    const toastId = toast.loading(unsignedTx.description);

    try {
      const hash = await sendTransactionAsync({
        to: unsignedTx.to as `0x${string}`,
        data: unsignedTx.data as `0x${string}`,
        ...(unsignedTx.value ? { value: BigInt(unsignedTx.value) } : {}),
      });

      setTxHash(hash);
      setStatus('confirming');
      setPendingTx({ hash, description: unsignedTx.description, status: 'confirming' });
      toast.loading('Waiting for confirmation...', { id: toastId });

      // Actually wait for the receipt
      await waitForTransactionReceipt(config, { hash });

      setStatus('confirmed');
      setPendingTx({ hash, description: unsignedTx.description, status: 'confirmed' });
      toast.success('Transaction confirmed!', { id: toastId });

      return hash;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction failed';
      // User rejected in wallet
      const isUserRejection = message.includes('User rejected') || message.includes('user rejected');
      const displayMessage = isUserRejection ? 'Transaction cancelled' : message;

      setStatus('failed');
      setError(displayMessage);
      setPendingTx({ description: unsignedTx.description, status: 'failed', error: displayMessage });
      toast.error(displayMessage, { id: toastId });
      return undefined;
    }
  }, [sendTransactionAsync, setPendingTx]);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(undefined);
    setError(null);
    setPendingTx(null);
  }, [setPendingTx]);

  return {
    execute,
    reset,
    status,
    txHash,
    txUrl: txHash ? txUrl(txHash) : undefined,
    error,
    isConfirming,
    isConfirmed,
  };
}
