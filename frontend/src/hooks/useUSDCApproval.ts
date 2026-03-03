import { useState, useCallback } from 'react';
import { useReadContract, useSendTransaction, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { erc20Abi, encodeFunctionData } from 'viem';
import toast from 'react-hot-toast';
import { CONTRACTS } from '../config/contracts';

const USDC_ADDRESS = CONTRACTS.usdc as `0x${string}`;
// Max approval to avoid repeated approvals
const MAX_APPROVAL = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export function useUSDCApproval(spenderAddress: string) {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();

  const { sendTransactionAsync } = useSendTransaction();

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!spenderAddress,
    },
  });

  // Wait for approval confirmation
  const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
    query: { enabled: !!approvalHash },
  });

  const needsApproval = useCallback((amount: bigint): boolean => {
    if (!allowance) return true;
    return allowance < amount;
  }, [allowance]);

  const approve = useCallback(async (amount: bigint): Promise<boolean> => {
    if (!needsApproval(amount)) return true;

    setIsApproving(true);
    const toastId = toast.loading('Approve USDC spending...');

    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, MAX_APPROVAL],
      });

      const hash = await sendTransactionAsync({
        to: USDC_ADDRESS,
        data,
      });

      setApprovalHash(hash);
      toast.loading('Waiting for approval confirmation...', { id: toastId });

      // Wait for the receipt by polling — wagmi hook is async
      // We return true and let the caller check approvalConfirmed, or we can poll
      // For simplicity, we wait for the transaction to be mined
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(async () => {
          try {
            const { data: newAllowance } = await refetchAllowance();
            if (newAllowance && newAllowance >= amount) {
              clearInterval(check);
              resolve();
            }
          } catch {
            // Allowance check failed, keep polling
          }
        }, 2000);

        // Timeout after 60 seconds
        setTimeout(() => {
          clearInterval(check);
          reject(new Error('Approval confirmation timeout'));
        }, 60000);
      });

      toast.success('USDC approved', { id: toastId });
      setIsApproving(false);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Approval failed';
      const isUserRejection = message.includes('User rejected') || message.includes('user rejected');
      toast.error(isUserRejection ? 'Approval cancelled' : message, { id: toastId });
      setIsApproving(false);
      return false;
    }
  }, [needsApproval, spenderAddress, sendTransactionAsync, refetchAllowance]);

  return {
    allowance,
    needsApproval,
    approve,
    isApproving,
    approvalConfirmed,
    refetchAllowance,
  };
}
