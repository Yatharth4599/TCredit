# FairScale Integration (Future)

## Overview
FairScale provides on-chain credit scoring for Solana wallets, enabling **uncollateralized lending** - a key differentiator for TigerPay.

## API Details
- **Base URL**: `https://api.fairscale.xyz`
- **Docs**: https://swagger.api.fairscale.xyz/
- **Beta API Key**: `b22f042ae6c228db3b717847681b4af27ad420ee3642445e78a563f05f217a84`

## 15 Scoring Metrics
1. LST (Liquid Staking Token) holdings
2. Major token holdings
3. Native SOL holdings
4. Stablecoin holdings
5. Transaction count
6. Number of active trading days
7. Median time gap between trades (hours)
8. Coefficient of variation for trading tempo
9. Ratio of burst trading activity
10. Net SOL flow over 30 days
11. Median holding duration (days)
12. Percentage of non-instant dumps
13. Trading conviction ratio (long vs short holds)
14. Number of unique platforms used
15. Age of wallet (days)

## Integration Points (When Ready)

### Backend Service
```typescript
// backend/src/services/fairscale.service.ts
class FairScaleService {
  async getCreditScore(walletAddress: string): Promise<CreditScore>
  async evaluateMerchant(walletAddress: string): Promise<MerchantRiskProfile>
}
```

### Use Cases
1. **Merchant Verification** - Check credit score before allowing vault creation
2. **Dynamic Interest Rates** - Lower rates for high-score merchants
3. **Investment Limits** - Higher limits for trusted wallets
4. **Default Risk** - Flag high-risk merchants early

### Custom Weightage (To Be Defined)
TigerPay needs to define custom weights for each metric based on:
- Merchant vs Investor profiles
- Risk tolerance
- Historical default data

Once defined, FairScale will issue production API keys with custom scoring algorithm.

## Next Steps (Future)
1. Define custom weightage for 15 metrics
2. Request production API keys
3. Implement backend integration
4. Add credit checks to vault creation flow
5. Build merchant risk dashboard
