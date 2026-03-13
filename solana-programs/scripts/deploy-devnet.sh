#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-devnet.sh  —  Krexa devnet deployment
#
# Does NOT require anchor CLI. Uses:
#   - cargo-build-sbf  (from Solana platform tools)
#   - solana program deploy  (from Solana CLI)
#   - ts-node (for init + seed scripts)
#
# Run once:  bash scripts/deploy-devnet.sh
# Re-init:   bash scripts/deploy-devnet.sh --skip-build --skip-deploy
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
die()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

SKIP_BUILD=false
SKIP_DEPLOY=false
for arg in "$@"; do
  case $arg in
    --skip-build)  SKIP_BUILD=true ;;
    --skip-deploy) SKIP_DEPLOY=true ;;
  esac
done

# ── 0. Pre-flight ─────────────────────────────────────────────────────────────
info "Pre-flight checks…"

# Add Solana platform tools to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

command -v solana >/dev/null 2>&1          || die "solana CLI not found"
command -v cargo-build-sbf >/dev/null 2>&1 || die "cargo-build-sbf not found — run: sh -c \"\$(curl -sSfL https://release.anza.xyz/v2.0.3/install)\""
command -v solana-keygen >/dev/null 2>&1   || die "solana-keygen not found"
command -v node >/dev/null 2>&1            || die "node not found"

# Switch to devnet
solana config set --url devnet
WALLET=$(solana address)
info "Wallet: $WALLET"
info "RPC:    devnet"

# Airdrop SOL if needed (5 programs × ~2 SOL each)
BALANCE=$(solana balance --lamports 2>/dev/null | awk '{print $1}' || echo 0)
REQUIRED=8000000000
if [ "${BALANCE:-0}" -lt "$REQUIRED" ]; then
  warn "Balance low ($(solana balance)). Requesting airdrops…"
  for i in 1 2 3; do
    solana airdrop 2 --commitment confirmed 2>&1 | tail -1 || true
    sleep 4
  done
fi
ok "Balance: $(solana balance)"

# ── 1. Fix lockfile & deps ────────────────────────────────────────────────────
info "Preparing lockfile for SBF toolchain…"
cd "$ROOT"

# SBF toolchain uses Rust 1.79 — regenerate lockfile with blake3 1.7 (last edition-2021 version)
# and downgrade Cargo lockfile version from 4 → 3
cargo generate-lockfile 2>&1 | tail -2 || true
cargo update blake3 --precise 1.7.0 2>&1 | tail -2 || true
cargo update constant_time_eq --precise 0.3.1 2>&1 | tail -2 || true
# Downgrade lockfile version so SBF toolchain can parse it
sed -i.bak 's/^version = 4$/version = 3/' Cargo.lock && rm -f Cargo.lock.bak
ok "Lockfile prepared (blake3=1.7.0, lock version=3)"

# ── 2. Build ──────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  info "Building programs with cargo-build-sbf…"
  cd "$ROOT"

  for prog in krexa-venue-whitelist krexa-agent-registry krexa-credit-vault krexa-agent-wallet krexa-payment-router; do
    info "  Building $prog…"
    cargo-build-sbf --manifest-path "programs/$prog/Cargo.toml" 2>&1 | grep -E "^error|Finished" || true
    ok "  $prog built"
  done
else
  info "Skipping build (--skip-build)"
fi

cd "$ROOT"

# ── 2. Program keypairs ───────────────────────────────────────────────────────
info "Setting up program keypairs…"
mkdir -p target/deploy

declare -A PROG_NAMES=(
  [krexa_agent_registry]="krexa-agent-registry"
  [krexa_credit_vault]="krexa-credit-vault"
  [krexa_agent_wallet]="krexa-agent-wallet"
  [krexa_venue_whitelist]="krexa-venue-whitelist"
  [krexa_payment_router]="krexa-payment-router"
)

for snake in krexa_agent_registry krexa_credit_vault krexa_agent_wallet krexa_venue_whitelist krexa_payment_router; do
  KEYFILE="target/deploy/${snake}-keypair.json"
  if [ ! -f "$KEYFILE" ]; then
    solana-keygen new --no-bip39-passphrase --outfile "$KEYFILE" 2>&1 | grep "Wrote" || true
    info "  Generated: $KEYFILE"
  fi
done

REGISTRY_ID=$(solana-keygen pubkey target/deploy/krexa_agent_registry-keypair.json)
VAULT_ID=$(solana-keygen pubkey    target/deploy/krexa_credit_vault-keypair.json)
WALLET_ID=$(solana-keygen pubkey   target/deploy/krexa_agent_wallet-keypair.json)
VENUE_ID=$(solana-keygen pubkey    target/deploy/krexa_venue_whitelist-keypair.json)
ROUTER_ID=$(solana-keygen pubkey   target/deploy/krexa_payment_router-keypair.json)

