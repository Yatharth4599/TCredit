# TigerPay Solana - Setup Guide

## Installed Dependencies

✅ **Rust**: v1.93.0  
✅ **Solana CLI**: v1.18.20  
⏳ **Anchor CLI**: Installing v0.30.1  

## Project Structure (To Be Created)

```
tpayx-solana/
├── Anchor.toml
├── Cargo.toml
├── programs/
│   └── tigerpay/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── state/
│           ├── instructions/
│           └── errors.rs
├── tests/
│   └── tigerpay.ts
└── migrations/
    └── deploy.ts
```

## Next Steps

1. Wait for Anchor CLI installation
2. Initialize Anchor project: `anchor init tpayx-solana`
3. Set up Solana config: `solana config set --url devnet`
4. Create keypair: `solana-keygen new`
5. Get devnet SOL: `solana airdrop 2`

## When Ready for Rust Rewrite

**Switch to Opus** for writing the actual Rust programs.
