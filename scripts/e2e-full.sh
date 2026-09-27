#!/usr/bin/env bash
# one full match against deployed contracts: decks, spectator backing, a market trade, the live duel verdict,
# then every claim. usage: RPC_URL=.. KEY_A=.. KEY_B=.. CARDS=.. DUEL=.. BACKING=.. MARKET=.. scripts/e2e-full.sh
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
A=$(cast wallet address "$KEY_A")
B=$(cast wallet address "$KEY_B")
MT='getMatch(uint256)((address,address,uint256,uint8,uint8,uint8,uint8,uint8,uint64,bytes32,bytes32,bool,bool,uint16,uint16,bytes32,uint256,uint256,uint64,bool,uint256,uint256,uint8))'
send() {
  local out
  out=$(cast send --rpc-url "$RPC_URL" --private-key "$1" "${@:2}" --json 2>&1) || { echo "send failed: ${*:2}" >&2; echo "$out" >&2; exit 1; }
  if echo "$out" | jq -e '.success == false' >/dev/null 2>&1; then echo "send failed: ${*:2}" >&2; echo "$out" | jq -c '.errors' >&2; exit 1; fi
}
field() { cast call --rpc-url "$RPC_URL" "$DUEL" "$MT" "$ID" | tr -d '()' | cut -d, -f"$1" | tr -d ' '; }

if [ "$(cast call --rpc-url "$RPC_URL" "$CARDS" 'cardCount()(uint256)')" = "0" ]; then
  send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 0 "claude-opus" "[92,88,95,40,20,90]"
  send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 1 "deepseek" "[80,85,78,70,95,60]"
  send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 2 "gemini-flash" "[70,72,68,96,90,65]"
  send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 3 "llama" "[55,50,52,80,97,50]"
  send "$KEY_A" "$CARDS" "setCard(uint256,string,uint8[6])" 4 "gpt-mini" "[65,70,60,85,88,55]"
  send "$KEY_A" "$DUEL" "setDeckCap(uint256)" 2400
  echo "seeded 5 cards"
fi

send "$KEY_A" "$DUEL" "create(uint16[5])" "[0,1,2,3,4]" --value 0.01ether
ID=$(( $(cast call --rpc-url "$RPC_URL" "$DUEL" "matchCount()(uint256)") - 1 ))
send "$KEY_B" "$DUEL" "join(uint256,uint16[5])" "$ID" "[0,1,2,3,4]" --value 0.01ether
echo "match $ID started, arena $(field 8)"

LB=100000000000000000 # b = 0.1 MON
SEED=$(cast call --rpc-url "$RPC_URL" "$MARKET" "maxLoss(uint256)(uint256)" $LB | cut -d' ' -f1)
send "$KEY_A" "$MARKET" "open(uint256,uint256)" "$ID" $LB --value "$SEED"
send "$KEY_A" "$BACKING" "back(uint256,uint8)" "$ID" 1 --value 0.02ether
send "$KEY_B" "$BACKING" "back(uint256,uint8)" "$ID" 2 --value 0.01ether
P0=$(cast call --rpc-url "$RPC_URL" "$MARKET" "priceA(uint256)(uint256)" "$ID" | cut -d' ' -f1)
send "$KEY_B" "$MARKET" "buy(uint256,uint8,uint256)" "$ID" 2 50000000000000000 --value 0.05ether
P1=$(cast call --rpc-url "$RPC_URL" "$MARKET" "priceA(uint256)(uint256)" "$ID" | cut -d' ' -f1)
echo "market seeded with $(cast from-wei $SEED) MON, price of a: $(cast from-wei $P0) -> $(cast from-wei $P1) after b bought 0.05 shares"

play() {
  [ "$(field 4)" = "1" ] || return 0
  [ "$(field 20)" = "false" ] || return 0
  local round=$(field 5) sa=$(cast keccak "a$RANDOM") sb=$(cast keccak "b$RANDOM")
  send "$KEY_A" "$DUEL" "commit(uint256,bytes32)" "$ID" "$(cast keccak "$(cast abi-encode 'f(uint256,uint8,address,uint16,bytes32)' "$ID" "$round" "$A" "$1" "$sa")")"
  send "$KEY_B" "$DUEL" "commit(uint256,bytes32)" "$ID" "$(cast keccak "$(cast abi-encode 'f(uint256,uint8,address,uint16,bytes32)' "$ID" "$round" "$B" "$2" "$sb")")"
  send "$KEY_A" "$DUEL" "reveal(uint256,uint16,bytes32)" "$ID" "$1" "$sa"
  send "$KEY_B" "$DUEL" "reveal(uint256,uint16,bytes32)" "$ID" "$2" "$sb"
  echo "round $round: a $1 vs b $2 -> wins a $(field 6), wins b $(field 7), waiting for judge: $(field 20)"
}
play 0 3
play 1 2
play 2 1

if [ "$(field 20)" = "true" ]; then
  H=$(cast keccak "prompt: what is 17 * 23 | a: 391 | b: 381 | verdict a")
  send "$KEY_A" "$DUEL" "settleLive(uint256,uint8,bytes32)" "$ID" 1 "$H"
  echo "live duel: judge gave the round to a, duel hash $H"
fi
echo "result $(field 23) (1 a, 2 b, 3 draw), wins a $(field 6), wins b $(field 7)"

for K in "$KEY_A" "$KEY_B"; do
  o=$(cast call --rpc-url "$RPC_URL" "$DUEL" "owed(address)(uint256)" "$(cast wallet address "$K")" | cut -d' ' -f1)
  [ "$o" != "0" ] && send "$K" "$DUEL" "withdraw()" && echo "duel paid $(cast from-wei $o) to $(cast wallet address "$K")"
done
for K in "$KEY_A" "$KEY_B"; do
  W=$(cast wallet address "$K")
  c=$(cast call --rpc-url "$RPC_URL" "$BACKING" "claimable(uint256,address)(uint256)" "$ID" "$W" | cut -d' ' -f1)
  [ "$c" != "0" ] && send "$K" "$BACKING" "claim(uint256)" "$ID" && echo "backing paid $(cast from-wei $c) to $W"
  r=$(cast call --rpc-url "$RPC_URL" "$MARKET" "redeemable(uint256,address)(uint256)" "$ID" "$W" | cut -d' ' -f1)
  [ "$r" != "0" ] && send "$K" "$MARKET" "redeem(uint256)" "$ID" && echo "market paid $(cast from-wei $r) to $W"
done
send "$KEY_A" "$MARKET" "houseSettle(uint256)" "$ID"
echo "contracts after: duel $(cast balance --ether --rpc-url "$RPC_URL" "$DUEL"), backing $(cast balance --ether --rpc-url "$RPC_URL" "$BACKING"), market $(cast balance --ether --rpc-url "$RPC_URL" "$MARKET") MON"
