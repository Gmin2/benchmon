#!/usr/bin/env bash
# plays one full match against a live rpc: deploy, seed cards, create, join, 2 rounds of commit and reveal
# usage: RPC_URL=... KEY_A=... KEY_B=... scripts/e2e-match.sh
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export PATH="$PATH:$HOME/.foundry/bin"

A=$(cast wallet address "$KEY_A")
B=$(cast wallet address "$KEY_B")
send() { cast send --rpc-url "$RPC_URL" --private-key "$1" "${@:2}" --json | jq -r '.data.status // .status // "sent"'; }

CARDS=$(forge create src/CardStats.sol:CardStats --rpc-url "$RPC_URL" --private-key "$KEY_A" --broadcast | awk '/Deployed to/ {print $3}')
DUEL=$(forge create src/Duel.sol:Duel --rpc-url "$RPC_URL" --private-key "$KEY_A" --broadcast --constructor-args "$CARDS" | awk '/Deployed to/ {print $3}')
echo "cards $CARDS"
echo "duel  $DUEL"

send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 0 "claude-opus" "[92,88,95,40,20,90]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 1 "deepseek" "[80,85,78,70,95,60]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 2 "gemini-flash" "[70,72,68,96,90,65]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 3 "llama" "[55,50,52,80,97,50]" >/dev/null

STAKE=0.01ether
send "$KEY_A" "$DUEL" "create()" --value $STAKE >/dev/null
ID=$(( $(cast call --rpc-url "$RPC_URL" "$DUEL" "matchCount()(uint256)") - 1 ))
send "$KEY_B" "$DUEL" "join(uint256)" "$ID" --value $STAKE >/dev/null

play() { # card for a, card for b
  local round=$(cast call --rpc-url "$RPC_URL" "$DUEL" "getMatch(uint256)((address,address,uint256,uint8,uint8,uint8,uint8,uint8,uint64,bytes32,bytes32,bool,bool,uint16,uint16,bytes32,uint256,uint256))" "$ID" | tr -d '()' | cut -d, -f5 | tr -d ' ')
  local sa=$(cast keccak "a$RANDOM$round") sb=$(cast keccak "b$RANDOM$round")
  local ca=$(cast keccak "$(cast abi-encode 'f(uint256,uint8,address,uint16,bytes32)' "$ID" "$round" "$A" "$1" "$sa")")
  local cb=$(cast keccak "$(cast abi-encode 'f(uint256,uint8,address,uint16,bytes32)' "$ID" "$round" "$B" "$2" "$sb")")
  send "$KEY_A" "$DUEL" "commit(uint256,bytes32)" "$ID" "$ca" >/dev/null
  send "$KEY_B" "$DUEL" "commit(uint256,bytes32)" "$ID" "$cb" >/dev/null
  send "$KEY_A" "$DUEL" "reveal(uint256,uint16,bytes32)" "$ID" "$1" "$sa" >/dev/null
  send "$KEY_B" "$DUEL" "reveal(uint256,uint16,bytes32)" "$ID" "$2" "$sb" >/dev/null
  echo "round $round: a played $1, b played $2"
}

play 0 3
play 1 2
play 2 1 || true

cast logs --rpc-url "$RPC_URL" --address "$DUEL" --from-block earliest 'RoundWon(uint256 indexed,uint8,address,uint8)' --json | jq -r '.[] | .data' | while read d; do cast abi-decode --input 'f(uint8,address,uint8)' "$d" | tr '\n' ' '; echo; done
cast logs --rpc-url "$RPC_URL" --address "$DUEL" --from-block earliest 'Finished(uint256 indexed,address,uint256)' --json | jq -r '.[] | .data' | xargs -I{} cast abi-decode --input 'f(address,uint256)' {}
echo "a $A  b $B"
