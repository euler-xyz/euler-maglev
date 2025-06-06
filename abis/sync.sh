#!/bin/sh

set -e

## EulerChains (FIXME: dynamically load this)

cp ../../euler-devland/libflat/euler-interfaces/EulerChains.json .

## ABIs

cp ../../euler-devland/out/EthereumVaultConnector.sol/*.json .

cp ../../euler-devland/out/IEulerSwap.sol/*.json .
cp ../../euler-devland/out/IEulerSwapPeriphery.sol/*.json .
cp ../../euler-devland/out/EulerSwapFactory.sol/*.json .

cp ../../euler-devland/out/MaglevLens.sol/*.json .
