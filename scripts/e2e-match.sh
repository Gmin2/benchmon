#!/usr/bin/env bash
# plays one full match against a live rpc: deploy, seed cards, create, join, 2 rounds of commit and reveal
# usage: RPC_URL=... KEY_A=... KEY_B=... scripts/e2e-match.sh
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export PATH="$PATH:$HOME/.foundry/bin"

FROM=$(cast block-number --rpc-url "$RPC_URL")
A=$(cast wallet address "$KEY_A")
B=$(cast wallet address "$KEY_B")
send() {
  local out
  out=$(cast send --rpc-url "$RPC_URL" --private-key "$1" "${@:2}" --json 2>&1) || { echo "send failed: ${*:2}" >&2; echo "$out" >&2; exit 1; }
  if echo "$out" | jq -e '.success == false' >/dev/null 2>&1; then echo "send failed: ${*:2}" >&2; echo "$out" | jq -c '.errors' >&2; exit 1; fi
}

CARDS=$(forge create src/CardStats.sol:CardStats --rpc-url "$RPC_URL" --private-key "$KEY_A" --broadcast | awk '/Deployed to/ {print $3}')
DUEL=$(forge create src/Duel.sol:Duel --rpc-url "$RPC_URL" --private-key "$KEY_A" --broadcast --constructor-args "$CARDS" "${JUDGE:-0x0000000000000000000000000000000000000000}" | awk '/Deployed to/ {print $3}')
echo "cards $CARDS"
echo "duel  $DUEL"

send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 0 "claude-opus" "[92,88,95,40,20,90]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 1 "deepseek" "[80,85,78,70,95,60]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 2 "gemini-flash" "[70,72,68,96,90,65]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 3 "llama" "[55,50,52,80,97,50]" >/dev/null
send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 4 "gpt-mini" "[65,70,60,85,88,55]" >/dev/null

# the demo stats are frontier heavy, so give the deck cap room
send "$KEY_A" "$DUEL" "setDeckCap(uint256)" 2400

STAKE=0.01ether
send "$KEY_A" "$DUEL" "create(uint16[5])" "[0,1,2,3,4]" --value $STAKE >/dev/null
ID=$(( $(cast call --rpc-url "$RPC_URL" "$DUEL" "matchCount()(uint256)") - 1 ))
send "$KEY_B" "$DUEL" "join(uint256,uint16[5])" "$ID" "[0,1,2,3,4]" --value $STAKE >/dev/null

play() { # card for a, card for b
  local state=$(cast call --rpc-url "$RPC_URL" "$DUEL" "getMatch(uint256)((address,address,uint256,uint8,uint8,uint8,uint8,uint8,uint64,bytes32,bytes32,bool,bool,uint16,uint16,bytes32,uint256,uint256,uint64,bool,uint256,uint256))" "$ID" | tr -d '()' | cut -d, -f4 | tr -d ' ')
  if [ "$state" != "1" ]; then echo "match already over"; return; fi
  local round=$(cast call --rpc-url "$RPC_URL" "$DUEL" "getMatch(uint256)((address,address,uint256,uint8,uint8,uint8,uint8,uint8,uint64,bytes32,bytes32,bool,bool,uint16,uint16,bytes32,uint256,uint256,uint64,bool,uint256,uint256))" "$ID" | tr -d '()' | cut -d, -f5 | tr -d ' ')
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
play 2 1

M=$(cast call --rpc-url "$RPC_URL" "$DUEL" "getMatch(uint256)((address,address,uint256,uint8,uint8,uint8,uint8,uint8,uint64,bytes32,bytes32,bool,bool,uint16,uint16,bytes32,uint256,uint256,uint64,bool,uint256,uint256))" "$ID" | tr -d '()')
echo "$M" | awk -F', ' '{print "state", $4, "(2 = done), rounds", $5, ", wins a", $6, ", wins b", $7}'
echo "duel balance after: $(cast balance --ether --rpc-url "$RPC_URL" "$DUEL")"
echo "a $A  b $B"
