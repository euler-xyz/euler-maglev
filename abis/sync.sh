#!/bin/sh

set -e

## EulerChains (FIXME: dynamically load this)

mkdir -p ./chains/
cp ../../euler-devland/libflat/euler-interfaces/EulerChains.json ./chains/

## ABIs

cp ../../euler-devland/out/EthereumVaultConnector.sol/*.json .

cp ../../euler-devland/out/IEulerSwap.sol/*.json .
cp ../../euler-devland/out/IEulerSwapPeriphery.sol/*.json .
cp ../../euler-devland/out/EulerSwapFactory.sol/*.json .
cp ../../euler-devland/out/EulerSwapRegistry.sol/*.json .

cp ../../euler-devland/out/MaglevLens.sol/*.json .

for file in *.json; do
    jq '{"abi"}' < $file > $file.tmp;
    mv $file.tmp $file
done