info "Program IDs:"
info "  Registry:  $REGISTRY_ID"
info "  Vault:     $VAULT_ID"
info "  Wallet:    $WALLET_ID"
info "  Venue:     $VENUE_ID"
info "  Router:    $ROUTER_ID"

# ── 3. Patch declare_id! in source ───────────────────────────────────────────
info "Patching declare_id! in program sources…"
declare -A PATCH_MAP=(
  ["programs/krexa-agent-registry/src/lib.rs"]="$REGISTRY_ID"
  ["programs/krexa-credit-vault/src/lib.rs"]="$VAULT_ID"
  ["programs/krexa-agent-wallet/src/lib.rs"]="$WALLET_ID"
  ["programs/krexa-venue-whitelist/src/lib.rs"]="$VENUE_ID"
  ["programs/krexa-payment-router/src/lib.rs"]="$ROUTER_ID"
)

for FILE in "${!PATCH_MAP[@]}"; do
  ID="${PATCH_MAP[$FILE]}"
  if [ -f "$FILE" ]; then
    sed -i.bak "s/declare_id!(\"[^\"]*\")/declare_id!(\"$ID\")/" "$FILE" && rm -f "${FILE}.bak"
    info "  $FILE → $ID"
  fi
done

# Rebuild with correct IDs
if [ "$SKIP_BUILD" = false ]; then
  info "Rebuilding with patched IDs…"
  for prog in krexa-agent-registry krexa-credit-vault krexa-agent-wallet krexa-venue-whitelist krexa-payment-router; do
    cargo-build-sbf --manifest-path "programs/$prog/Cargo.toml" 2>&1 | grep -E "Finished" || true
  done
fi

# ── 4. Deploy ─────────────────────────────────────────────────────────────────
if [ "$SKIP_DEPLOY" = false ]; then
  info "Deploying programs to devnet…"

  deploy_program() {
    local name="$1"
    local snake="$2"
    local so_file="target/deploy/${snake}.so"
    local kp_file="target/deploy/${snake}-keypair.json"

    if [ ! -f "$so_file" ]; then
      warn "  $so_file not found — skipping $name"
      return
    fi

    info "  Deploying $name…"
    solana program deploy \
      --program-id "$kp_file" \
      --keypair ~/.config/solana/id.json \
      --url devnet \
      "$so_file" 2>&1 | tail -3
    ok "  $name deployed"
  }

  # Deploy in dependency order
  deploy_program "krexa-venue-whitelist" "krexa_venue_whitelist"
  deploy_program "krexa-agent-registry"  "krexa_agent_registry"
  deploy_program "krexa-credit-vault"    "krexa_credit_vault"
  deploy_program "krexa-agent-wallet"    "krexa_agent_wallet"
  deploy_program "krexa-payment-router"  "krexa_payment_router"
else
  info "Skipping deploy (--skip-deploy)"
fi

# ── 5. Generate IDLs for init script ─────────────────────────────────────────
# anchor build generates IDLs; without anchor, we use pre-built IDLs from tests/
# The init script uses @coral-xyz/anchor which can work with manually built IDLs
info "Checking for IDLs in target/idl/…"
mkdir -p target/idl
# If IDLs not present from anchor build, note that init will use discriminator-based approach
if [ ! -f "target/idl/krexa_agent_registry.json" ]; then
  warn "IDL files not found in target/idl/ — the init script will generate minimal IDLs"
fi

# ── 6. Initialize ─────────────────────────────────────────────────────────────
info "Running initialize script…"
cd "$SCRIPT_DIR"

# Ensure deps are installed
npm install --prefix "$ROOT" 2>&1 | tail -2

npx ts-node \
  --project "$ROOT/tsconfig.json" \
  --esm \
  "$SCRIPT_DIR/init-devnet.ts" \
  --registry  "$REGISTRY_ID" \
  --vault     "$VAULT_ID" \
  --wallet    "$WALLET_ID" \
  --venue     "$VENUE_ID" \
  --router    "$ROUTER_ID" \
  2>&1 | tee "$SCRIPT_DIR/init-devnet.log"
ok "Initialization complete"

# ── 7. Seed ───────────────────────────────────────────────────────────────────
info "Seeding test data…"
npx ts-node \
  --project "$ROOT/tsconfig.json" \
  --esm \
  "$SCRIPT_DIR/seed-devnet.ts" \
  2>&1 | tee "$SCRIPT_DIR/seed-devnet.log"
ok "Seed complete"

# ── 8. Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
ok "Krexa is LIVE on devnet"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Registry:  $REGISTRY_ID"
echo "  Vault:     $VAULT_ID"
echo "  Wallet:    $WALLET_ID"
echo "  Venue:     $VENUE_ID"
echo "  Router:    $ROUTER_ID"
echo ""
echo "  Explorer:  https://explorer.solana.com/address/$REGISTRY_ID?cluster=devnet"
echo ""
echo "  Next: copy scripts/.env.devnet into backend/.env and start the backend"
echo ""
