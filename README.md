# QA Task - Testing Ethereum

# Overview

Create a test based on Hardhat for testing contract deployment and interaction.

## Learning Materials

🧯 [01. Intro to Blockchain for FE developers](https://www.notion.so/01-Intro-to-Blockchain-for-FE-developers-26961fcda3484cc7bff9afe8b9deebf3)

🎮 [02. Intro to Ethereum](https://www.notion.so/02-Intro-to-Ethereum-e780c0fff448499bba22d2a3ff58a25a)

🧯 [03. Hardhat general overview](https://hardhat.org/hardhat-runner/docs/getting-started#overview)

🧥 (Optional) [04. Solidity - all you need to know about it](https://www.notion.so/03-Solidity-all-you-need-to-know-about-it-f11f9d9bca714088b2b835ba7cee2121)

## Task Definition

Create a Hardhat project:
1. Add the [Store Contract](https://github.com/georgi-l95/Store) in the repo. The contract abides to the following specification:
- The administrator (owner) of the store should be able to add new products and the quantity of them.
- The administrator should not be able to add the same product twice, just quantity.
- Buyers (clients) should be able to see the available products and buy them by their id.
- Buyers should be able to return products if they are not satisfied (within a certain period in blocktime: 100 blocks).
- A client cannot buy the same product more than one time.
- The clients should not be able to buy a product more times than the quantity in the store unless a product is returned or added by the administrator (owner)
2. Create a test suite in hardhat. The suite should provide extensive coverage for the [Store Contract](https://github.com/georgi-l95/Store).
3. [Optional] Setup a GitHub repo with CI. The CI should be able to:
Compile the contract
Deploy the contract on a local hardhat node
Execute the suite against a local node and verify that it gets full code coverage